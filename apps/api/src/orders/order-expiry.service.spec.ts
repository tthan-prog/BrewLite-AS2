import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrderExpiryService } from './order-expiry.service';

describe('OrderExpiryService (FR-20)', () => {
  const make = (env: Record<string, string | undefined>, prisma: unknown = {}) =>
    new OrderExpiryService(prisma as PrismaService, { get: (k: string) => env[k] } as unknown as ConfigService);

  it('thời hạn mặc định 15 phút, đọc được từ cấu hình, bỏ qua giá trị sai', () => {
    expect(make({}).timeoutMinutes).toBe(15);
    expect(make({ ORDER_TIMEOUT_MINUTES: '30' }).timeoutMinutes).toBe(30);
    expect(make({ ORDER_TIMEOUT_MINUTES: 'abc' }).timeoutMinutes).toBe(15);
  });

  it('chỉ tìm đơn PENDING tạo trước mốc (now - thời hạn)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = make({ ORDER_TIMEOUT_MINUTES: '15' }, { order: { findMany } });
    await service.cancelExpired(new Date('2026-11-15T10:30:00Z'));
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      createdAt: { lt: new Date('2026-11-15T10:15:00Z') },
    });
  });

  it('ORDER_EXPIRY_INTERVAL_MS=0 thì không bật bộ hẹn giờ', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    make({ ORDER_EXPIRY_INTERVAL_MS: '0' }).onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
