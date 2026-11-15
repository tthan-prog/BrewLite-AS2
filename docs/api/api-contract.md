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

## Gợi ý nối giao diện

- **Đăng nhập (Long, PR #19):** đọc `accessToken` từ `POST /auth/login`, lưu `sessionStorage["brewlite_token"]` như hiện tại.
- **Lịch sử đơn (Long, PR #19):** `GET /orders/me` trả mảng; mã đơn hiển thị là `#${id}`.
- **Chi tiết món (Lực, PR #12):** gọi `GET ${API_URL}/products/:id` (không phải `/api/products`). Lưu vào giỏ `productId` (số), `size`, `sugar`, `ice`, `toppingIds` (mảng id) để gửi thẳng lên `POST /orders`.
- **Thanh toán (Lực, PR #12):** chưa đăng nhập thì chuyển `/login` và giữ giỏ (FR-06). Gọi `POST /orders` → lấy `id` → `POST /payments` kèm `Idempotency-Key`. `SUCCESS` thì xóa giỏ và chuyển trang xác nhận; `FAILED` thì giữ giỏ và hiện lý do.
