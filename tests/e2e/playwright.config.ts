import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (US-20) chạy trên hệ thống thật: web Next.js (BASE_URL) gọi API NestJS + PostgreSQL đã migrate và seed.
 * CI khởi động API, web rồi mới chạy (xem .github/workflows/ci.yml, job "E2E (Playwright)").
 * Chạy trên máy: xem tests/e2e/README.md.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
