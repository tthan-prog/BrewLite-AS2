# Sprint 3 – Sprint Review và Retrospective

- **Thời gian:** 16/11/2026 – 17/11/2026
- **Sprint Goal:** sản phẩm chỉn chu và đúng thực tế sau bản bàn giao: nhiều topping, số ly theo công thức cho khách và nhân viên, test E2E trên trình duyệt.
- **Người dự:** Nguyễn Lê Nhựt Thắng (A, Scrum Master), Hồ Thiên Ngân (B), Hà Thiên Long (C, Product Owner), Giản Thiên Lực (D)
- **Kết quả:** đạt Sprint Goal. Phát hành `v1.1.0` ngày 17/11/2026; kiểm thử thủ công trên production phát hiện 3 lỗi giao diện, sửa và phát hành `v1.1.1` cùng ngày.

## Sprint Review

| User story | Point | Tình trạng | PR |
|---|---|---|---|
| US-20 Test tích hợp và E2E (phần E2E) | 5 | **Done**: 7 kịch bản Playwright chạy trong CI | #53 (A) |
| US-23 Nhiều topping, số ly theo lựa chọn | 5 | **Done** | #53 (A) |
| US-24 Công thức và số ly cho nhân viên | 5 | **Done** | #53 (A) |
| US-25 Hoàn thiện giao diện, PWA | 3 | **Done** | #53 (A) |

Sửa lỗi trong Sprint: xác nhận QR đồng thời có thể trả "thành công" hai lần (chỉ trừ tiền một lần) làm test CI chập chờn, sửa ở PR #51; hai lỗi cấu hình job E2E (tên script seed, phiên bản Ubuntu) phát hiện ngay trên CI và sửa trong PR #53.

Sau khi phát hành `v1.1.0`, kiểm thử thủ công trên production phát hiện 3 lỗi: nhân viên đăng xuất không về trang chủ, chữ "100%" ở nút mức đường/đá bị cắt, Chrome không tải được biểu tượng PWA. Sửa ở PR #55, phát hành `v1.1.1` ([release notes](../release/release-notes-v1.1.1.md)).

### Demo

- Production `v1.1.0`: chọn món nhiều topping, giỏ hàng chặn vượt nguyên liệu, theo dõi đơn `/orders/[id]`; nhân viên xem `/staff/recipes`, nhập kho và thấy số ly tăng.
- CI: 2 job xanh trên PR #53; CD tag `v1.1.0` và `v1.1.1` xanh.
- Kiểm thử thủ công trên production: luồng khách với cả 4 cách thanh toán (kể cả thất bại), quầy nhân viên, công thức và nhập kho, điện thoại, kiểm tra lại 3 lỗi sau `v1.1.1`.

Bằng chứng: thư mục `AS2-bang-chung/task5` của nhóm, ảnh 27–67 (mô tả trong README của thư mục).

### Phản hồi của Product Owner

[cần C bổ sung]

## Sprint Retrospective

### Điều làm tốt

- Lấy các tình huống số lượng của AS1 làm tiêu chí: mỗi tình huống có test ở cả mức unit và integration trước khi làm giao diện.
- API số ly cho khách và kiểm tra lúc đặt đơn dùng chung một hàm tính, có test khẳng định hai bên cho cùng kết quả.
- Job E2E chạy trên database thật đã seed, bắt được lỗi cấu hình ngay trong PR thay vì sau khi phát hành.

### Điều chưa tốt

- **Góp ý của D (Giản Thiên Lực):** Cần kiểm thử giao diện thực tế trên cả máy tính và điện thoại trước khi phát hành, vì có những lỗi hiển thị chỉ được phát hiện khi kiểm tra trực tiếp trên production.
- Toàn bộ Sprint 3 do một người hiện thực; các thành viên khác chưa tham gia review mã.
- Hai lần CI đỏ vì cấu hình (tên script, hệ điều hành của runner) do chưa chạy thử job E2E trên GitHub trước khi mở PR.
- Test số lượng của AS1 lẽ ra nên được chuyển sang ngay từ Sprint 2.
- Ba lỗi giao diện của `v1.1.0` chỉ lộ ra khi thử tay trên production: E2E chưa có kịch bản đăng xuất nhân viên; E2E-T06b chỉ kiểm tra biểu tượng đầu tiên trả về được qua HTTP (chạy bằng `npm run start`, không trên image Docker), chưa kiểm tra Chrome dùng được biểu tượng để cài ứng dụng; và chưa xem giao diện ở màn hình rộng.
- B chưa theo dõi và review các PR giao diện của Sprint 3, chỉ kiểm tra lại phần dữ liệu (schema, seed) sau khi phát hành.

### Hành động

| Hành động | Người phụ trách |
|---|---|
| D kiểm tra luồng khách hàng trên production ở cả desktop và mobile, lưu ảnh hoặc video minh chứng | D |
| Mỗi PR có ít nhất một thành viên khác review và approve | Cả nhóm |
| Cố định phiên bản hệ điều hành của runner cho job phụ thuộc trình duyệt | A |
| Khi thêm job CI mới, chạy thử trên nhánh nháp trước khi gắn vào PR chính | A |
| Thêm E2E đăng xuất nhân viên và kiểm tra manifest có biểu tượng PNG 192 và 512; xem giao diện ở 375 px và 1920 px trước khi phát hành | A |
| Chạy lại `prisma migrate reset` và rà ERD với schema sau mỗi bản phát hành để chắc seed và sơ đồ vẫn khớp code | B |
