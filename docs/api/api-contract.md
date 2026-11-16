# Hợp đồng API BrewLite (Task 5)

Địa chỉ gốc: biến `NEXT_PUBLIC_API_URL` (chạy local: `http://localhost:3001`). Dữ liệu gửi và nhận là JSON, tiền tính bằng VND (số nguyên).

## Quy ước chung

- Route cần đăng nhập: gửi header `Authorization: Bearer <accessToken>`. Thiếu token, token sai hoặc hết hạn trả `401`.
- Sai vai trò (ví dụ CUSTOMER gọi API của nhân viên) trả `403`.
- Dữ liệu sai hoặc có trường lạ trả `400`. Lỗi luôn có dạng:

```json
{ "statusCode": 400, "message": "Thông báo tiếng Việt", "error": "Bad Request" }
```

`message` có thể là chuỗi hoặc mảng chuỗi (lỗi kiểm tra dữ liệu). Hàm `apiRequest` trong `apps/web/lib/api.ts` đã xử lý cả hai dạng.

## Xác thực (FR-05, FR-06)

### `POST /auth/register` → `201`

```json
{ "name": "Nguyễn An", "email": "an@example.com", "password": "Matkhau@123" }
```

- Mật khẩu 8–72 ký tự; email được chuyển thành chữ thường. Không gửi trường `role`: tài khoản mới luôn là `CUSTOMER`.
- Trả `{ "id", "name", "email", "role", "points" }`. Email đã đăng ký trả `409`.

### `POST /auth/login` → `200`

```json
{ "email": "customer@brewlite.test", "password": "Customer@123" }
```

Trả:

```json
{
  "accessToken": "<JWT>",
  "user": { "id": 1, "name": "Khách Thử", "email": "customer@brewlite.test", "role": "CUSTOMER", "points": 120 }
}
```

Sai email hoặc mật khẩu trả `401` với `message: "Email hoặc mật khẩu không đúng"`. JWT hết hạn sau `JWT_EXPIRES_IN` (mặc định 1 ngày).

### `GET /auth/me` → `200`

Trả `{ "id", "name", "email", "role", "points" }` của người đang đăng nhập (dùng cho trang đổi quà để hiện điểm).

## Đơn hàng

### `POST /orders` → `201` (FR-07, FR-13)

```json
{
  "items": [
    { "productId": 1, "quantity": 2, "size": "M", "sugar": 50, "ice": 70, "toppingIds": [1] }
  ],
  "promotionCode": "GIAM10"
}
```

| Trường | Bắt buộc | Giá trị |
|---|---|---|
| `items` | Có | 1–20 dòng |
| `productId` | Có | id lấy từ `GET /products` |
| `quantity` | Có | 1–50 |
| `size` | Không | `S` (mặc định), `M`, `L` |
| `sugar`, `ice` | Không | 0, 30, 50, 70, 100 (mặc định 100) |
| `toppingIds` | Không | tối đa 5, không lặp; id lấy từ `GET /products/:id` → `toppings[].id` |
| `promotionCode` | Không | mã khuyến mãi, không phân biệt hoa thường |

Không gửi giá: máy chủ tự tính `unitPrice = giá món + phụ phí size + giá topping`. Gửi thêm trường lạ (ví dụ `unitPrice`) trả `400`.

Trả chi tiết đơn:

```json
{
  "id": 12, "userId": 1, "status": "PENDING",
  "subtotal": 82000, "discount": 8200, "total": 73800,
  "promotionCode": "GIAM10", "failureReason": null, "createdAt": "2026-11-15T14:30:00.000Z",
  "items": [
    {
      "id": 20, "productId": 1, "name": "Cà phê sữa đá", "quantity": 2, "size": "M", "sugar": 50, "ice": 70,
      "unitPrice": 41000, "lineTotal": 82000,
      "toppings": [{ "id": 1, "name": "Trân châu đen", "price": 7000 }]
    }
  ],
  "lastPayment": null
}
```

Lỗi `400`:

- Thiếu nguyên liệu: `message: "Không đủ nguyên liệu cho: Cà phê sữa đá"`, kèm `missingProducts: [{ "productId": 1, "name": "Cà phê sữa đá" }]`. Không tạo đơn.
- Mã khuyến mãi: `"Mã khuyến mãi không tồn tại"`, `"Mã khuyến mãi đã hết hạn"`, `"Mã khuyến mãi đã hết lượt sử dụng"`, `"Đơn tối thiểu 50.000đ để dùng mã này"`.

Tạo đơn **chưa trừ kho**. Kho chỉ bị trừ khi thanh toán thành công.

### `GET /orders/me` → `200` (FR-11)

Mảng đơn của người đang đăng nhập, mới nhất trước:

```json
[{ "id": 12, "status": "PAID", "subtotal": 82000, "discount": 8200, "total": 73800, "itemCount": 2, "createdAt": "2026-11-15T14:30:00.000Z" }]
```

### `GET /orders/:id` → `200` (FR-11)

Chi tiết đơn như kết quả `POST /orders`. Chỉ chủ đơn hoặc STAFF xem được; người khác nhận `404`.

### `GET /orders?status=PAID` → `200` (STAFF, FR-15)

Danh sách đơn (chi tiết + `customerName`), cũ nhất trước, tối đa 200 đơn. Bỏ `status` để lấy mọi trạng thái.

### `PATCH /orders/:id/status` → `200` (STAFF, FR-10, FR-15)

```json
{ "status": "PREPARING" }
```

Nhân viên chỉ được đặt `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`. Máy trạng thái:

| Từ | Được chuyển sang |
|---|---|
| PENDING | PAID*, PAYMENT_FAILED*, CANCELLED |
| PAYMENT_FAILED | PAID*, CANCELLED |
| PAID | PREPARING, CANCELLED |
| PREPARING | READY |
| READY | COMPLETED |
| COMPLETED, CANCELLED | (không chuyển tiếp) |

\* Chỉ luồng thanh toán đặt được. Chuyển sai trả `400` (`"Không thể chuyển đơn từ PENDING sang PREPARING"`), đơn giữ nguyên.

Hủy đơn đã `PAID`: hoàn lại đúng lượng nguyên liệu đã trừ và trừ lại điểm đã cộng. Hủy đơn chưa thanh toán: trả lại lượt dùng mã khuyến mãi.

## Thanh toán (FR-08, FR-09, FR-12, FR-14)

### `POST /payments`

Header bắt buộc `Idempotency-Key`: 8–100 ký tự gồm chữ, số, `-`, `_`. Giao diện tạo **một khóa mới cho mỗi lần bấm "Thanh toán"** (ví dụ `crypto.randomUUID()`), và dùng lại đúng khóa đó nếu gửi lại cùng yêu cầu (mất mạng, bấm hai lần).

```json
{ "orderId": 12, "method": "WALLET" }
{ "orderId": 12, "method": "CARD", "cardNumber": "4242 4242 4242 4242" }
```

Cổng thanh toán là bản mô phỏng, không có tiền thật:

| Phương thức | Kết quả |
|---|---|
| `WALLET` | Thành công nếu tổng tiền ≤ 2.000.000đ, lớn hơn thì `"Số dư ví không đủ"` |
| `CARD` `4242 4242 4242 4242` | Thành công |
| `CARD` `4000 0000 0000 0002` | Thất bại: `"Thẻ bị ngân hàng từ chối"` |
| `CARD` số sai (không qua kiểm tra Luhn) | Thất bại: `"Số thẻ không hợp lệ"` |

Trả (cả thành công lẫn thất bại):

```json
{
  "paymentId": 3, "orderId": 12, "method": "WALLET", "amount": 73800,
  "status": "SUCCESS", "orderStatus": "PAID", "failureReason": null,
  "pointsEarned": 7, "createdAt": "2026-11-15T14:31:00.000Z"
}
```

| Mã HTTP | Ý nghĩa |
|---|---|
| `201` | Xử lý lần đầu. `status` là `SUCCESS` (đơn `PAID`) hoặc `FAILED` (đơn `PAYMENT_FAILED`, xem `failureReason`) |
| `200` + header `Idempotent-Replayed: true` | Gửi lại cùng khóa: trả lại đúng kết quả cũ, không tạo thanh toán mới |
| `400` | Thiếu hoặc sai `Idempotency-Key`, thiếu số thẻ, đơn đã hủy |
| `404` | Đơn không tồn tại hoặc không phải của mình |
| `409` | Khóa đã dùng cho yêu cầu khác; đơn đã thanh toán; đơn đang được thanh toán ở yêu cầu khác |

Khi `status` là `FAILED`: giữ giỏ hàng, hiện `failureReason`, cho bấm thử lại (tạo khóa mới). Nếu nguyên liệu vừa hết đúng lúc thanh toán, API không gọi cổng thanh toán (không trừ tiền) và trả `failureReason: "Nguyên liệu vừa hết (...), chưa trừ tiền"`.

Thanh toán thành công cộng 1 điểm cho mỗi 10.000đ của `total`.

## Thanh toán QR mô phỏng (FR-18)

Luồng: trang thanh toán tạo mã QR → khách quét bằng điện thoại → trang `/pay/qr/<token>` trên điện thoại chọn tài khoản thử và nhập PIN → trang thanh toán hỏi trạng thái và tự chuyển sang xác nhận khi `PAID`. Giao diện có sẵn thành phần `apps/web/components/qr-payment-panel.tsx` để gắn vào trang thanh toán.

### `POST /payments/qr` → `201` (đăng nhập, chủ đơn)

```json
{ "orderId": 12 }
```

Trả mã QR còn hạn (tạo lại khi đơn đã có mã còn hạn thì trả cùng mã):

```json
{
  "token": "3f9c…(32 ký tự hex)", "orderId": 12, "amount": 73800, "status": "PENDING",
  "expiresAt": "2026-11-16T03:05:00.000Z",
  "qrContent": "https://brewlite-as2-web.onrender.com/pay/qr/3f9c…",
  "qrImage": "data:image/png;base64,…"
}
```

Hạn dùng: `QR_TTL_MINUTES` (mặc định 5). Link trong QR dùng `WEB_PUBLIC_URL`, nếu không có thì origin đầu tiên của `WEB_ORIGIN`. Đơn đã thanh toán trả `409`, đơn đã hủy trả `400`, đơn của người khác trả `404`.

### `GET /payments/qr/:token/status` → `200` (đăng nhập, chủ đơn)

`{ "token", "orderId", "status": "PENDING" | "PAID" | "FAILED" | "EXPIRED", "orderStatus" }`. Trang thanh toán gọi mỗi 3 giây.

### `GET /payments/qr/:token` → `200` (công khai, cho điện thoại)

`{ "token", "orderId", "amount", "status", "expiresAt", "accounts": [{ "identifier", "holderName" }] }`. Không trả số dư. Token sai trả `404`.

### `POST /payments/qr/:token/confirm` → `200` (công khai)

```json
{ "accountIdentifier": "TEST-0001", "pin": "123456" }
```

| Trường hợp | Kết quả |
|---|---|
| Đúng PIN, đủ số dư | `200`, cùng dạng kết quả với `POST /payments`, `status: "SUCCESS"`, `method: "QR"`; trừ số dư, đơn `PAID`, mã QR `PAID` |
| Sai tài khoản hoặc PIN | `400` `"Sai tài khoản hoặc PIN"`; không trừ tiền, được nhập lại |
| Thiếu số dư | `200`, `status: "FAILED"`, `failureReason: "Số dư tài khoản không đủ"`; không trừ tiền, đơn `PAYMENT_FAILED`, mã QR `FAILED` (khách tạo mã mới) |
| Mã hết hạn | `400` `"Mã QR đã hết hạn, vui lòng tạo mã mới"` |
| Xác nhận lại mã đã thanh toán | `409` `"Mã QR này đã được thanh toán"`; nhiều lần bấm đồng thời chỉ một lần thành công |

Tài khoản thử (seed): `TEST-0001` số dư 1.000.000đ, `TEST-0002` số dư 10.000đ, PIN `123456`.

## Thanh toán VNPay sandbox (FR-21)

Môi trường thử nghiệm của VNPay, không dùng tiền thật. Bật khi máy chủ có đủ `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`, `VNPAY_RETURN_URL`; thiếu thì các API dưới trả `503`.

Luồng: trang thanh toán gọi `POST /payments/vnpay` → chuyển khách tới `paymentUrl` → khách thanh toán trên trang VNPay → VNPay chuyển về `VNPAY_RETURN_URL` (trang `/checkout/vnpay-return`) → trang gửi nguyên chuỗi query về `GET /payments/vnpay/return` → máy chủ kiểm tra chữ ký HMAC-SHA512, mã website, số tiền rồi mới chốt đơn. Giao diện có sẵn `apps/web/components/vnpay-button.tsx`.

### `GET /payments/vnpay/config` → `200`

`{ "enabled": true }` — giao diện ẩn nút VNPay khi `false`.

### `POST /payments/vnpay` → `201` (đăng nhập, chủ đơn)

```json
{ "orderId": 12 }
```

Trả `{ "orderId", "txnRef", "amount", "expiresAt", "paymentUrl" }`. `paymentUrl` đã ký theo VNPay 2.1.0 (`vnp_Amount` = tổng tiền × 100, hạn 15 phút). Đơn đã thanh toán `409`, đã hủy `400`.

### `GET /payments/vnpay/return?vnp_...` (công khai)

| Trường hợp | Kết quả |
|---|---|
| Chữ ký đúng, số tiền đúng, `vnp_ResponseCode=00` | `200`, kết quả như `POST /payments`, `method: "VNPAY"`, `status: "SUCCESS"`; đơn `PAID`, trừ kho, cộng điểm |
| Chữ ký đúng, mã khác `00` (ví dụ `24` khách hủy) | `200`, `status: "FAILED"`, `failureReason` tiếng Việt; đơn `PAYMENT_FAILED`, khách thanh toán lại bằng giao dịch mới |
| Sai chữ ký hoặc sai mã website | `400` `"Chữ ký VNPay không hợp lệ"`; đơn giữ nguyên |
| Chữ ký đúng nhưng số tiền khác đơn | `400` `"Số tiền giao dịch không khớp với đơn hàng"`; đơn giữ nguyên |
| Gọi lại cùng giao dịch | Trả lại kết quả cũ, không tạo thêm thanh toán |

### `GET /payments/vnpay/ipn?vnp_...` (VNPay gọi máy chủ–máy chủ)

Xử lý giống Return URL, trả `{ "RspCode", "Message" }` theo tài liệu VNPay: `00` đã ghi nhận, `97` sai chữ ký, `01` không tìm thấy giao dịch, `04` sai số tiền, `02` đã xác nhận trước đó. Return URL và IPN cùng đến vẫn chỉ ghi một kết quả.

## Kho nguyên liệu (STAFF, FR-17)

### `GET /ingredients` → `200`

```json
[{ "id": 1, "name": "Cà phê rang xay", "unit": "g", "stock": 4954, "lowThreshold": 500, "flag": "OK" }]
```

`flag`: `OUT` (hết, tồn kho ≤ 0), `LOW` (sắp hết, tồn kho ≤ `lowThreshold`), `OK`.

### `PATCH /ingredients/:id/restock` → `200`

```json
{ "quantity": 500 }
```

Số nguyên dương, tối đa 1.000.000 mỗi lần; cộng dồn vào tồn kho. Trả nguyên liệu sau khi nhập (cùng dạng như trên). Số lượng không dương trả `400`, id không tồn tại trả `404`. CUSTOMER gọi nhận `403`.

## Đổi quà (FR-19)

### `GET /rewards` → `200` (công khai)

```json
[{ "id": 1, "name": "Giảm 10.000đ", "pointsCost": 50 }]
```

### `POST /rewards/:id/redeem` → `201` (đăng nhập)

Không có body. Đủ điểm thì trừ điểm và trả mã quà để dùng tại quầy:

```json
{ "redemptionId": 1, "rewardId": 1, "rewardName": "Giảm 10.000đ", "pointsSpent": 50, "code": "BL-7K3QX9MP", "pointsLeft": 77 }
```

Không đủ điểm trả `400` (`"Không đủ điểm để đổi phần thưởng này"`), điểm giữ nguyên. Quà đã ngừng hoặc không tồn tại trả `404`. Nhiều yêu cầu đổi cùng lúc không làm điểm âm.

### `GET /rewards/me` → `200` (đăng nhập)

Các mã quà đã đổi, mới nhất trước: `[{ "id", "rewardId", "rewardName", "pointsSpent", "code" }]`.

## Tự hủy đơn quá hạn (FR-20)

Đơn `PENDING` quá `ORDER_TIMEOUT_MINUTES` phút (mặc định 15) tự chuyển `CANCELLED` với `failureReason: "Quá hạn thanh toán, đơn tự hủy"` và trả lại lượt dùng mã khuyến mãi. API quét mỗi phút. Đơn đã thanh toán không bị ảnh hưởng.

## Gợi ý nối giao diện

- **Đăng nhập (Long, PR #19):** đọc `accessToken` từ `POST /auth/login`, lưu `sessionStorage["brewlite_token"]` như hiện tại.
- **Lịch sử đơn (Long, PR #19):** `GET /orders/me` trả mảng; mã đơn hiển thị là `#${id}`.
- **Chi tiết món (Lực, PR #12):** gọi `GET ${API_URL}/products/:id` (không phải `/api/products`). Lưu vào giỏ `productId` (số), `size`, `sugar`, `ice`, `toppingIds` (mảng id) để gửi thẳng lên `POST /orders`.
- **Đổi quà (Lực, PR #12):** điểm lấy từ `GET /auth/me`, danh sách quà từ `GET /rewards`, bấm đổi gọi `POST /rewards/:id/redeem` rồi hiện `code`.
- **Thanh toán (Lực, PR #12):** chưa đăng nhập thì chuyển `/login` và giữ giỏ (FR-06). Gọi `POST /orders` → lấy `id` → `POST /payments` kèm `Idempotency-Key`. `SUCCESS` thì xóa giỏ và chuyển trang xác nhận; `FAILED` thì giữ giỏ và hiện lý do.
