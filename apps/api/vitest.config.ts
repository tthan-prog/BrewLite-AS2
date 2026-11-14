import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC giữ decorator metadata cho dependency injection của NestJS khi chạy test.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
