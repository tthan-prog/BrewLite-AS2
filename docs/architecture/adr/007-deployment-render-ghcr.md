# ADR 007: Triển khai bằng Docker, GHCR và Render; CI/CD bằng GitHub Actions

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Đề yêu cầu production truy cập được qua HTTPS, có container registry, pipeline CD (build image → push registry → deploy → smoke test) và cách rollback. Nhóm không có máy chủ riêng.

## Quyết định

- **Local:** `docker compose up` chạy `db` (PostgreSQL, cổng 5432), `api` (cổng 3001), `web` (cổng 3000).
- **CI** (GitHub Actions, mỗi PR và push lên `main`): Install → Lint → Unit test → Build.
- **CD** (push tag `v*` lên `main`):
  1. Lint và test.
  2. Build image `api` và `web`, gắn tag theo phiên bản và commit SHA.
  3. Push lên **GitHub Container Registry (GHCR)**.
  4. Gọi deploy hook của **Render** để triển khai image mới.
  5. Smoke test: gọi `GET /health` của API và trang chủ web; thất bại thì báo lỗi pipeline.
- **Production trên Render** (tên miền mới, không dùng lại dịch vụ của bản trước):
  - Web Service `brewlite-as2-web` (image Next.js).
  - Web Service `brewlite-as2-api` (image NestJS, health check `/health`).
  - Render PostgreSQL có lưu trữ bền vững, chỉ nhận kết nối nội bộ.
- **Secret:** biến môi trường trên Render (`DATABASE_URL`, `JWT_SECRET`, cấu hình VNPay sandbox) và GitHub Secrets (token GHCR, deploy hook). Không lưu trong repository.
- **Rollback:** triển khai lại image của phiên bản trước (tag cũ trên GHCR) qua deploy hook, hoặc dùng chức năng rollback của Render. Migration chỉ thêm, không xóa cột trong cùng phiên bản để rollback image an toàn.

## Hệ quả

- Image đã test là image được triển khai; truy vết được phiên bản qua tag.
- HTTPS và log có sẵn trên Render.
- Hạn chế: gói miễn phí của Render có thể ngủ khi không có truy cập, lần gọi đầu chậm; cần đánh thức trước khi demo.

## Phương án đã cân nhắc

- **Render tự build từ repository:** đơn giản hơn nhưng không có bước registry như đề yêu cầu. Không chọn.
- **VPS tự quản:** chủ động hơn nhưng tốn công cấu hình HTTPS, bảo mật và sao lưu. Không chọn.
