import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client dùng chung (ADR 003). Kết nối được mở khi có truy vấn đầu tiên,
 * nên API vẫn khởi động được khi database tạm thời chưa sẵn sàng; /health sẽ báo db down.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
