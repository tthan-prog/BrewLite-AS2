# ADR 008: Cấu hình, logging và health check

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Hệ thống chạy ở ba môi trường (local, CI, production) với cấu hình khác nhau. Cần log để vận hành và `/health` cho smoke test (NFR-03, NFR-09).

## Quyết định

- **Cấu hình:** đọc từ biến môi trường bằng `@nestjs/config`, kiểm tra biến bắt buộc khi khởi động (thiếu thì dừng với thông báo rõ). Repository có `.env.example`; `.env` nằm trong `.gitignore`. Web đọc URL API qua `NEXT_PUBLIC_API_URL`.
- **Logging:** Logger của NestJS; middleware ghi mỗi request (method, path, status, thời gian xử lý). Không ghi mật khẩu, PIN, JWT, chữ ký thanh toán. Log xuất ra stdout để Docker và Render thu thập.
- **Health check:** `GET /health` trả `{ "status": "ok", "db": "up" }` sau khi chạy `SELECT 1`; database lỗi thì trả 503. Dùng cho health check của Render và smoke test trong CD.

## Hệ quả

- Cùng một image chạy được ở mọi môi trường, chỉ khác biến môi trường.
- Hạn chế: log dạng văn bản, chưa có hệ thống tập trung và cảnh báo; đủ cho phạm vi dự án.

## Phương án đã cân nhắc

- **File cấu hình theo môi trường trong repository:** dễ lộ secret. Không chọn.
