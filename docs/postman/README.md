# Kịch bản test API bằng Postman – BrewLite AS2

- **Mục đích:** kiểm tra API của bản đang chạy (local hoặc production) bằng tay, dùng khi demo và chụp minh chứng. Test tự động trong CI (unit, HTTP, integration, E2E) vẫn là bằng chứng chính; kịch bản này bổ sung bằng chứng chạy trên hệ thống thật.
- **Phạm vi:** toàn bộ API của `v1.1.1`: sản phẩm và số ly, xác thực, đặt đơn, thanh toán Ví/Thẻ và idempotency, QR mô phỏng, VNPay sandbox, máy trạng thái đơn, lịch sử, kho và công thức, đổi quà. Yêu cầu chỉ có ở giao diện (FR-02, phần hiển thị của FR-04) kiểm bằng component test và E2E Playwright.
- **Tệp:**
  - `brewlite-as2.postman_collection.json`: 83 request chia 11 nhóm, mỗi request có assertion.
  - `brewlite-as2-local.postman_environment.json`: chạy trên máy (`http://localhost:3001`).
  - `brewlite-as2-production.postman_environment.json`: chạy trên Render (`https://brewlite-as2-api-k8xj.onrender.com`).
- **Kết quả đã chạy:** 17/11/2026, newman trên API local (mã `main` sau `v1.1.1`, database vừa migrate và seed): 83/83 request, 164/164 assertion đạt.

## 1. Chuẩn bị

### Local

```bash
cp .env.example .env              # PowerShell: Copy-Item .env.example .env
docker compose up --build
npm run db:seed -w apps/api       # nạp dữ liệu mẫu (xóa dữ liệu cũ), chạy từ máy
```

Mở http://localhost:3001/health, phải thấy `"status":"ok","db":"up"`. VNPay local mặc định tắt: nhóm 7 kiểm tra API trả `503`; khai báo `VNPAY_*` trong `.env` thì kiểm tra URL đã ký.

### Production

- Mở https://brewlite-as2-api-k8xj.onrender.com/health trước, chờ trả `ok` (gói Free ngủ, lần đầu mất khoảng 50 giây).
- Kịch bản **ghi dữ liệu thật**, mỗi lần chạy:
  - tạo 1 tài khoản khách mới và 5 đơn của `customer@brewlite.test`;
  - dùng 1 lượt mã `GIAM10` (hủy đơn ở PM-62 trả lại lượt);
  - nhập thêm 1 đơn vị cho nguyên liệu đầu tiên;
  - đổi 1 quà nếu đủ điểm;
  - trừ tiền tài khoản QR thử `qrAccount` (mặc định `TEST-0001`) một ly size S.
- Tài khoản `TEST-0001` có số dư giới hạn. Khi hết tiền, PM-46 báo thiếu số dư: đổi `qrAccount` trong environment hoặc nạp lại số dư bằng seed (chỉ trên local).

## 2. Cách chạy

### Postman

1. **Import** cả 3 tệp trong `docs/postman/`.
2. Góc phải trên chọn environment **BrewLite AS2 Local** hoặc **BrewLite AS2 Production**.
3. Chuột phải collection **BrewLite AS2 – Kịch bản test API** → **Run collection**, giữ thứ tự mặc định → **Run**.
4. Mong đợi: 83 request, mọi assertion xanh. Chụp trang kết quả Runner làm minh chứng.
5. Demo từng ca: mở request, **Send**, xem tab **Test Results**. Phải chạy theo thứ tự vì request sau dùng token, mã đơn, mã QR do request trước lưu vào biến của collection.

Chạy lại nhiều lần được: email khách B và `Idempotency-Key` sinh mới mỗi lần.

### Dòng lệnh

```bash
npx newman run docs/postman/brewlite-as2.postman_collection.json \
  -e docs/postman/brewlite-as2-local.postman_environment.json
```

## 3. Ca kiểm thử

Các request có điều kiện:
- **PM-53, PM-54 (VNPay):** kiểm tra theo cấu hình. Bật thì kiểm URL đã ký và từ chối sai chữ ký; tắt thì mong đợi `503`.
- **PM-82 (đổi quà):** đủ điểm thì mong đợi `201` và trừ đúng điểm; không đủ thì mong đợi `400`.

### 1. Hệ thống

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-01 | Health check | `GET /health` | NFR-09. Production: version là tag đang chạy (vd v1.1.1). |

### 2. Sản phẩm và số ly

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-02 | Danh sách món | `GET /products` | FR-01, FR-16. Lưu món dùng cho các request sau (ưu tiên Cà phê sữa đá). |
| PM-03 | Chi tiết món | `GET /products/{{productId}}` | FR-03. |
| PM-04 | Món không tồn tại | `GET /products/999999` |  |
| PM-05 | Mã món sai kiểu | `GET /products/abc` | NFR-04. |
| PM-06 | Số ly làm được cho giỏ hàng | `POST /products/availability` | FR-04, FR-16 (Sprint 3). |
| PM-07 | Số ly: vượt 50 ly một dòng | `POST /products/availability` |  |
| PM-08 | Số ly: quá 5 topping | `POST /products/availability` |  |

### 3. Xác thực

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-09 | Đăng ký khách B (email mới) | `POST /auth/register` | FR-05, NFR-02. |
| PM-10 | Đăng ký trùng email | `POST /auth/register` |  |
| PM-11 | Đăng ký tự gán quyền STAFF | `POST /auth/register` | Trường lạ bị từ chối (forbidNonWhitelisted). |
| PM-12 | Đăng ký email sai, mật khẩu ngắn | `POST /auth/register` |  |
| PM-13 | Đăng nhập sai mật khẩu | `POST /auth/login` |  |
| PM-14 | Đăng nhập khách A | `POST /auth/login` |  |
| PM-15 | Đăng nhập khách B | `POST /auth/login` |  |
| PM-16 | Đăng nhập nhân viên | `POST /auth/login` |  |
| PM-17 | Thông tin người đăng nhập | `GET /auth/me` |  |
| PM-18 | Gọi API cần đăng nhập khi thiếu token | `GET /auth/me` |  |

### 4. Đặt đơn

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-19 | Tạo đơn khi chưa đăng nhập | `POST /orders` | FR-06. |
| PM-20 | Client tự gửi giá | `POST /orders` | Giá do máy chủ tính; trường lạ bị từ chối. |
| PM-21 | Size sai | `POST /orders` |  |
| PM-22 | Số lượng 0 | `POST /orders` |  |
| PM-23 | Topping trùng nhau | `POST /orders` |  |
| PM-24 | Món không tồn tại | `POST /orders` |  |
| PM-25 | Tạo đơn hợp lệ (đơn 1, size M) | `POST /orders` | FR-07. Tạo đơn chưa trừ kho. |
| PM-26 | Mã khuyến mãi không tồn tại | `POST /orders` |  |
| PM-27 | Mã khuyến mãi đã hết hạn | `POST /orders` |  |
| PM-28 | Mã GIAM10 khi chưa đủ đơn tối thiểu | `POST /orders` |  |
| PM-29 | Áp mã GIAM10 hợp lệ (đơn 2) | `POST /orders` | FR-13. Mã không phân biệt hoa thường. |
| PM-30 | Đơn có topping (đơn 3) | `POST /orders` |  |

### 5. Thanh toán Ví, Thẻ và idempotency

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-31 | Thanh toán thiếu Idempotency-Key | `POST /payments` | FR-09. |
| PM-32 | Thanh toán thẻ thiếu số thẻ | `POST /payments` |  |
| PM-33 | Thanh toán đơn 1 bằng Ví | `POST /payments` | FR-08, FR-12, FR-14. Trừ kho có điều kiện trong transaction. |
| PM-34 | Gửi lại cùng Idempotency-Key, cùng nội dung | `POST /payments` | FR-09: không tạo thanh toán thứ hai. |
| PM-35 | Cùng Idempotency-Key, đổi phương thức | `POST /payments` |  |
| PM-36 | Thanh toán lại đơn đã PAID bằng khóa mới | `POST /payments` |  |
| PM-37 | Thẻ bị từ chối (đơn 3) | `POST /payments` | FR-08: thất bại thì hoàn kho, cho thử lại. |
| PM-38 | Thử lại đơn 3 bằng thẻ hợp lệ, khóa mới | `POST /payments` |  |
| PM-39 | Khách B thanh toán đơn của khách A | `POST /payments` | Không lộ đơn của người khác. |

### 6. Thanh toán QR mô phỏng

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-40 | Tạo đơn 4 để trả bằng QR | `POST /orders` |  |
| PM-41 | Tạo mã QR khi chưa đăng nhập | `POST /payments/qr` |  |
| PM-42 | Tạo mã QR cho đơn 4 | `POST /payments/qr` | FR-18. |
| PM-43 | Trang điện thoại xem mã QR | `GET /payments/qr/{{qrToken}}` |  |
| PM-44 | Token QR không tồn tại | `GET /payments/qr/00000000000000000000000000000000` |  |
| PM-45 | Xác nhận sai PIN | `POST /payments/qr/{{qrToken}}/confirm` | Không trừ tiền, cho nhập lại. |
| PM-46 | Xác nhận đúng PIN | `POST /payments/qr/{{qrToken}}/confirm` | Trừ số dư tài khoản thử. Nếu tài khoản hết tiền, request này báo thiếu số dư (xem kịch bản). |
| PM-47 | Xác nhận lại mã đã thanh toán | `POST /payments/qr/{{qrToken}}/confirm` |  |
| PM-48 | Trang thanh toán hỏi trạng thái QR | `GET /payments/qr/{{qrToken}}/status` |  |
| PM-49 | Tạo đơn 5 để thử thiếu số dư | `POST /orders` |  |
| PM-50 | Tạo mã QR cho đơn 5 | `POST /payments/qr` |  |
| PM-51 | Thiếu số dư (TEST-0002, 10.000đ) | `POST /payments/qr/{{qrToken5}}/confirm` |  |

### 7. VNPay sandbox

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-52 | Cấu hình VNPay | `GET /payments/vnpay/config` | FR-21. |
| PM-53 | Tạo URL thanh toán VNPay cho đơn 2 | `POST /payments/vnpay` | Không mở URL trong Postman; thanh toán thật trên sandbox làm bằng trình duyệt. |
| PM-54 | Return URL sai chữ ký | `GET /payments/vnpay/return?vnp_TxnRef=khongco&vnp_Amount=100&vnp_ResponseCode=00&vnp_SecureHash=sai` | Máy chủ từ chối, không chốt đơn nào. |

### 8. Máy trạng thái đơn

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-55 | Khách tự đổi trạng thái | `PATCH /orders/{{order1Id}}/status` | FR-15. |
| PM-56 | Nhân viên đặt tay PAID | `PATCH /orders/{{order2Id}}/status` | PAID chỉ do luồng thanh toán đặt. |
| PM-57 | Chuyển sai PENDING sang READY | `PATCH /orders/{{order2Id}}/status` |  |
| PM-58 | PAID sang PREPARING | `PATCH /orders/{{order1Id}}/status` |  |
| PM-59 | PREPARING sang READY | `PATCH /orders/{{order1Id}}/status` |  |
| PM-60 | READY sang COMPLETED | `PATCH /orders/{{order1Id}}/status` |  |
| PM-61 | Hủy đơn đã COMPLETED | `PATCH /orders/{{order1Id}}/status` |  |
| PM-62 | Hủy đơn 2 đang PENDING | `PATCH /orders/{{order2Id}}/status` | Trả lại lượt dùng mã GIAM10, không đụng kho. |
| PM-63 | Hủy đơn 3 đã PAID | `PATCH /orders/{{order3Id}}/status` | Hoàn đúng nguyên liệu đã trừ và trừ lại điểm đã cộng. |

### 9. Lịch sử và theo dõi đơn

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-64 | Lịch sử đơn của khách A | `GET /orders/me` | FR-11. |
| PM-65 | Lịch sử đơn của khách B | `GET /orders/me` |  |
| PM-66 | Chi tiết đơn 1 (chủ đơn) | `GET /orders/{{order1Id}}` |  |
| PM-67 | Khách B xem đơn của khách A | `GET /orders/{{order1Id}}` |  |
| PM-68 | Khách xem danh sách đơn của nhân viên | `GET /orders` |  |
| PM-69 | Nhân viên lọc đơn COMPLETED | `GET /orders?status=COMPLETED` |  |

### 10. Kho nguyên liệu và công thức

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-70 | Khách xem kho | `GET /ingredients` | FR-17. |
| PM-71 | Nhân viên xem kho | `GET /ingredients` |  |
| PM-72 | Nhập kho số lượng 0 | `PATCH /ingredients/{{ingredientId}}/restock` |  |
| PM-73 | Nhập kho nguyên liệu không tồn tại | `PATCH /ingredients/999999/restock` |  |
| PM-74 | Nhập thêm 1 đơn vị | `PATCH /ingredients/{{ingredientId}}/restock` |  |
| PM-75 | Khách xem công thức | `GET /ingredients/recipes` |  |
| PM-76 | Nhân viên xem công thức và số ly | `GET /ingredients/recipes` | FR-16, FR-17 (Sprint 3). |

### 11. Đổi quà

| Mã | Ca kiểm thử | Request | Ghi chú |
|---|---|---|---|
| PM-77 | Danh sách quà | `GET /rewards` | FR-19. |
| PM-78 | Đổi quà khi chưa đăng nhập | `POST /rewards/{{rewardId}}/redeem` |  |
| PM-79 | Khách B không đủ điểm | `POST /rewards/{{rewardId}}/redeem` |  |
| PM-80 | Quà không tồn tại | `POST /rewards/999999/redeem` |  |
| PM-81 | Điểm hiện tại của khách A | `GET /auth/me` |  |
| PM-82 | Khách A đổi quà rẻ nhất | `POST /rewards/{{rewardId}}/redeem` |  |
| PM-83 | Mã quà đã đổi của khách A | `GET /rewards/me` |  |