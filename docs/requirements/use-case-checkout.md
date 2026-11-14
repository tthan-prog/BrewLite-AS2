# Đặc tả use case UC-01: Đặt và thanh toán đơn hàng (Assignment 2 – Task 1.3)

| Mục | Nội dung |
|---|---|
| Mã | UC-01 |
| Tên | Đặt và thanh toán đơn hàng |
| Actor chính | Khách hàng (CUSTOMER) |
| Actor phụ | Cổng thanh toán (mô phỏng) |
| Trigger | Khách bấm "Đặt đơn" trong giỏ hàng |
| Yêu cầu liên quan | FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-12, FR-13, FR-14, FR-16, FR-18, NFR-02, NFR-04 |

## Tiền điều kiện

1. Khách đã đăng nhập và có JWT hợp lệ.
2. Giỏ hàng có ít nhất một món.

## Hậu điều kiện

- **Thành công:**
  - đơn ở trạng thái PAID;
  - nguyên liệu đã bị trừ và có bản ghi `Payment`;
  - điểm thưởng đã được cộng;
  - khách thấy trang xác nhận đơn.
- **Thanh toán thất bại:** đơn ở trạng thái PAYMENT_FAILED và giỏ hàng được giữ; khách có thể thử lại hoặc hủy đơn.
- **Thiếu nguyên liệu khi đặt:** không tạo đơn, tồn kho không đổi.

## Luồng chính

1. Khách mở giỏ hàng và bấm "Đặt đơn".
2. Giao diện gửi `POST /orders` kèm JWT.
3. API kiểm tra JWT và dữ liệu đầu vào.
4. API mở một transaction và thực hiện:
   - cộng dồn nhu cầu nguyên liệu của cả đơn theo công thức, size, topping, mức đường và đá;
   - kiểm tra đủ nguyên liệu và ghi lại nhu cầu (chưa trừ kho);
   - tạo `Order` (PENDING) và các `OrderItem`, áp khuyến mãi nếu có;
   - commit.
5. API trả mã đơn; giao diện chuyển sang màn hình thanh toán.
6. Khách chọn Ví hoặc Thẻ và xác nhận.
7. Giao diện gửi `POST /payments` kèm `Idempotency-Key`.
8. API gọi cổng thanh toán mô phỏng; cổng trả kết quả thành công.
9. Trong cùng một transaction, API:
   - trừ nguyên liệu bằng cập nhật có điều kiện (`stock >= lượng cần`);
   - ghi `Payment`;
   - chuyển đơn sang PAID;
   - cộng điểm thưởng.
10. API trả kết quả; giao diện hiện trang xác nhận đơn.

## Luồng thay thế

| # | Điều kiện | Xử lý |
|---|---|---|
| A1 | Khách nhập mã khuyến mãi hợp lệ trước bước 1 | Giá được giảm; tổng tiền cập nhật trước khi đặt đơn |
| A2 | Khách gửi lại yêu cầu thanh toán với cùng Idempotency-Key, ví dụ khi mạng chập chờn | API trả lại kết quả cũ, không tạo thanh toán thứ hai |
| A3 | Ở bước 6 khách chọn QR | Thay cho bước 6–8: <br>1. API tạo mã QR có hạn dùng. <br>2. Khách quét mã bằng điện thoại, chọn tài khoản thử nghiệm và nhập PIN. <br>3. Cổng mô phỏng kiểm tra PIN và số dư rồi xác nhận. <br>4. Trang đặt hàng hỏi trạng thái định kỳ và tự chuyển sang trang xác nhận. <br>Bước 9–10 giữ nguyên |
| A4 | STAFF hủy đơn ở trạng thái cho phép (PENDING, PAYMENT_FAILED hoặc PAID) | Đơn chuyển CANCELLED. Chỉ phần nguyên liệu đã trừ được hoàn lại; đơn chưa thanh toán không đụng tới kho. Điểm đã cộng bị trừ lại |

## Luồng ngoại lệ

| # | Điều kiện | Xử lý |
|---|---|---|
| E1 | Chưa đăng nhập hoặc JWT hết hạn (bước 2–3) | API trả 401; giao diện chuyển sang đăng nhập rồi quay lại giỏ hàng; giỏ hàng được giữ |
| E2 | Dữ liệu không hợp lệ (bước 3) | API trả 400 với thông báo rõ ràng |
| E3 | Không đủ nguyên liệu khi tạo đơn (bước 4) | Transaction rollback; không tạo đơn; báo món nào không đủ nguyên liệu |
| E4 | Kho vừa hết do đơn khác thanh toán trước (bước 9) | Transaction bị hủy: không trừ tiền, không trừ kho; đơn chuyển PAYMENT_FAILED kèm lý do; khách thử lại hoặc hủy đơn |
| E5 | Mã khuyến mãi sai, hết hạn hoặc hết lượt | Từ chối mã kèm lý do; khách vẫn đặt được đơn không dùng mã |
| E6 | Cổng thanh toán trả thất bại (bước 8), hoặc QR sai PIN, thiếu số dư hay hết hạn (A3) | Không trừ tiền; Ví và Thẻ thì đơn chuyển PAYMENT_FAILED. Giao diện báo lỗi, giữ giỏ hàng và cho thử lại |
| E7 | Yêu cầu chuyển trạng thái không hợp lệ | API trả 400; đơn giữ nguyên trạng thái |

## Giá trị nghiệp vụ

Đây là luồng tạo ra doanh thu của hệ thống. Sai ở luồng này gây mất tiền, trừ tiền hai lần hoặc bán vượt nguyên liệu đang có, nên đây là use case trọng tâm của Assignment 2.
