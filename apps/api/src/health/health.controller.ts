import { Inject, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  /** Phiên bản image đang chạy (APP_VERSION gắn lúc build), dùng cho smoke test sau deploy. */
  version: string;
  uptime: number;
  timestamp: string;
}

/** GET /health (NFR-09, ADR 008): kiểm tra API và kết nối database. */
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return {
      status: 'ok',
      db: 'up',
      version: process.env.APP_VERSION ?? 'dev',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
