# ADR 004: Cổng thanh toán qua interface (mô phỏng và VNPay sandbox)

- **Trạng thái:** Chấp nhận
- **Ngày:** 15/11/2026

## Bối cảnh

Thanh toán Ví, Thẻ, QR dùng cổng mô phỏng (FR-08, FR-18), cần điều khiển được kết quả để kiểm thử. VNPay sandbox là yêu cầu Could (FR-21). Cổng thanh toán thật nằm ngoài phạm vi (FR-23).

## Quyết định

- Định nghĩa interface `PaymentGateway` trong module `payments`.
- Hai cài đặt:
  - `MockPaymentGateway`: chạy trong API; Ví và Thẻ trả thành công hoặc thất bại theo dữ liệu thử; QR dùng `PaymentIntent` (token, hạn dùng) và `PaymentAccount` thử nghiệm có PIN băm và số dư.
  - `VnpayGateway`: tạo URL thanh toán sandbox, kiểm tra chữ ký HMAC và số tiền ở Return URL.
- Chọn cài đặt theo `method` của yêu cầu; thông tin VNPay (`TMN_CODE`, `HASH_SECRET`, URL) chỉ nằm trong biến môi trường.
- Gọi cổng **sau khi** đã trừ kho có điều kiện trong transaction (xem ADR 005).

## Hệ quả

- Nghiệp vụ đơn hàng không phụ thuộc cổng cụ thể; test dùng cổng mô phỏng.
- Có thể bỏ VNPay sandbox mà không ảnh hưởng MVP.
- Hạn chế: cổng mô phỏng không phản ánh hết độ trễ và lỗi mạng của cổng thật.

## Phương án đã cân nhắc

- **Gọi trực tiếp VNPay trong service đơn hàng:** nhanh lúc đầu nhưng khó test và khó thay thế. Không chọn.
