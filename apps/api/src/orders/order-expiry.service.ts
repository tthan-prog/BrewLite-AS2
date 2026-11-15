import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const EXPIRED_REASON = 'Quá hạn thanh toán, đơn tự hủy';

/**
 * Tự hủy đơn PENDING quá hạn (FR-20). Thời hạn: ORDER_TIMEOUT_MINUTES (mặc định 15).
 * Chu kỳ quét: ORDER_EXPIRY_INTERVAL_MS (mặc định 60 giây; 0 để tắt, dùng trong test).
 * Chỉ trả lại lượt dùng mã khuyến mãi, không đụng tới kho (đơn PENDING chưa trừ kho).
 */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OrderExpiry');
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  get timeoutMinutes(): number {
    const value = Number(this.config.get('ORDER_TIMEOUT_MINUTES') ?? 15);
    return Number.isFinite(value) && value > 0 ? value : 15;
  }

  onModuleInit(): void {
    const interval = Number(this.config.get('ORDER_EXPIRY_INTERVAL_MS') ?? 60_000);
    if (!Number.isFinite(interval) || interval <= 0) return;
    this.timer = setInterval(() => {
      this.cancelExpired().catch((e: unknown) => this.logger.error(`Lỗi khi hủy đơn quá hạn: ${String(e)}`));
    }, interval);
    // Không giữ tiến trình sống chỉ vì bộ hẹn giờ
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Hủy các đơn PENDING tạo trước (now - thời hạn). Trả về id các đơn đã hủy. */
  async cancelExpired(now: Date = new Date()): Promise<number[]> {
    const cutoff = new Date(now.getTime() - this.timeoutMinutes * 60_000);
    const expired = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true, promotionId: true },
      orderBy: { id: 'asc' },
      take: 100,
    });
    const cancelled: number[] = [];
    for (const order of expired) {
      const done = await this.prisma.$transaction(async (tx) => {
        // Có điều kiện: nếu đơn vừa được thanh toán thì không hủy
        const moved = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED, failureReason: EXPIRED_REASON },
        });
        if (moved.count === 0) return false;
        if (order.promotionId !== null) {
          await tx.$executeRaw`
            UPDATE promotions SET used_count = GREATEST(used_count - 1, 0) WHERE id = ${order.promotionId}`;
        }
        return true;
      });
      if (done) cancelled.push(order.id);
    }
    if (cancelled.length > 0) this.logger.log(`Đã tự hủy ${cancelled.length} đơn quá hạn: ${cancelled.join(', ')}`);
    return cancelled;
  }
}
