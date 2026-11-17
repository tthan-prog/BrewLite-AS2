# Sprint 2 (Task 5) – Sprint Review và Retrospective

- **Thời gian:** 15/11/2026 – 16/11/2026
- **Sprint Goal:** hoàn thành luồng đặt và thanh toán end-to-end, tự động đóng gói và triển khai bản production truy cập được qua HTTPS.
- **Người dự:** Nguyễn Lê Nhựt Thắng (A, Scrum Master), Hồ Thiên Ngân (B), Hà Thiên Long (C, Product Owner), Giản Thiên Lực (D)
- **Kết quả:** đạt Sprint Goal. Phát hành `v1.0.0` ngày 16/11/2026 (tag trên commit `54b69e3`, pipeline CD xanh); luồng xem menu → chọn tùy chọn → giỏ hàng → đặt đơn → thanh toán → theo dõi đơn chạy trên production. 16/17 user story của Sprint 2 hoàn thành; US-20 xong phần integration test, phần E2E giao diện chuyển sang Sprint 3.

## Sprint Review

### Tình trạng user story

Story point theo `product-backlog.md`. Trạng thái tại lúc đóng Sprint 2 (16/11/2026).

| User story | Point | Tình trạng | PR |
|---|---|---|---|
| US-06 Giỏ hàng | 5 | **Done** | #12 (D) |
| US-07 Đăng ký, đăng nhập | 5 | **Done** | #42 (A), #19 (C) |
| US-08 Tạo đơn | 5 | **Done** | #42 (A), #12 (D) |
| US-09 Thanh toán Ví/Thẻ, idempotency | 8 | **Done** | #42 (A), #12 (D) |
| US-10 Không bán vượt nguyên liệu | 5 | **Done** | #42 (A) |
| US-11 Xác nhận, lịch sử đơn | 3 | **Done** | #42 (A), #19 (C) |
| US-12 Nhân viên xử lý đơn | 5 | **Done** | #42, #48 (A) |
| US-13 Mã khuyến mãi | 3 | **Done** | #42 (A), #12 (D) |
| US-14 Điểm thưởng | 3 | **Done** | #42 (A) |
| US-15 Kho nguyên liệu | 3 | **Done** | #44, #48 (A), dữ liệu #15 (B) |
| US-16 Thanh toán QR | 5 | **Done**; sửa lỗi xác nhận đồng thời ở #51 | #49, #51 (A), gắn vào thanh toán #12 (D) |
| US-17 Đổi quà | 3 | **Done** | #44 (A), #12 (D) |
| US-18 Tự hủy đơn quá hạn | 2 | **Done** | #44 (A) |
| US-19 VNPay sandbox | 5 | **Done**; bật trên production từ `v0.9.3`, đã thanh toán thử thành công 2 đơn bằng thẻ test NCB, giao dịch hiện trong Merchant Admin VNPay | #50 (A), nút trong thanh toán #12 (D) |
| US-20 Test tích hợp và E2E | 5 | Integration test API xong (44 test khi đóng Sprint 2, CI chạy với PostgreSQL); E2E Playwright hoàn thành ở Sprint 3 | #42, #44, #51 (A); #53 (A) |
| US-21 Production và CD | 8 | **Done** | #43, #45, #46 (A) |
| US-22 Tài liệu bàn giao | 3 | **Done**: README, runbook, release notes `v1.0.0`, Sprint Review/Retro; ma trận truy vết bổ sung ở Sprint 3; video demo ghi ngoài repository | #47, #52 (A) |

### Demo

- Production: web https://brewlite-as2-web.onrender.com, API https://brewlite-as2-api-k8xj.onrender.com, `/health` trả đúng phiên bản và `db: up`.
- Pipeline CD tag `v0.9.2`: CI → build và push GHCR → deploy Render → smoke test, xanh trong 6 phút 45 giây.
- Luồng end-to-end trên giao diện sau khi merge PR #12, #19: chọn món → giỏ → đăng nhập → thanh toán Ví, Thẻ, QR, VNPay → lịch sử đơn → đổi quà; nhân viên chuyển trạng thái đơn và nhập kho.
- Phát hành: `v0.9.3` (trang nhân viên, QR, VNPay) và `v1.0.0` (giao diện khách hàng), CD xanh.

Bằng chứng: thư mục `AS2-bang-chung/task5` của nhóm.

### Phản hồi của Product Owner

[cần C bổ sung]

## Sprint Retrospective

### Điều làm tốt

- Hợp đồng API (`docs/api/api-contract.md`) có trước khi làm giao diện; giao diện của D gọi đúng API ngay lần nối đầu.
- Nghiệp vụ khó có test với database thật: thanh toán đồng thời, idempotency, hoàn kho; CI chạy cả test tích hợp.
- Pipeline CD phát hiện lỗi thật: lần `v0.9.1` smoke test báo bản cũ vẫn phục vụ, nhóm tìm ra nguyên nhân và sửa trong PR #46.
- Secret không nằm trong repository; database production chặn kết nối từ Internet.

### Điều chưa tốt

- Chép đè cả file khi làm nhiều nhánh: README bị mất mục Triển khai sau PR #44, phải sửa lại ở PR #45.
- Phát hiện giới hạn của Render muộn (mỗi workspace chỉ một database Free) nên phải tạo workspace mới giữa lúc triển khai.
- Chuỗi kết nối database bị dán vào kênh trao đổi khi seed production; đã khóa kết nối từ Internet ngay sau đó.
- Giao diện (PR #12, #19) xong chậm hơn API, làm chậm phát hành `v1.0.0` và test E2E.
- Nhiều PR vẫn merge khi chưa có người khác approve.

### Hành động

| Hành động | Người phụ trách |
|---|---|
| Khi nhiều nhánh cùng sửa một file, merge `main` vào nhánh rồi sửa, không chép đè cả file | Cả nhóm |
| Kiểm tra giới hạn gói miễn phí của nền tảng trước khi lên kế hoạch triển khai | A |
| Không dán chuỗi kết nối, mật khẩu, token vào chat hoặc ảnh chụp | Cả nhóm |
| Chia giao diện thành PR nhỏ theo từng trang để review và merge sớm | C, D |
| Bật yêu cầu 1 approval trong ruleset khi cả nhóm cùng online | A |
| Đối chiếu SRS, use case với sơ đồ trước khi vẽ; mở ảnh xuất ra và so với file `.puml` trước khi commit | B |

## Backlog cho phiên bản sau

Chuyển sang Sprint 3: test E2E giao diện (US-20), chọn nhiều topping và số ly theo lựa chọn (US-23), bảng công thức cho nhân viên (US-24), hoàn thiện giao diện (US-25). Không thực hiện: FR-22 giao diện quản trị, FR-23 cổng thanh toán thật.
