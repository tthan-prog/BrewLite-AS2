import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntentStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuthUser } from '../../auth/auth-user';
import { PAYABLE_STATUSES } from '../../orders/order-status';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentResult, PaymentsService } from '../payments.service';
import { buildPaymentUrl, responseMessage, verify, vnpDate } from './vnpay-signature';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  url: string;
  returnUrl: string;
}

/** Kết quả xử lý dữ liệu VNPay gửi về. */
export type VnpayOutcome =
  | { kind: 'paid' | 'failed'; result: PaymentResult }
  | { kind: 'invalid-signature' | 'not-found' | 'invalid-amount' | 'already-confirmed' };

const EXPIRE_MINUTES = 15;

/**
 * Thanh toán qua VNPay sandbox (FR-21, ADR 004). Không dùng tiền thật.
 *  - Tạo URL thanh toán đã ký; vnp_TxnRef là token của PaymentIntent.
 *  - Return URL / IPN: kiểm tra chữ ký HMAC-SHA512, mã website và số tiền trước khi chốt đơn.
 *    Sai chữ ký hoặc sai số tiền thì từ chối, đơn giữ nguyên.
 *  - Chốt qua PaymentsService.settle với Idempotency-Key "vnpay-<txnRef>": Return URL và IPN
 *    cùng gọi hay gọi lặp lại vẫn chỉ ghi một kết quả.
 *  - Cấu hình (TMN_CODE, HASH_SECRET, URL, RETURN_URL) chỉ lấy từ biến môi trường.
 */
@Injectable()
export class VnpayService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  get settings(): VnpayConfig | null {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE');
    const hashSecret = this.config.get<string>('VNPAY_HASH_SECRET');
    const url = this.config.get<string>('VNPAY_URL');
    const returnUrl = this.config.get<string>('VNPAY_RETURN_URL');
    if (!tmnCode || !hashSecret || !url || !returnUrl) return null;
    return { tmnCode, hashSecret, url, returnUrl };
  }

  private requireSettings(): VnpayConfig {
    const settings = this.settings;
    if (!settings) throw new ServiceUnavailableException('Thanh toán VNPay chưa được cấu hình');
    return settings;
  }

  /** Tạo URL thanh toán VNPay cho đơn của khách. */
  async create(user: AuthUser, orderId: number, ipAddr: string) {
    const cfg = this.requireSettings();
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== user.id) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!PAYABLE_STATUSES.includes(order.status)) {
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Đơn đã bị hủy, không thể thanh toán');
      throw new ConflictException('Đơn đã được thanh toán');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRE_MINUTES * 60_000);
    const txnRef = randomBytes(16).toString('hex');
    const paymentUrl = buildPaymentUrl(
      cfg.url,
      {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: cfg.tmnCode,
        vnp_Amount: String(order.total * 100),
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan don hang BrewLite ${order.id}`,
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: cfg.returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: vnpDate(now),
        vnp_ExpireDate: vnpDate(expiresAt),
      },
      cfg.hashSecret,
    );
    await this.prisma.paymentIntent.create({
      data: { token: txnRef, qrContent: paymentUrl, orderId: order.id, amount: order.total, expiresAt },
    });
    return { orderId: order.id, txnRef, amount: order.total, expiresAt, paymentUrl };
  }

  /** Xử lý dữ liệu VNPay gửi về (dùng chung cho Return URL và IPN). */
  async process(query: Record<string, unknown>): Promise<VnpayOutcome> {
    const cfg = this.requireSettings();
    if (!verify(query, cfg.hashSecret) || query.vnp_TmnCode !== cfg.tmnCode) return { kind: 'invalid-signature' };

    const txnRef = typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef : '';
    const intent = /^[a-f0-9]{32}$/.test(txnRef)
      ? await this.prisma.paymentIntent.findUnique({ where: { token: txnRef }, include: { order: true } })
      : null;
    if (!intent) return { kind: 'not-found' };
    if (query.vnp_Amount !== String(intent.amount * 100) || intent.amount !== intent.order.total) {
      return { kind: 'invalid-amount' };
    }

    const idempotencyKey = `vnpay-${txnRef}`;
    const responseCode = String(query.vnp_ResponseCode ?? '');
    const success = responseCode === '00' && String(query.vnp_TransactionStatus ?? '00') === '00';
    const requestHash = createHash('sha256').update(JSON.stringify(['VNPAY', txnRef, responseCode])).digest('hex');

    const previous = await this.prisma.payment.findUnique({
      where: { userId_idempotencyKey: { userId: intent.order.userId, idempotencyKey } },
    });
    if (previous && previous.requestHash !== requestHash) return { kind: 'already-confirmed' };

    const { result } = await this.payments.settle({
      userId: intent.order.userId,
      orderId: intent.orderId,
      method: PaymentMethod.VNPAY,
      idempotencyKey,
      requestHash,
      charge: async () => (success ? { success: true } : { success: false, reason: responseMessage(responseCode) }),
      onSuccess: async (tx) => {
        await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: IntentStatus.PENDING },
          data: { status: IntentStatus.PAID },
        });
      },
      // Tiền đã trừ ở VNPay trước khi về đây: cần hoàn tiền qua cổng VNPay (sandbox: thao tác thủ công)
      outOfStockReason: (name) => `Nguyên liệu vừa hết (${name}); giao dịch VNPay cần hoàn tiền`,
    });
    if (result.status === 'FAILED') {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: IntentStatus.PENDING },
        data: { status: IntentStatus.FAILED },
      });
    }
    return { kind: result.status === 'SUCCESS' ? 'paid' : 'failed', result };
  }
}
