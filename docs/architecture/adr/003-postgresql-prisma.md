# ADR 003: PostgreSQL với Prisma ORM và Prisma Migrate

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Đề bắt buộc PostgreSQL. Cần migration có phiên bản, seed tái tạo được (NFR-10), transaction và cập nhật có điều kiện cho tồn kho (FR-12).

## Quyết định

- Dùng **Prisma ORM**: schema tại `apps/api/prisma/schema.prisma`, theo ERD trong `docs/diagrams/erd.puml`.
- Migration bằng **Prisma Migrate**, lưu trong `apps/api/prisma/migrations` và commit vào repository.
- Seed bằng script `prisma/seed.ts` (sản phẩm, topping, nguyên liệu, công thức, khuyến mãi, tài khoản demo).
- Production chạy `prisma migrate deploy` khi API khởi động.

## Hệ quả

- Kiểu dữ liệu sinh tự động, giảm lỗi truy vấn.
- `$transaction` và `updateMany` có điều kiện đáp ứng yêu cầu tồn kho.
- Hạn chế: truy vấn phức tạp đôi khi phải viết SQL thô (`$queryRaw`).

## Phương án đã cân nhắc

- **TypeORM:** tích hợp sâu với NestJS nhưng migration và kiểu dữ liệu kém chặt hơn. Không chọn.
- **SQL thuần:** linh hoạt nhưng chậm phát triển và dễ lỗi. Không chọn.
