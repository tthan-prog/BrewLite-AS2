import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuthUser } from '../auth/auth-user';
import { consumeStock, IngredientUse, restoreStock } from '../inventory/stock';
import { earnPoints } from '../loyalty/loyalty';
import { PAYABLE_STATUSES } from '../orders/order-status';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ChargeResult, PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

export interface PaymentResult {
  paymentId: number;
  orderId: number;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  orderStatus: OrderStatus;
  failureReason: string | null;
  pointsEarned: number;
  createdAt: Date;
}

/** Dữ liệu chung của một bản ghi Payment, chưa có status. */
type PaymentBase = Omit<Prisma.PaymentUncheckedCreateInput, 'status' | 'id' | 'createdAt'>;

/** Một yêu cầu thanh toán đi qua luồng chung (Ví/Thẻ hoặc QR). */
export interface SettleRequest {
  userId: number;
  orderId: number;
  method: PaymentMethod;
  idempotencyKey: string;
  requestHash: string;
  /** Trừ tiền với số tiền của đơn. */
  charge: (amount: number) => Promise<ChargeResult>;
  /** Chạy trong transaction chốt sau khi đơn chuyển PAID. */
  onSuccess?: (tx: Prisma.TransactionClient) => Promise<void>;
  /** Đã trừ tiền nhưng đơn không còn chờ thanh toán (bị hủy giữa chừng): hoàn tiền. */
  onRefund?: (tx: Prisma.TransactionClient) => Promise<void>;
}

/** Dùng nội bộ để rollback transaction giữ kho khi một nguyên liệu không đủ. */
class OutOfStock extends Error {
  constructor(readonly ingredientId: number) {
    super('out of stock');
  }
}

/**
 * Thanh toán đơn (UC-01, sequence diagram checkout):
 *  1. Idempotency-Key đã dùng với cùng nội dung → trả lại kết quả cũ, không tạo Payment mới (FR-09).
 *  2. Transaction 1: khóa phần nguyên liệu của đơn và trừ kho có điều kiện TRƯỚC khi gọi cổng (FR-12).
 *     Thiếu kho → không gọi cổng (không trừ tiền), đơn PAYMENT_FAILED kèm lý do.
 *  3. Gọi cổng thanh toán mô phỏng.
 *  4. Transaction 2: thành công → PAID, Payment SUCCESS, cộng điểm (FR-14);
 *     thất bại → hoàn kho, PAYMENT_FAILED, Payment FAILED (khách thử lại bằng khóa mới).
 */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async pay(
    user: AuthUser,
    dto: CreatePaymentDto,
    idempotencyKey: string | undefined,
  ): Promise<{ result: PaymentResult; replayed: boolean }> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Thiếu hoặc sai header Idempotency-Key (8–100 ký tự: chữ, số, - hoặc _)');
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify([dto.orderId, dto.method, dto.cardNumber ?? null]))
      .digest('hex');

    return this.settle({
      userId: user.id,
      orderId: dto.orderId,
      method: dto.method as PaymentMethod,
      idempotencyKey,
      requestHash,
      charge: (amount) =>
        this.gateway.charge({ orderId: dto.orderId, method: dto.method, amount, cardNumber: dto.cardNumber }),
    });
  }

  /**
   * Luồng thanh toán dùng chung cho Ví/Thẻ và QR (UC-01):
   *  1. Khóa (userId, idempotencyKey) đã có → trả lại kết quả cũ (FR-09).
   *  2. Transaction 1: giữ nguyên liệu bằng trừ kho có điều kiện TRƯỚC khi trừ tiền (FR-12).
   *  3. Gọi charge (cổng Ví/Thẻ, hoặc trừ số dư tài khoản QR).
   *  4. Transaction 2: thành công → PAID, Payment SUCCESS, cộng điểm, onSuccess;
   *     thất bại → hoàn kho, PAYMENT_FAILED; đơn đã bị hủy giữa chừng → hoàn kho, onRefund.
   */
  async settle(req: SettleRequest): Promise<{ result: PaymentResult; replayed: boolean }> {
    const previous = await this.findByKey(req.userId, req.idempotencyKey);
    if (previous) {
      if (previous.requestHash !== req.requestHash) {
        throw new ConflictException('Idempotency-Key này đã được dùng cho một yêu cầu thanh toán khác');
      }
      return { result: await this.toResult(previous.id), replayed: true };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: req.orderId },
      include: { ingredientUses: true },
    });
    if (!order || order.userId !== req.userId) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!PAYABLE_STATUSES.includes(order.status)) {
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Đơn đã bị hủy, không thể thanh toán');
      throw new ConflictException('Đơn đã được thanh toán');
    }
    const uses: IngredientUse[] = order.ingredientUses.map((u) => ({
      ingredientId: u.ingredientId,
      quantity: u.quantity,
    }));
    const base: PaymentBase = {
      orderId: order.id,
      userId: req.userId,
      method: req.method,
      amount: order.total,
      idempotencyKey: req.idempotencyKey,
      requestHash: req.requestHash,
    };

    // --- Bước 1: giữ nguyên liệu (trừ kho có điều kiện) ---
    try {
      await this.prisma.$transaction(async (tx) => {
        // Đánh dấu consumed như một khóa: yêu cầu thanh toán thứ hai cho cùng đơn sẽ không giành được
        const claimed = await tx.orderIngredientUse.updateMany({
          where: { orderId: order.id, consumed: false },
          data: { consumed: true },
        });
        if (claimed.count !== uses.length) {
          throw new ConflictException('Đơn đang được xử lý thanh toán ở một yêu cầu khác, vui lòng thử lại sau');
        }
        const failedIngredient = await consumeStock(tx, uses);
        if (failedIngredient !== null) throw new OutOfStock(failedIngredient);
      });
    } catch (e) {
      if (!(e instanceof OutOfStock)) throw e;
      const ingredient = await this.prisma.ingredient.findUnique({ where: { id: e.ingredientId } });
      const reason = `Nguyên liệu vừa hết (${ingredient?.name ?? 'không rõ'}), chưa trừ tiền`;
      const payment = await this.prisma.$transaction((tx) => this.recordFailure(tx, base, reason, null));
      return { result: await this.toResult(payment.id), replayed: false };
    }

    // --- Bước 2: trừ tiền ---
    let charge: ChargeResult;
    try {
      charge = await req.charge(order.total);
    } catch {
      charge = { success: false, reason: 'Cổng thanh toán không phản hồi' };
    }

    // --- Bước 3: chốt kết quả ---
    const paymentId = await this.prisma.$transaction(async (tx) => {
      if (!charge.success) {
        return (await this.recordFailure(tx, base, charge.reason ?? 'Thanh toán thất bại', uses)).id;
      }
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...PAYABLE_STATUSES] } },
        data: { status: OrderStatus.PAID, failureReason: null },
      });
      if (moved.count === 0) {
        // Đơn bị hủy trong lúc thanh toán: hoàn tiền, hoàn lại kho
        await restoreStock(tx, uses);
        await tx.orderIngredientUse.updateMany({ where: { orderId: order.id }, data: { consumed: false } });
        await req.onRefund?.(tx);
        return (await tx.payment.create({ data: { ...base, status: PaymentStatus.FAILED } })).id;
      }
      const payment = await tx.payment.create({ data: { ...base, status: PaymentStatus.SUCCESS } });
      await earnPoints(tx, req.userId, order.id, order.total);
      await req.onSuccess?.(tx);
      return payment.id;
    });
    return { result: await this.toResult(paymentId), replayed: false };
  }

  /** Ghi Payment FAILED, đơn PAYMENT_FAILED kèm lý do; nếu đã giữ kho thì hoàn lại. */
  private async recordFailure(
    tx: Prisma.TransactionClient,
    base: PaymentBase,
    reason: string,
    reserved: IngredientUse[] | null,
  ) {
    if (reserved) {
      await restoreStock(tx, reserved);
      await tx.orderIngredientUse.updateMany({ where: { orderId: base.orderId }, data: { consumed: false } });
    }
    await tx.order.updateMany({
      where: { id: base.orderId, status: { in: [...PAYABLE_STATUSES] } },
      data: { status: OrderStatus.PAYMENT_FAILED, failureReason: reason },
    });
    return tx.payment.create({ data: { ...base, status: PaymentStatus.FAILED } });
  }

  private findByKey(userId: number, idempotencyKey: string) {
    return this.prisma.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  private async toResult(paymentId: number): Promise<PaymentResult> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            status: true,
            failureReason: true,
            loyalty: { where: { type: 'EARN' }, select: { points: true } },
          },
        },
      },
    });
    const succeeded = payment.status === PaymentStatus.SUCCESS;
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      orderStatus: payment.order.status,
      failureReason: succeeded ? null : payment.order.failureReason,
      pointsEarned: succeeded ? (payment.order.loyalty[0]?.points ?? 0) : 0,
      createdAt: payment.createdAt,
    };
  }
}
