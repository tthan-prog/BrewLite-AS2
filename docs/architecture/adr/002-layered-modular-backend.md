# ADR 002: Backend NestJS phân lớp, chia module theo domain

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Nghiệp vụ gồm xác thực, sản phẩm, tồn kho nguyên liệu, đơn hàng, thanh toán, khuyến mãi và điểm thưởng. Đặt đơn và thanh toán cần transaction xuyên qua nhiều phần (đơn, kho, thanh toán, điểm).

## Quyết định

- Backend là **một ứng dụng NestJS (modular monolith)**.
- Chia module theo domain: `auth`, `catalog`, `inventory`, `orders`, `payments`, `promotions`, `loyalty`, `health`.
- Mỗi module có ba lớp: controller (HTTP, guard, DTO), service (nghiệp vụ, transaction), truy cập dữ liệu qua `PrismaService`.
- Module khác chỉ được gọi qua service công khai.

## Hệ quả

- Module khớp với class diagram nên dễ chia việc và dễ truy vết.
- Transaction xuyên module chạy trong một database, không cần cơ chế phân tán.
- Hạn chế: toàn bộ API triển khai và scale cùng nhau.

## Phương án đã cân nhắc

- **Microservices:** tách được scale và triển khai, nhưng cần giao dịch phân tán (saga) cho đặt đơn và thanh toán, quá phức tạp với quy mô và thời gian của dự án. Không chọn.
