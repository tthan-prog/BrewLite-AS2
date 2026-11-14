import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

/**
 * GET /health (NFR-09, ADR 008).
 * Kiểm tra kết nối database được bổ sung khi có PrismaService (Task 4.3).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
