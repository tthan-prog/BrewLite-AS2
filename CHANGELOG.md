# Changelog

Ghi theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và [Semantic Versioning](https://semver.org/lang/vi/). Mỗi phiên bản là một tag Git; tag `v*` chạy pipeline CD (`.github/workflows/cd.yml`).

## [Chưa phát hành] – dự kiến v1.0.0

### Thêm
- Trang nhân viên `/staff` (xử lý đơn theo trạng thái) và `/staff/ingredients` (kho nguyên liệu, nhập thêm) (PR #48).
- Thanh toán QR mô phỏng: `POST /payments/qr`, trang xác nhận trên điện thoại `/pay/qr/[token]`, thành phần `QrPaymentPanel` (US-16, PR #49).
- VNPay sandbox: `POST /payments/vnpay`, Return URL và IPN kiểm tra chữ ký HMAC-SHA512 và số tiền, trang `/checkout/vnpay-return`, thành phần `VnpayButton` (US-19).

Đang chờ merge giao diện khách hàng (PR #12, #19). Chi tiết: [docs/release/release-notes-v1.0.0.md](docs/release/release-notes-v1.0.0.md).

## [v0.9.2] – 16/11/2026

### Sửa
- CD: đánh thức dịch vụ Render (gói Free) trước khi gọi deploy hook; smoke test chờ tối đa 15 phút (PR #46). Lần chạy `v0.9.1` bị smoke test chặn vì yêu cầu đầu tiên đánh thức bản cũ.

## [v0.9.1] – 16/11/2026

Lần chạy đầu tiên có bước deploy và smoke test. Image và deploy đúng, smoke test báo lỗi (xem v0.9.2). Không có thay đổi mã nguồn so với v0.9.0.

## [v0.9.0] – 15/11/2026

Image khởi tạo trên GHCR để tạo dịch vụ Render.

### Thêm
- API xác thực: `POST /auth/register`, `POST /auth/login` (JWT, bcrypt), `GET /auth/me` (PR #42).
- API đơn hàng: tạo đơn với kiểm tra nguyên liệu và mã khuyến mãi, lịch sử, chi tiết, nhân viên đổi trạng thái theo máy trạng thái (PR #42).
- API thanh toán Ví/Thẻ mô phỏng với `Idempotency-Key`, trừ kho có điều kiện trước khi gọi cổng, hoàn kho khi thất bại, cộng và trừ điểm thưởng (PR #42).
- API kho nguyên liệu cho nhân viên, đổi điểm lấy quà, tự hủy đơn chưa thanh toán sau 15 phút (PR #44).
- CI chạy thêm test e2e và test tích hợp với PostgreSQL thật (PR #42).
- Pipeline CD: build image, push GHCR, deploy Render, smoke test, rollback bằng tag cũ (PR #43).
- `/health` trả thêm `version` (PR #43).

## Sprint 1 (Task 4) – 15/11/2026

Không gắn tag. Gồm khung repository và CI (PR #9), menu (PR #11), Prisma schema, migration và seed (PR #15), `GET /products`, `GET /products/:id`, `/health` (PR #17), Product Backlog (PR #14).
