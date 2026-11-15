# ADR 005: Tồn kho đồng thời và idempotency khi thanh toán

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Nhiều khách có thể thanh toán cùng lúc cho cùng nguyên liệu. Không được bán vượt tồn kho, không được trừ tiền khi đã hết nguyên liệu (UC-01 E4), và gửi lại yêu cầu thanh toán không được tạo thêm thanh toán (FR-09).

## Quyết định

- **Tạo đơn:** chỉ kiểm tra đủ nguyên liệu và ghi nhu cầu vào `OrderIngredientUse` (chưa trừ kho).
- **Thanh toán**, trong một transaction:
  1. Trừ kho bằng `UPDATE ingredients SET stock = stock - :qty WHERE id = :id AND stock >= :qty` cho từng nguyên liệu.
  2. Nếu có nguyên liệu không cập nhật được: rollback, không gọi cổng, đơn chuyển PAYMENT_FAILED kèm lý do.
  3. Nếu đủ: gọi cổng thanh toán. Thành công thì ghi `Payment`, chuyển PAID, cộng điểm, commit. Thất bại thì rollback (kho hoàn lại), ghi `Payment` FAILED, đơn chuyển PAYMENT_FAILED.
- **Idempotency:** client gửi header `Idempotency-Key` (UUID). Bảng `payments` có `UNIQUE(user_id, idempotency_key)` và `request_hash`. Gặp lại key với cùng nội dung thì trả kết quả đã lưu; khác nội dung thì trả lỗi 409.
- Hủy đơn chỉ hoàn phần kho có `consumed = true`.

## Hệ quả

- Tồn kho không âm và số đơn PAID không vượt quá nguyên liệu; kiểm chứng bằng test gửi đồng thời N yêu cầu.
- Hạn chế: giữ transaction trong lúc gọi cổng thanh toán; chấp nhận được vì cổng mô phỏng chạy trong API. Với VNPay sandbox (redirect, bất đồng bộ), kho được trừ khi xử lý Return URL hợp lệ, theo cùng điều kiện.

## Phương án đã cân nhắc

- **`SELECT ... FOR UPDATE`:** đúng nhưng khóa lâu hơn và dễ deadlock khi nhiều nguyên liệu. Không chọn.
- **Bảng idempotency riêng:** linh hoạt cho nhiều endpoint nhưng thêm bảng; hiện chỉ thanh toán cần idempotency. Không chọn.
