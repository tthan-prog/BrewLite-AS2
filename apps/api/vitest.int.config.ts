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
    env: { JWT_SECRET: 'integration-test-secret', ORDER_EXPIRY_INTERVAL_MS: '0',
      // Cấu hình VNPay giả chỉ dùng trong test (không phải thông tin sandbox thật)
      VNPAY_TMN_CODE: 'TESTTMN1',
      VNPAY_HASH_SECRET: 'integration-test-vnpay-secret',
      VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'http://localhost:3000/checkout/vnpay-return',
    },
  },
});
