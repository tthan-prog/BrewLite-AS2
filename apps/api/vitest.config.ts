import { defineConfig } from 'vitest/config';

// Không dùng plugin SWC (binary native có thể bị Windows Smart App Control chặn).
// Các constructor dùng @Inject() tường minh nên DI không phụ thuộc decorator metadata.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
