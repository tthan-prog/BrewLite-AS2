import { expect, test } from '@playwright/test';
import { addFirstDrink, API_URL, goCheckout, login, registerAndLogin } from './helpers';

// E2E-T01: Menu lấy món từ API, mở được trang chi tiết (FR-01, FR-03).
test('E2E-T01: menu hiển thị món từ API và mở trang chi tiết', async ({ page }) => {
  await page.goto('/menu');
  await expect(page.getByRole('link', { name: 'Chọn món' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Chọn món' }).first().click();
  await expect(page).toHaveURL(/\/product\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

// E2E-T02: luồng chính đăng ký → chọn món nhiều topping → giỏ → thẻ bị từ chối → thử lại thành công → theo dõi đơn → lịch sử.
test('E2E-T02: đặt món nhiều topping, thanh toán thất bại rồi thành công, theo dõi đơn và lịch sử', async ({ page }) => {
  await registerAndLogin(page);
  await addFirstDrink(page, ['Trân châu đen', 'Thạch dừa']);
  await expect(page.getByText(/Trân châu đen, Thạch dừa/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeVisible();
  await goCheckout(page);

  await page.getByLabel('Thẻ ngân hàng (mô phỏng)').check();
  await page.getByPlaceholder('4242 4242 4242 4242').fill('4000 0000 0000 0002');
  await page.getByRole('button', { name: 'Thanh toán đơn hàng' }).click();
  await expect(page.getByText('Thẻ bị ngân hàng từ chối')).toBeVisible();

  await page.getByPlaceholder('4242 4242 4242 4242').fill('4242 4242 4242 4242');
  await page.getByRole('button', { name: 'Thanh toán đơn hàng' }).click();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Giỏ hàng (0)' })).toBeVisible();

  await page.getByRole('link', { name: 'Theo dõi đơn' }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/);
  await expect(page.getByText('Đã thanh toán').locator('xpath=ancestor::li')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('Thẻ (mô phỏng) · thành công')).toBeVisible();

  await page.goto('/orders/history');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('Đã thanh toán');
});

// E2E-T03: chưa đăng nhập thì thanh toán chuyển sang đăng nhập và giữ giỏ (FR-06).
test('E2E-T03: chưa đăng nhập bị chuyển sang /login, giỏ hàng vẫn giữ', async ({ page }) => {
  await addFirstDrink(page);
  await page.getByRole('link', { name: 'Tiếp tục thanh toán' }).click();
  await page.waitForURL(/\/login\?next=(%2F|\/)checkout/);
  await page.goto('/cart');
  await expect(page.locator('article')).toHaveCount(1);
});

// E2E-T04: thanh toán QR mô phỏng bằng trang xác nhận "trên điện thoại" (FR-18).
test('E2E-T04: thanh toán QR bằng tài khoản thử, trang thanh toán tự chuyển sang thành công', async ({ page, context }) => {
  await registerAndLogin(page);
  await addFirstDrink(page);
  await goCheckout(page);
  await page.getByLabel('Thanh toán QR').check();
  await page.getByRole('button', { name: 'Thanh toán đơn hàng' }).click();
  await expect(page.getByRole('img', { name: /Mã QR thanh toán đơn #\d+/ })).toBeVisible();

  const [phone] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Mở trang xác nhận trên máy này' }).click()]);
  await phone.getByLabel(/TEST-0001/).check();
  await phone.fill('#qr-pin', '123456');
  await phone.getByRole('button', { name: /^Thanh toán/ }).click();
  await expect(phone.getByText(/thành công/i).first()).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible({ timeout: 20_000 });
});

// E2E-T05: nhân viên vào thẳng quầy, xem công thức; nhập kho thì số ly tăng ngay (FR-16, FR-17).
test('E2E-T05: nhân viên xem công thức, nhập kho làm số ly tăng', async ({ page }) => {
  await login(page, 'staff@brewlite.test', 'Staff@123');
  await page.waitForURL('**/staff');
  await expect(page.getByRole('link', { name: 'Quầy nhân viên' })).toHaveCount(0); // header khách ẩn ở trang nhân viên
  await page.getByRole('link', { name: 'Công thức & số ly' }).click();
  const card = page.getByRole('article', { name: 'Cà phê đen đá' });
  await expect(card).toContainText('Giới hạn bởi');
  const before = Number(await card.getByLabel('Số ly làm được của Cà phê đen đá').locator('span').first().locator('span').textContent().then((t) => t?.replace(/\./g, '')));
  const input = card.getByRole('spinbutton');
  const unit = await input.getAttribute('placeholder');
  await input.fill('2000');
  await card.getByRole('button', { name: 'Nhập thêm' }).click();
  await expect(page.getByText(new RegExp(`Đã nhập thêm 2000 ${unit}`))).toBeVisible();
  const after = Number(await card.getByLabel('Số ly làm được của Cà phê đen đá').locator('span').first().locator('span').textContent().then((t) => t?.replace(/\./g, '')));
  expect(after).toBeGreaterThan(before);
});

// E2E-T06: giao diện điện thoại không cuộn ngang; manifest PWA và biểu tượng tải được (NFR-05).
test.describe('Điện thoại và PWA', () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

  test('E2E-T06a: trang chủ, menu, giỏ hàng không cuộn ngang trên màn hình 375px', async ({ page }) => {
    for (const path of ['/', '/menu', '/cart']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `trang ${path} bị cuộn ngang`).toBeLessThanOrEqual(1);
    }
  });

  test('E2E-T06b: manifest hợp lệ và biểu tượng tải được', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ short_name: 'BrewLite', display: 'standalone', start_url: '/menu' });
    expect((await request.get(manifest.icons[0].src)).ok()).toBe(true);
  });
});

// E2E-T07: API kiểm tra số ly theo size, không lộ tồn kho (gọi thẳng API như trình duyệt).
test('E2E-T07: availability giới hạn 50 ly mỗi dòng và không trả tồn kho', async ({ request }) => {
  const products = await (await request.get(`${API_URL}/products`)).json();
  const res = await request.post(`${API_URL}/products/availability`, { data: { items: [{ productId: products[0].id, quantity: 1, size: 'L' }] } });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.lines[0].maxQuantity).toBeLessThanOrEqual(50);
  expect(JSON.stringify(body)).not.toContain('stock');
});
