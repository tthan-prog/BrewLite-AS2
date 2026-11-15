import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    env: { JWT_SECRET: 'e2e-test-secret', ORDER_EXPIRY_INTERVAL_MS: '0' },
  },
});
