# ADR 006: Xác thực JWT và phân quyền theo vai trò

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Khách phải đăng nhập mới đặt đơn (FR-06); chỉ STAFF được chuyển trạng thái đơn và quản lý nguyên liệu (FR-15, FR-17). Frontend và API chạy ở hai dịch vụ khác nhau.

## Quyết định

- Đăng nhập trả **JWT** (thời hạn cấu hình qua `JWT_EXPIRES_IN`); client gửi trong header `Authorization: Bearer`.
- Mật khẩu và PIN thanh toán băm bằng **bcrypt**.
- `JwtAuthGuard` cho mọi endpoint cần đăng nhập; `RolesGuard` với decorator `@Roles('STAFF')`.
- Truy cập đơn của người khác trả 404 để không lộ sự tồn tại của đơn.

## Hệ quả

- API không lưu phiên (stateless), dễ chạy nhiều instance.
- Hạn chế: không thu hồi được JWT trước khi hết hạn; giảm rủi ro bằng thời hạn ngắn.

## Phương án đã cân nhắc

- **Session cookie lưu trên server:** thu hồi được ngay nhưng cần nơi lưu phiên và xử lý CORS với cookie giữa hai tên miền. Không chọn.
