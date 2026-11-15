import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

const withDb = (queryRaw: ReturnType<typeof vi.fn>) =>
  new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

describe('HealthController', () => {
  it('trả status ok, db up kèm uptime và timestamp', async () => {
    const result = await withDb(vi.fn().mockResolvedValue([{ '?column?': 1 }])).check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
    expect(result.version).toBe(process.env.APP_VERSION ?? 'dev');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('trả 503 khi database không phản hồi', async () => {
    const check = withDb(vi.fn().mockRejectedValue(new Error('connection refused'))).check();
    await expect(check).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
