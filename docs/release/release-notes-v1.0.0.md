# Release notes – BrewLite AS2 v1.0.0

> **Bản nháp.** Phát hành khi giao diện khách hàng (PR #12 của Giản Thiên Lực, PR #19 của Hà Thiên Long) đã merge và pipeline CD của tag `v1.0.0` xanh. Các mục đánh dấu ⏳ cập nhật lúc đó.

- **Ngày phát hành:** ⏳
- **Tag:** `v1.0.0` ⏳
- **Repository:** https://github.com/tthan-prog/BrewLite-AS2

## Truy cập production

| Thành phần | URL |
|---|---|
| Web (HTTPS) | https://brewlite-as2-web.onrender.com |
| API | https://brewlite-as2-api-k8xj.onrender.com |
| Health check | https://brewlite-as2-api-k8xj.onrender.com/health |

Gói Free của Render tắt dịch vụ khi không có truy cập: lần mở đầu có thể chậm khoảng 50 giây. Trước khi chấm hoặc demo, mở `/health` và trang web trước 1 phút.

Tài khoản thử (dữ liệu seed, chỉ dùng để kiểm thử):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `customer@brewlite.test` | `Customer@123` |
| Nhân viên | `staff@brewlite.test` | `Staff@123` |

Thẻ thử: `4242 4242 4242 4242` (thành công), `4000 0000 0000 0002` (bị từ chối). Tài khoản QR thử: `TEST-0001` (số dư 1.000.000đ), `TEST-0002` (10.000đ), PIN `123456`. Mã khuyến mãi: `GIAM10` (giảm 10%, đơn từ 50.000đ), `GIAM20K`, `HETHAN` (đã hết hạn).

## Tính năng

| User story | Nội dung | API | Giao diện |
|---|---|---|---|
| US-01, US-02 | Menu, chi tiết món với size, topping, đường, đá; số ly tối đa theo nguyên liệu | PR #17 | PR #11, PR #12 ⏳ |
| US-06 | Giỏ hàng, tổng tiền, tối đa 50 ly mỗi dòng | – | PR #12 ⏳ |
| US-07 | Đăng ký, đăng nhập JWT, chặn đặt đơn khi chưa đăng nhập | PR #42 | PR #19 ⏳ |
| US-08, US-13 | Tạo đơn, kiểm tra đủ nguyên liệu cho cả đơn, mã khuyến mãi | PR #42 | PR #12 ⏳ |
| US-09 | Thanh toán Ví/Thẻ mô phỏng, `Idempotency-Key`, thử lại khi thất bại | PR #42 | PR #12 ⏳ |
| US-10 | Không bán vượt nguyên liệu khi thanh toán đồng thời | PR #42 | – |
| US-11 | Xác nhận, trạng thái, lịch sử đơn | PR #42 | PR #19 ⏳ |
| US-12, US-15 | Nhân viên đổi trạng thái đơn, xem và nhập kho | PR #42, #44 | PR #48 (`/staff`, `/staff/ingredients`) |
| US-16 | Thanh toán QR mô phỏng: mã QR có hạn, xác nhận trên điện thoại bằng tài khoản thử và PIN | PR ⏳ | `/pay/qr/[token]`, `QrPaymentPanel` (gắn vào trang thanh toán ⏳) |
| US-14, US-17 | Cộng điểm khi thanh toán, đổi điểm lấy mã quà | PR #42, #44 | PR #12 ⏳ |
| US-18 | Đơn chưa thanh toán tự hủy sau 15 phút | PR #44 | – |
| US-21 | CI/CD: GHCR, Render, smoke test, rollback | PR #43, #46 | – |

Chưa có trong v1.0.0 ⏳: US-19 VNPay sandbox (cập nhật nếu kịp merge).

## Kiểm thử

| Loại | Số test | Lệnh |
|---|---|---|
| Unit API | 49 | `npm test -w apps/api` |
| Unit web | 5 ⏳ (14 sau PR #12) | `npm test -w apps/web` |
| E2E API (Prisma giả) | 16 | `npm run test:e2e -w apps/api` |
| Integration API (PostgreSQL thật) | 37 | `npm run test:int -w apps/api` |
| End-to-end giao diện | ⏳ (US-20) | – |

Test tích hợp gồm: thanh toán idempotent, 8 khách thanh toán đồng thời khi kho chỉ đủ 5 ly, kho hết đúng lúc thanh toán, hoàn kho khi hủy đơn đã thanh toán, đổi quà đồng thời không làm âm điểm, tự hủy đơn quá hạn. CI chạy toàn bộ với PostgreSQL trong service container.

## Triển khai và rollback

- Push tag `v*` chạy `.github/workflows/cd.yml`: CI → build image API và Web (tag phiên bản, `sha-<commit>`, `latest`) → push GHCR → đánh thức dịch vụ → deploy hook Render → smoke test (`/health` đúng phiên bản và `db: up`, `/products`, trang `/` và `/menu`).
- Migration chạy bằng `prisma migrate deploy` mỗi lần API khởi động; chỉ áp migration chưa áp.
- **Rollback:** Actions → CD → Run workflow, nhập tag cũ (ví dụ `v0.9.2`). Hoặc trên Render: dịch vụ → Events → Rollback.
- Database production không nhận kết nối từ Internet (Inbound IP Rules trống); secret chỉ nằm trên Render và GitHub Secrets.

Chi tiết: [docs/deployment.md](../deployment.md), [docs/deploy/runbook.md](../deploy/runbook.md).

## Hạn chế đã biết

- Gói Free của Render ngủ khi không có truy cập; database Free có thời hạn sử dụng theo chính sách của Render.
- Cổng Ví/Thẻ là mô phỏng, không có tiền thật (FR-23 nằm ngoài phạm vi).
- JWT không thu hồi được trước khi hết hạn (ADR 006); thời hạn mặc định 1 ngày.
