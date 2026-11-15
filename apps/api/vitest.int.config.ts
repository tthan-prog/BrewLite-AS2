import { defineConfig } from 'vitest/config';

// Test tích hợp dùng PostgreSQL thật (DATABASE_URL), đã chạy `prisma migrate deploy`.
// Các file chạy tuần tự vì cùng dùng một database và mỗi file tự xóa dữ liệu.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.int-spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: { JWT_SECRET: 'integration-test-secret' },
  },
});
