import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntentStatus, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { AuthUser } from '../auth/auth-user';
import { PAYABLE_STATUSES } from '../orders/order-status';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentResult, PaymentsService } from './payments.service';

export interface QrIntentView {
  token: string;
  orderId: number;
  amount: number;
  status: IntentStatus;
  expiresAt: Date;
  /** Link mở trên điện thoại sau khi quét. */
  qrContent: string;
  /** Ảnh mã QR (PNG data URL) để hiển thị ở trang thanh toán. */
  qrImage: string;
}

export interface QrPublicView {
  token: string;
  orderId: number;
  amount: number;
  status: IntentStatus;
  expiresAt: Date;
  accounts: { identifier: string; holderName: string }[];
}

/**
 * Thanh toán QR qua cổng mô phỏng (FR-18, ADR 004).
 *  - Khách tạo PaymentIntent (token ngẫu nhiên, hạn dùng QR_TTL_MINUTES, mặc định 5 phút).
 *  - Điện thoại mở link trong QR, chọn tài khoản thử và nhập PIN.
 *  - Xác nhận đi qua PaymentsService.settle với Idempotency-Key "qr-<token>": giữ kho trước,
 *    trừ số dư có điều kiện, chỉ thành công một lần.
 *  - Sai PIN, thiếu số dư, QR hết hạn: không trừ tiền.
 */
@Injectable()
export class QrPaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private get ttlMinutes(): number {
    const value = Number(this.config.get('QR_TTL_MINUTES') ?? 5);
    return Number.isFinite(value) && value > 0 ? value : 5;
  }

  /** URL web công khai: WEB_PUBLIC_URL, nếu không có thì origin đầu tiên của WEB_ORIGIN. */
  private get webUrl(): string {
    const explicit = this.config.get<string>('WEB_PUBLIC_URL');
    const fromOrigin = (this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').split(',')[0];
    return (explicit || fromOrigin).trim().replace(/\/$/, '');
  }

  /** Tạo mã QR cho đơn của chính khách; đơn đã có QR còn hạn thì trả lại mã đó. */
  async create(user: AuthUser, orderId: number): Promise<QrIntentView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== user.id) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!PAYABLE_STATUSES.includes(order.status)) {
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Đơn đã bị hủy, không thể thanh toán');
      throw new ConflictException('Đơn đã được thanh toán');
    }

    const now = new Date();
    const existing = await this.prisma.paymentIntent.findFirst({
      where: { orderId, status: IntentStatus.PENDING, expiresAt: { gt: now } },
      orderBy: { id: 'desc' },
    });
    const intent =
      existing ??
      (await this.prisma.paymentIntent.create({
        data: {
          token: randomBytes(16).toString('hex'),
          qrContent: '',
          orderId,
          amount: order.total,
          expiresAt: new Date(now.getTime() + this.ttlMinutes * 60_000),
        },
      }));
    const qrContent = `${this.webUrl}/pay/qr/${intent.token}`;
    if (intent.qrContent !== qrContent) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { qrContent } });
    }
    return {
      token: intent.token,
      orderId,
      amount: intent.amount,
      status: intent.status,
      expiresAt: intent.expiresAt,
      qrContent,
      qrImage: await QRCode.toDataURL(qrContent, { margin: 1, width: 280 }),
    };
  }

  /** Trang trên điện thoại (không cần đăng nhập): số tiền, trạng thái, tài khoản thử. Không lộ số dư. */
  async view(token: string): Promise<QrPublicView> {
    const intent = await this.expireIfNeeded(await this.findIntent(token));
    const accounts = await this.prisma.paymentAccount.findMany({
      orderBy: { id: 'asc' },
      select: { identifier: true, holderName: true },
    });
    return {
      token: intent.token,
      orderId: intent.orderId,
      amount: intent.amount,
      status: intent.status,
      expiresAt: intent.expiresAt,
      accounts,
    };
  }

  /** Khách xem trạng thái QR của đơn mình (trang thanh toán hỏi định kỳ để tự chuyển sang xác nhận). */
  async statusForOwner(user: AuthUser, token: string) {
    const intent = await this.expireIfNeeded(await this.findIntent(token));
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: intent.orderId } });
    if (order.userId !== user.id) throw new NotFoundException('Không tìm thấy mã QR');
    return { token: intent.token, orderId: intent.orderId, status: intent.status, orderStatus: order.status };
  }

  async confirm(token: string, accountIdentifier: string, pin: string): Promise<PaymentResult> {
    const intent = await this.expireIfNeeded(await this.findIntent(token));
    if (intent.status === IntentStatus.PAID) throw new ConflictException('Mã QR này đã được thanh toán');
    if (intent.status === IntentStatus.EXPIRED) throw new BadRequestException('Mã QR đã hết hạn, vui lòng tạo mã mới');
    if (intent.status !== IntentStatus.PENDING) {
      throw new BadRequestException('Mã QR không còn dùng được, vui lòng tạo mã mới');
    }

    // Sai tài khoản hoặc PIN: từ chối ngay, chưa giữ kho, chưa trừ tiền; cho nhập lại
    const account = await this.prisma.paymentAccount.findUnique({ where: { identifier: accountIdentifier } });
    if (!account || !(await bcrypt.compare(pin, account.pinHash))) {
      throw new BadRequestException('Sai tài khoản hoặc PIN');
    }

    const order = await this.prisma.order.findUnique({ where: { id: intent.orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    const { result } = await this.payments.settle({
      userId: order.userId,
      orderId: intent.orderId,
      method: PaymentMethod.QR,
      idempotencyKey: `qr-${intent.token}`,
      requestHash: createHash('sha256').update(JSON.stringify(['QR', intent.token, account.id])).digest('hex'),
      charge: async (amount) => {
        if (amount !== intent.amount) return { success: false, reason: 'Số tiền của đơn đã thay đổi, vui lòng tạo mã QR mới' };
        // Trừ số dư có điều kiện: hai lần xác nhận đồng thời không làm số dư âm
        const debited = await this.prisma.$executeRaw`
          UPDATE payment_accounts SET balance = balance - ${amount}
          WHERE id = ${account.id} AND balance >= ${amount}`;
        return debited === 1 ? { success: true } : { success: false, reason: 'Số dư tài khoản không đủ' };
      },
      onSuccess: async (tx) => {
        await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: IntentStatus.PENDING },
          data: { status: IntentStatus.PAID, accountId: account.id },
        });
      },
      onRefund: async (tx) => {
        await tx.$executeRaw`UPDATE payment_accounts SET balance = balance + ${intent.amount} WHERE id = ${account.id}`;
        await this.markFailed(tx, intent.id);
      },
    });

    // Thanh toán thất bại (thiếu số dư, hết nguyên liệu): mã QR này hết hiệu lực, khách tạo mã mới
    if (result.status === 'FAILED') await this.markFailed(this.prisma, intent.id);
    return result;
  }

  private async findIntent(token: string) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw new NotFoundException('Không tìm thấy mã QR');
    const intent = await this.prisma.paymentIntent.findUnique({ where: { token } });
    if (!intent) throw new NotFoundException('Không tìm thấy mã QR');
    return intent;
  }

  /** QR quá hạn mà vẫn PENDING thì chuyển EXPIRED. */
  private async expireIfNeeded<T extends { id: number; status: IntentStatus; expiresAt: Date }>(intent: T): Promise<T> {
    if (intent.status === IntentStatus.PENDING && intent.expiresAt.getTime() <= Date.now()) {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: IntentStatus.PENDING },
        data: { status: IntentStatus.EXPIRED },
      });
      return { ...intent, status: IntentStatus.EXPIRED };
    }
    return intent;
  }

  private async markFailed(client: Prisma.TransactionClient | PrismaService, intentId: number) {
    await client.paymentIntent.updateMany({
      where: { id: intentId, status: IntentStatus.PENDING },
      data: { status: IntentStatus.FAILED },
    });
  }
}
