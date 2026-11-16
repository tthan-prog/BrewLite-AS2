# Test E2E (Playwright)

Kịch bản trên trình duyệt thật cho luồng chính (US-20). Chạy trên API, web và PostgreSQL thật; dữ liệu seed cung cấp món, tài khoản nhân viên và tài khoản QR thử.

| Mã | Kịch bản |
|---|---|
| E2E-T01 | Menu hiển thị món từ API, mở trang chi tiết |
| E2E-T02 | Đăng ký, đăng nhập, chọn món 2 topping, thẻ bị từ chối rồi thử lại thành công, trang theo dõi đơn, lịch sử |
| E2E-T03 | Chưa đăng nhập thì chuyển sang `/login`, giỏ hàng vẫn giữ |
| E2E-T04 | Thanh toán QR: mở trang xác nhận, chọn `TEST-0001`, PIN `123456`; trang thanh toán tự báo thành công |
| E2E-T05 | Nhân viên vào thẳng `/staff`, xem công thức, nhập kho làm số ly tăng |
| E2E-T06 | Màn hình 375px không cuộn ngang; manifest PWA và biểu tượng tải được |
| E2E-T07 | `POST /products/availability` giới hạn 50 ly, không trả tồn kho |

## Chạy trên máy

Test **thay đổi dữ liệu** (tạo tài khoản, đơn, nhập kho): dùng database riêng, không dùng production.

```bash
# 1. Database riêng, migrate và seed
docker compose up -d db
docker compose exec db createdb -U brewlite brewlite_e2e
export DATABASE_URL="postgresql://brewlite:brewlite@localhost:5432/brewlite_e2e?schema=public"
cd apps/api && npx prisma migrate deploy && npm run db:seed && cd ../..

# 2. Build và chạy API (cổng 3001) và web (cổng 3000)
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run build
JWT_SECRET=dev-secret WEB_ORIGIN=http://localhost:3000 node apps/api/dist/main.js &
npm run start -w apps/web &

# 3. Playwright
cd tests/e2e
npm ci
npx playwright install chromium
npx playwright test          # hoặc: npx playwright test --headed
```

PowerShell: đặt biến môi trường bằng `$env:DATABASE_URL="..."` và chạy API, web ở hai cửa sổ riêng.

Biến tùy chọn: `BASE_URL` (mặc định `http://localhost:3000`), `API_URL` (mặc định `http://localhost:3001`), `CHROME_PATH` (dùng Chrome có sẵn thay cho Chromium của Playwright).
