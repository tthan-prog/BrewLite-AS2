# ADR 001: Monorepo cho frontend, backend và tài liệu

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Hệ thống có frontend Next.js, backend NestJS và bộ tài liệu Task 1–5. Đề yêu cầu cấu trúc repository gồm `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`. Nhóm 4 người cần review chung và một pipeline CI/CD.

## Quyết định

Dùng **một repository** (monorepo) với npm workspaces:

- `apps/web`: Next.js.
- `apps/api`: NestJS và Prisma.
- `docs/`: tài liệu yêu cầu, sơ đồ, kiến trúc, truy vết, triển khai.
- `tests/`: test tích hợp và end-to-end.
- `docker-compose.yml`, `.env.example`, `.github/workflows/` ở thư mục gốc.

## Hệ quả

- Một PR có thể thay đổi đồng thời API, giao diện và tài liệu, giúp truy vết yêu cầu → mã → test.
- CI chạy lint, test, build cho cả hai ứng dụng trong cùng workflow.
- Mỗi ứng dụng có Dockerfile riêng để build và triển khai độc lập.
- Hạn chế: thời gian CI tăng khi cả hai ứng dụng cùng build; có thể giảm bằng cache phụ thuộc.

## Phương án đã cân nhắc

- **Hai repository riêng cho web và api:** tách quyền và pipeline rõ hơn, nhưng khó đồng bộ phiên bản API với giao diện và tài liệu. Không chọn.
