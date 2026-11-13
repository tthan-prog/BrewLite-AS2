# Bối cảnh, stakeholder và phạm vi (Assignment 2 – Task 1.1)

## 1. Vấn đề nghiệp vụ

Một quán cà phê nhỏ muốn khách đặt món và thanh toán không dùng tiền mặt ngay trên điện thoại, để bớt xếp hàng và tránh nhầm đơn. BrewLite là ứng dụng web mobile-first. Khách xem menu, chọn size, topping, mức đường và đá, đặt đơn, thanh toán qua cổng mô phỏng, theo dõi trạng thái đơn, tích điểm và đổi quà. Nhân viên xử lý đơn và quản lý nguyên liệu trên cùng hệ thống.

## 2. Stakeholder

| Stakeholder | Vai trò | Mục tiêu và kỳ vọng | Ảnh hưởng đến yêu cầu |
|---|---|---|---|
| Khách hàng | Đặt và thanh toán đơn | Đặt nhanh, giá rõ ràng, biết món còn hay hết, theo dõi được đơn, được thưởng khi mua nhiều | Menu, giỏ hàng, thanh toán, lịch sử đơn, điểm thưởng, đổi quà |
| Nhân viên quầy | Pha chế, giao món | Chỉ nhận đơn đã thanh toán, cập nhật trạng thái nhanh, biết nguyên liệu sắp hết | Màn hình xử lý đơn, máy trạng thái đơn, quản lý nguyên liệu |
| Quản lý cửa hàng | Kiểm soát vận hành | Không bán vượt nguyên liệu đang có, kiểm soát khuyến mãi và điểm thưởng | Công thức và tồn kho nguyên liệu, khuyến mãi, quà đổi điểm |
| Đơn vị thanh toán (mô phỏng) | Xử lý Ví, Thẻ, QR | Nhận yêu cầu hợp lệ, không trừ tiền hai lần | Idempotency, trạng thái thanh toán, hạn của mã QR |
| Giảng viên (khách hàng nghiệm thu) | Chấm và nghiệm thu | Sản phẩm chạy được, đủ tạo phẩm của Task 1 đến Task 5, quy trình đúng thứ tự | Toàn bộ tạo phẩm Assignment 2 |
| Nhóm phát triển | Xây dựng sản phẩm | Xong đúng hạn, mã dễ bảo trì, có CI/CD | Ràng buộc công nghệ, quy trình Scrum, CI/CD |

## 3. Phạm vi

### 3.1. Trong phạm vi MVP (Must)

- Xem menu và chi tiết sản phẩm: size S/M/L, topping.
- Giỏ hàng và tổng tiền.
- Đăng ký, đăng nhập bằng JWT; hai vai trò CUSTOMER và STAFF.
- Tạo đơn; thanh toán mô phỏng bằng Ví hoặc Thẻ.
- Xác nhận đơn, theo dõi trạng thái, lịch sử đơn.
- Nghiệp vụ lõi:
  - máy trạng thái đơn;
  - thanh toán idempotent;
  - không làm âm tồn kho khi nhiều người đặt và thanh toán cùng lúc.
- Triển khai production qua pipeline CI/CD, có health check và smoke test.

### 3.2. Chức năng bổ sung theo yêu cầu thực tế (Should và Could)

- Mã khuyến mãi và điểm thưởng (Should).
- Màn hình nhân viên xử lý đơn: xem đơn theo trạng thái và chuyển trạng thái (Should).
- Kho nguyên liệu theo công thức (Should):
  - mỗi món có công thức cho size S; size M và L nhân hệ số;
  - topping có định lượng riêng;
  - đường và đá tính theo mức khách chọn;
  - món hết nguyên liệu thì không đặt được;
  - nhân viên xem tồn kho và nhập thêm.
- Thanh toán bằng QR qua cổng mô phỏng (Should): khách quét mã bằng điện thoại, chọn tài khoản thử nghiệm và nhập PIN; mã QR có hạn dùng.
- Đổi điểm lấy quà, nhận mã quà để dùng tại quầy (Could).
- Tự hủy đơn chưa thanh toán sau một khoảng thời gian cấu hình được (Could).

### 3.3. Không thực hiện trong phiên bản này (Won't)

- Kết nối cổng thanh toán thật hoặc sandbox của VNPay, MoMo.
- Giao diện quản trị sản phẩm, khuyến mãi, báo cáo doanh thu.
- Ứng dụng di động native; PWA đầy đủ (offline, thông báo đẩy).
- Giao hàng, bản đồ, nhiều chi nhánh.
- Quản lý kho đầy đủ: nhập theo lô, nhà cung cấp, kiểm kê.

## 4. Giả định

| # | Giả định |
|---|---|
| G1 | Thanh toán là mô phỏng. Kết quả thành công hay thất bại điều khiển được để kiểm thử. Tài khoản thanh toán thử nghiệm và số dư là dữ liệu seed, không phải tiền thật |
| G2 | Một cửa hàng, một loại tiền (VND) |
| G3 | Phụ phí size: S +0, M +5.000, L +10.000 đồng |
| G4 | Lượng nguyên liệu theo size: S 100%, M 125%, L 150% công thức, làm tròn lên |
| G5 | Điểm thưởng: 1 điểm cho mỗi 10.000 đồng của đơn đã thanh toán; hủy đơn đã thanh toán thì trừ lại điểm |
| G6 | Tạo đơn chỉ kiểm tra đủ nguyên liệu. Nguyên liệu bị trừ khi thanh toán thành công. Hủy đơn chỉ hoàn phần đã trừ |
| G7 | Đơn mới ở trạng thái PENDING; thanh toán chuyển đơn sang PAID hoặc PAYMENT_FAILED |
| G8 | STAFF gồm cả nhân viên và quản lý; không có vai trò ADMIN riêng |
| G9 | Với các điểm đề bài chưa nêu rõ, nhóm tự chọn cách làm và báo giảng viên xác nhận |

## 5. Ràng buộc

| # | Ràng buộc |
|---|---|
| R1 | Bắt buộc dùng Next.js (frontend), NestJS (backend) và PostgreSQL; được bổ sung công nghệ khác |
| R2 | Frontend theo hướng mobile-first |
| R3 | Hạn nộp: 15/11/2026 |
| R4 | Nhóm 4 người, làm theo Scrum, chia hai sprint |
| R5 | Repository Assignment 2 độc lập hoàn toàn với Assignment 1: không dùng chung mã nguồn, tài liệu hay lịch sử commit |
| R6 | Các Task làm tuần tự. Task sau chỉ bắt đầu khi tạo phẩm của Task trước đã có trên repository |
| R7 | Production truy cập qua HTTPS; database production không public; secret không nằm trong repository |

## 6. Rủi ro ban đầu

| # | Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|---|
| RK1 | Thời gian còn rất ngắn, không kịp đủ chức năng bổ sung | Cao | Cao | Làm xong MVP (Must) trước; chức năng Should và Could làm sau, theo thứ tự ưu tiên |
| RK2 | Không kịp triển khai production | Trung bình | Cao | Dựng pipeline CD và deploy thử ngay khi có MVP đầu tiên |
| RK3 | Đặt hoặc thanh toán đồng thời làm âm tồn kho, trừ tiền hai lần | Trung bình | Cao | Cập nhật có điều kiện trong transaction, Idempotency-Key, có test đồng thời |
| RK4 | Sơ đồ, SRS và mã nguồn mâu thuẫn nhau | Trung bình | Trung bình | Duy trì `docs/traceability-matrix.md` từ Task 2 |
| RK5 | Thành viên chậm tiến độ, PR chờ review lâu | Trung bình | Trung bình | Bảng phân công nội bộ có hạn từng PR; mỗi PR có người review cố định |
| RK6 | Bị đánh giá dùng lại sản phẩm của Assignment 1 | Thấp | Cao | Repository mới, lịch sử commit đi theo đúng thứ tự Task 1 đến Task 5 |
