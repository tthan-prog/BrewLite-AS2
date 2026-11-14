# Đặc tả yêu cầu phần mềm rút gọn – SRS (Assignment 2 – Task 1.2)

Mức ưu tiên theo MoSCoW: Must (bắt buộc cho MVP), Should (nên có), Could (có thể có), Won't (không làm trong phiên bản này).

## 1. Yêu cầu chức năng

### 1.1. Nhóm MVP

| Mã | Nhóm | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
|---|---|---|---|---|
| FR-01 | Menu | Hiển thị danh sách sản phẩm có tên, giá, ảnh và tình trạng còn hoặc hết | Must | `GET /products` trả danh sách; trang menu hiển thị đủ sản phẩm trong seed |
| FR-02 | Menu | Hiển thị trạng thái đang tải, danh sách rỗng và lỗi của menu | Must | Khi API chậm, trả rỗng hoặc trả lỗi, giao diện hiện đúng từng trạng thái |
| FR-03 | Chi tiết | Xem chi tiết sản phẩm; chọn size S/M/L, topping, mức đường và đá (0, 30, 50, 70, 100%) | Must | `GET /products/:id` trả đủ tùy chọn; giá cập nhật theo lựa chọn (S +0, M +5.000, L +10.000; cộng giá topping) |
| FR-04 | Giỏ hàng | Thêm món, sửa số lượng, xóa món; hiển thị tổng tiền; tối đa 50 ly mỗi dòng | Must | Tổng tiền = Σ (giá món + phụ phí size + giá topping) × số lượng; không tăng được quá 50 ly hoặc quá số ly nguyên liệu còn cho phép |
| FR-05 | Xác thực | Đăng ký, đăng nhập, phát JWT; mật khẩu băm bằng bcrypt | Must | Đăng nhập đúng nhận JWT; sai mật khẩu trả 401; database không lưu mật khẩu thô |
| FR-06 | Xác thực | Chặn đặt đơn khi chưa đăng nhập | Must | `POST /orders` không có JWT trả 401; giao diện chuyển sang đăng nhập và giữ giỏ hàng |
| FR-07 | Đặt đơn | Tạo đơn từ giỏ hàng ở trạng thái PENDING sau khi kiểm tra đủ nguyên liệu cho cả đơn | Must | Đơn tạo đúng món và giá; nếu thiếu nguyên liệu thì trả 400, báo món thiếu và không tạo đơn; tạo đơn chưa trừ nguyên liệu |
| FR-08 | Thanh toán | Thanh toán bằng Ví hoặc Thẻ mô phỏng. Thành công chuyển đơn sang PAID, thất bại chuyển sang PAYMENT_FAILED; thất bại thì cho thử lại | Must | `POST /payments` đổi trạng thái đúng; thanh toán thất bại vẫn giữ giỏ hàng |
| FR-09 | Thanh toán | Gửi lại yêu cầu thanh toán với cùng Idempotency-Key không tạo thêm thanh toán | Must | Hai request cùng khóa nhận cùng kết quả; chỉ có một bản ghi `Payment` |
| FR-10 | Trạng thái đơn | Máy trạng thái đơn chặn mọi chuyển trạng thái sai | Must | Cho phép: PENDING → PAID, PAYMENT_FAILED hoặc CANCELLED; PAYMENT_FAILED → PAID hoặc CANCELLED; PAID → PREPARING hoặc CANCELLED; PREPARING → READY → COMPLETED. Chuyển sai trả 400 và đơn giữ nguyên |
| FR-11 | Lịch sử | Khách xem lịch sử và chi tiết đơn của mình | Must | `GET /orders/me` chỉ trả đơn của người đang đăng nhập; `GET /orders/:id` chỉ chủ đơn hoặc STAFF xem được, người khác nhận 404 |
| FR-12 | Tồn kho | Trừ nguyên liệu khi thanh toán thành công bằng cập nhật có điều kiện trong cùng transaction. Hủy đơn chỉ hoàn phần đã trừ | Must | Test N thanh toán đồng thời: số đơn PAID không vượt quá lượng nguyên liệu, tồn kho không âm. Nếu kho vừa hết đúng lúc thanh toán thì không trừ tiền, không trừ kho, đơn chuyển PAYMENT_FAILED kèm lý do |

### 1.2. Nhóm chức năng bổ sung

| Mã | Nhóm | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
|---|---|---|---|---|
| FR-13 | Khuyến mãi | Áp mã khuyến mãi hợp lệ để giảm giá | Should | Mã hợp lệ giảm đúng số tiền; mã sai, hết hạn hoặc hết lượt bị từ chối kèm lý do; giá cuối do máy chủ tính |
| FR-14 | Điểm thưởng | Cộng điểm khi đơn chuyển PAID; trừ lại khi hủy đơn đã PAID; mỗi lần thay đổi điểm ghi một giao dịch | Should | `User.points` tăng 1 điểm cho mỗi 10.000đ và giảm lại khi hủy; có bản ghi `LoyaltyTransaction` tương ứng (EARN, REVERSAL) |
| FR-15 | Nhân viên | Màn hình nhân viên xem đơn theo trạng thái và chuyển trạng thái | Should | `PATCH /orders/:id/status` chỉ STAFF gọi được (CUSTOMER nhận 403); trang nhân viên chỉ STAFF vào được |
| FR-16 | Nguyên liệu | Định lượng nguyên liệu theo công thức: công thức size S, size M và L nhân 125% và 150%, topping có định lượng riêng, đường và đá theo mức chọn | Should | Lượng nguyên liệu của một ly khớp công thức và hệ số (làm tròn lên); món hết nguyên liệu hiện "Hết" và không thêm vào giỏ được; trang chi tiết hiện "có thể đặt thêm tối đa N ly" mà không lộ số tồn kho |
| FR-17 | Nguyên liệu | Nhân viên xem tồn kho nguyên liệu, cờ "Sắp hết" và "Hết", và nhập thêm (restock) | Should | `GET /ingredients` và `PATCH /ingredients/:id/restock` chỉ STAFF gọi được; số lượng nhập phải dương |
| FR-18 | Thanh toán | Thanh toán bằng QR qua cổng mô phỏng: khách quét mã bằng điện thoại, chọn tài khoản thử nghiệm và nhập PIN | Should | Xác nhận đúng PIN và đủ số dư thì đơn chuyển PAID và trang đặt hàng tự chuyển sang xác nhận. Sai PIN, thiếu số dư hoặc QR hết hạn thì không trừ tiền. Xác nhận lặp lại chỉ thành công một lần |
| FR-19 | Đổi quà | Khách đổi điểm lấy quà và nhận mã quà để dùng tại quầy | Could | Đủ điểm thì trừ điểm và trả mã quà; không đủ điểm thì từ chối; đổi đồng thời không làm âm điểm |
| FR-20 | Đặt đơn | Tự hủy đơn chưa thanh toán sau thời gian cấu hình được (mặc định 15 phút) | Could | Đơn PENDING quá hạn chuyển CANCELLED và trả lại lượt dùng mã khuyến mãi; không đụng tới kho |
| FR-21 | Thanh toán | Thanh toán qua VNPay sandbox (môi trường thử nghiệm, không dùng tiền thật) | Could | Thanh toán thành công trên sandbox thì đơn chuyển PAID qua Return URL; máy chủ kiểm tra chữ ký HMAC và số tiền trước khi chốt đơn; sai chữ ký hoặc sai số tiền thì từ chối và đơn giữ nguyên trạng thái; thông tin cấu hình sandbox chỉ nằm trong biến môi trường |
| FR-22 | Quản trị | Giao diện quản lý sản phẩm, khuyến mãi, báo cáo doanh thu | Won't | Không làm trong phiên bản này |
| FR-23 | Thanh toán | Kết nối cổng thanh toán thật (tiền thật) và cổng MoMo | Won't | Không làm trong phiên bản này |

## 2. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
|---|---|---|---|---|
| NFR-01 | Hiệu năng | `GET /products` phản hồi nhanh với dữ liệu seed | Should | 95% trong 20 yêu cầu liên tiếp dưới 500 ms khi chạy cục bộ bằng Docker Compose |
| NFR-02 | Bảo mật | Mật khẩu và PIN được băm; JWT có hạn; kiểm tra phân quyền theo vai trò | Must | Có test xác thực và phân quyền; không có mật khẩu hoặc PIN thô trong database hay log |
| NFR-03 | Bảo mật | Secret không nằm trong repository hoặc log CI | Must | `.env` có trong `.gitignore`; secret của production lưu trên nền tảng triển khai hoặc GitHub Secrets |
| NFR-04 | Bảo mật | Kiểm tra dữ liệu đầu vào ở cả frontend và backend | Must | Dữ liệu sai hoặc trường lạ trả 400 với thông báo rõ ràng |
| NFR-05 | Khả dụng | Giao diện mobile-first | Must | Dùng được trên viewport 360–414 px, không cuộn ngang |
| NFR-06 | Khả dụng | Thông báo lỗi bằng tiếng Việt, dễ hiểu, không lộ chi tiết kỹ thuật | Should | Không hiển thị stack trace hay thông báo lỗi gốc của máy chủ |
| NFR-07 | Triển khai | Chạy toàn bộ hệ thống bằng `docker compose up` | Must | Người ngoài nhóm chạy được theo README |
| NFR-08 | Triển khai | CI chạy lint, test và build cho mọi PR; CD build image, triển khai và smoke test, có cách rollback | Must | Có log pipeline chạy thành công và ít nhất một lần pipeline phát hiện lỗi |
| NFR-09 | Vận hành | Có endpoint `GET /health` và log | Must | `/health` trả `status: ok`; smoke test gọi `/health` sau mỗi lần deploy |
| NFR-10 | Độ tin cậy | Migration và seed tái tạo được database | Must | Chạy migration và seed trên database trống luôn cho cùng kết quả |
| NFR-11 | Bảo trì | Mã nguồn có lint, định dạng thống nhất và test tự động | Should | CI chạy lint và test; có unit test và integration test cho nghiệp vụ lõi |

## 3. Use case tổng quát

- Actor: Khách hàng, Nhân viên, Cổng thanh toán (mô phỏng).
- Use case: Xem menu, Xem chi tiết sản phẩm, Quản lý giỏ hàng, Đăng ký, Đăng nhập, Đặt đơn, Thanh toán đơn, Xem lịch sử đơn, Đổi quà bằng điểm, Xử lý đơn (cập nhật trạng thái), Hủy đơn, Quản lý nguyên liệu.
- Đặc tả chi tiết của use case trọng tâm: `use-case-checkout.md`.
- Sơ đồ use case tổng quát: `docs/requirements/usecase-overview.puml` (kèm ảnh kết xuất).
- Sơ đồ use case cho phạm vi UC-01: `docs/requirements/usecase-checkout.puml` (kèm ảnh kết xuất).
