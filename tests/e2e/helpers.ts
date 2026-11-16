import { expect, type Page } from '@playwright/test';

export const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/** Email mới mỗi lần chạy để không phụ thuộc dữ liệu cũ. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`;
}

export async function registerAndLogin(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto('/register');
  await page.fill('#name', 'Khách E2E');
  await page.fill('#email', email);
  await page.fill('#password', 'secret123');
  await page.fill('#confirm', 'secret123');
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(page.getByText('Đăng ký thành công. Bạn có thể đăng nhập.')).toBeVisible();
  await login(page, email, 'secret123');
  await page.waitForURL('**/menu');
  return email;
}

export async function login(page: Page, email: string, password: string, next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.locator('form').getByRole('button', { name: 'Đăng nhập' }).click();
}

/** Mở món đầu tiên còn hàng từ Menu, chọn topping (nếu có) và thêm vào giỏ. */
export async function addFirstDrink(page: Page, toppings: string[] = []): Promise<string> {
  await page.goto('/menu');
  const first = page.getByRole('link', { name: 'Chọn món' }).first();
  await first.click();
  const name = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  for (const t of toppings) await page.getByRole('button', { name: new RegExp(t) }).click();
  await expect(page.getByText('Đang kiểm tra nguyên liệu...')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await page.waitForURL('**/cart');
  return name;
}

/** Từ giỏ hàng sang trang thanh toán (đăng nhập sẵn). */
export async function goCheckout(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Tiếp tục thanh toán' })).toBeVisible();
  await page.getByRole('link', { name: 'Tiếp tục thanh toán' }).click();
  await page.waitForURL('**/checkout');
}
