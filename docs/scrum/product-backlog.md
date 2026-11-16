# Product Backlog – BrewLite (Assignment 2)

- **Repository:** https://github.com/tthan-prog/BrewLite-AS2
- **Product Owner:** Hà Thiên Long (C)
- **Scrum Master:** Nguyễn Lê Nhựt Thắng (A)
- **Development Team:** Nguyễn Lê Nhựt Thắng (A), Hồ Thiên Ngân (B), Hà Thiên Long (C), Giản Thiên Lực (D)
- **Nguồn yêu cầu:** `docs/requirements/srs.md` (mã FR/NFR, mức ưu tiên MoSCoW, tiêu chí chấp nhận), `docs/requirements/use-case-checkout.md` (UC-01)
- **Quy ước làm việc và Definition of Done:** `docs/contributing.md`

## 1. Sprint

| Sprint | Task của đề | Sprint Goal |
|---|---|---|
| Sprint 1 | Task 4 | Có nền tảng kỹ thuật (repository, CI, database có migration và seed) và MVP đầu tiên chạy được cho luồng xem menu |
| Sprint 2 | Task 5 | Hoàn thành luồng đặt và thanh toán end-to-end, tự động đóng gói và triển khai bản production truy cập được qua HTTPS |

Thứ tự ưu tiên trong mỗi Sprint: Must trước, sau đó Should, cuối cùng Could. Hạng mục Won't (FR-22, FR-23) không đưa vào backlog.

## 2. Product Backlog

Story point theo thang Fibonacci (1, 2, 3, 5, 8). Trạng thái: **Done** (đã merge vào `main`, đạt Definition of Done), **In progress**, **To do**. Mỗi user story tương ứng một GitHub Issue cùng mã, gắn Milestone `Sprint 1` hoặc `Sprint 2`.

### Sprint 1

| Mã | User story | Yêu cầu | MoSCoW | Point | Tiêu chí chấp nhận chính | Người làm | Trạng thái |
|---|---|---|---|---|---|---|---|
| US-01 | Là khách hàng, tôi muốn xem danh sách món với giá và tình trạng còn hàng để chọn đồ uống | FR-01, FR-02, NFR-05 | Must | 5 | `GET /products` trả danh sách món từ seed; trang `/menu` hiển thị đủ món, có trạng thái loading, empty, error và dùng được trên màn hình 360–414 px | D (giao diện), A (API) | Done (PR #11, #17) |
| US-02 | Là khách hàng, tôi muốn xem chi tiết món với size, topping, mức đường và đá để biết lựa chọn của mình | FR-03, FR-16 | Must | 3 | `GET /products/:id` trả size kèm phụ phí, topping kèm tình trạng, mức đường và đá; món không tồn tại trả 404 | A | Done – API (PR #17); giao diện chi tiết thuộc US-05 |
| US-03 | Là nhóm phát triển, tôi muốn có database với migration và dữ liệu mẫu để chạy và kiểm thử hệ thống giống nhau ở mọi máy | NFR-10 | Must | 3 | Prisma schema khớp ERD; migration áp được trên database trống; seed chạy lặp lại được | B | Done (PR #15) |
| US-04 | Là nhóm phát triển, tôi muốn CI tự chạy lint, test, build và chặn merge khi lỗi để giữ `main` luôn chạy được | NFR-08, NFR-11 | Must | 3 | Workflow Install → Lint → Unit Test → Build chạy trên mọi pull request; ruleset bắt buộc check xanh mới merge; có minh chứng một lần đỏ và một lần xanh | A | Done (PR #9, #10) |
| US-05 | Là nhóm phát triển, tôi muốn có Product Backlog và bảng Issues cho Sprint 1, 2 để theo dõi tiến độ | – | Must | 2 | Có file backlog này; mỗi user story có Issue gắn Milestone | C | Done (PR #14) |

### Sprint 2

| Mã | User story | Yêu cầu | MoSCoW | Point | Tiêu chí chấp nhận chính | Người làm | Trạng thái |
|---|---|---|---|---|---|---|---|
| US-06 | Là khách hàng, tôi muốn chọn size, topping, đường, đá và thêm món vào giỏ để đặt nhiều món một lần | FR-03, FR-04 | Must | 5 | Trang chi tiết món cập nhật giá theo lựa chọn; giỏ hàng sửa và xóa được; tổng tiền đúng; không quá 50 ly mỗi dòng hoặc quá số ly còn đặt được | D | Done (giao diện PR #12) |
| US-07 | Là khách hàng, tôi muốn đăng ký và đăng nhập để đặt đơn và xem lại đơn của mình | FR-05, FR-06, NFR-02 | Must | 5 | Đăng nhập đúng nhận JWT; sai mật khẩu trả 401; mật khẩu băm bằng bcrypt; chưa đăng nhập thì không đặt đơn được và giỏ hàng được giữ | A (API), C (giao diện) | Done (API PR #42, giao diện PR #19) |
| US-08 | Là khách hàng, tôi muốn đặt đơn từ giỏ hàng để cửa hàng chuẩn bị đồ uống | FR-07, FR-16 | Must | 5 | Đơn tạo ở trạng thái PENDING sau khi kiểm tra đủ nguyên liệu cho cả đơn; thiếu nguyên liệu trả 400 và không tạo đơn | A (API), D (giao diện) | Done (API PR #42, giao diện PR #12) |
| US-09 | Là khách hàng, tôi muốn thanh toán bằng Ví hoặc Thẻ mô phỏng và không bị trừ tiền hai lần khi bấm lại | FR-08, FR-09 | Must | 8 | Thành công thì đơn PAID; thất bại thì PAYMENT_FAILED và cho thử lại; gửi lại cùng Idempotency-Key chỉ có một bản ghi Payment | A (API), D (giao diện) | Done (API PR #42, giao diện PR #12) |
| US-10 | Là quản lý cửa hàng, tôi muốn không bán vượt nguyên liệu khi nhiều khách thanh toán cùng lúc | FR-12 | Must | 5 | Trừ kho bằng cập nhật có điều kiện trong transaction; test N thanh toán đồng thời không làm tồn kho âm | A | Done (PR #42) |
| US-11 | Là khách hàng, tôi muốn xem xác nhận, trạng thái và lịch sử đơn để theo dõi đơn của mình | FR-10, FR-11 | Must | 3 | `GET /orders/me` chỉ trả đơn của người đăng nhập; xem đơn người khác trả 404; trang lịch sử hiển thị mã đơn, ngày, trạng thái, tổng tiền | A (API), C (giao diện) | Done (API PR #42, giao diện PR #19) |
| US-12 | Là nhân viên, tôi muốn xem đơn theo trạng thái và chuyển trạng thái đơn để xử lý pha chế | FR-10, FR-15 | Should | 5 | Chỉ STAFF gọi được API đổi trạng thái (CUSTOMER nhận 403); chuyển trạng thái sai trả 400 | A | Done (API PR #42, trang nhân viên PR #48) |
| US-13 | Là khách hàng, tôi muốn dùng mã khuyến mãi để được giảm giá | FR-13 | Should | 3 | Mã hợp lệ giảm đúng; mã sai, hết hạn, hết lượt bị từ chối kèm lý do | A | Done (API PR #42, giao diện PR #12) |
| US-14 | Là khách hàng, tôi muốn được cộng điểm khi thanh toán để nhận ưu đãi | FR-14 | Should | 3 | Cộng 1 điểm mỗi 10.000đ khi đơn PAID; trừ lại khi hủy đơn đã PAID; mỗi thay đổi có LoyaltyTransaction | A | Done (PR #42) |
| US-15 | Là nhân viên, tôi muốn xem tồn kho nguyên liệu và nhập thêm để không bị hết hàng | FR-17 | Should | 3 | Chỉ STAFF xem và nhập kho; số lượng nhập phải dương; hiển thị cờ "Sắp hết", "Hết" | A (API), B (dữ liệu) | Done (API PR #44, trang kho PR #48) |
| US-16 | Là khách hàng, tôi muốn thanh toán bằng QR qua cổng mô phỏng bằng điện thoại | FR-18 | Should | 5 | Đúng PIN và đủ số dư thì đơn PAID; sai PIN, thiếu số dư, QR hết hạn thì không trừ tiền | A | Done (PR #49, #51; gắn vào trang thanh toán PR #12) |
| US-17 | Là khách hàng, tôi muốn đổi điểm lấy quà để dùng tại quầy | FR-19 | Could | 3 | Đủ điểm thì trừ điểm và trả mã quà; không đủ thì từ chối | D (giao diện), A (API) | Done (API PR #44, giao diện PR #12) |
| US-18 | Là quản lý, tôi muốn đơn chưa thanh toán tự hủy sau thời gian quy định | FR-20 | Could | 2 | Đơn PENDING quá hạn chuyển CANCELLED và trả lượt dùng mã khuyến mãi | A | Done (PR #44) |
| US-19 | Là khách hàng, tôi muốn thanh toán qua VNPay sandbox | FR-21 | Could | 5 | Return URL hợp lệ (đúng chữ ký HMAC, đúng số tiền) thì đơn PAID; sai thì từ chối | A | Done (PR #50, nút trong trang thanh toán PR #12); đã thanh toán thử thành công trên production 16/11 |
| US-20 | Là nhóm phát triển, tôi muốn có test tích hợp và end-to-end cho luồng chính để phát hiện lỗi trước khi phát hành | NFR-11 | Must | 5 | Có integration test API tạo đơn và thanh toán; ít nhất một E2E từ menu đến xác nhận đơn | C | In progress – integration test API (PR #42, #44); E2E chưa có |
| US-21 | Là giảng viên, tôi muốn truy cập bản production qua HTTPS và hệ thống được triển khai tự động | NFR-03, NFR-07, NFR-08, NFR-09 | Must | 8 | Pipeline CD: lint, test, build image, push registry, deploy, smoke test `/health`, có cách rollback; database production không public; secret không nằm trong repository | A | Done (PR #43, #45, #46; production v0.9.2 → v1.0.0) |
| US-22 | Là giảng viên, tôi muốn có tài liệu bàn giao để chạy và kiểm tra hệ thống | – | Must | 3 | Release `v1.0.0` có release notes; README hướng dẫn chạy local, test, build, deploy, rollback; ma trận truy vết; Sprint Review và Retrospective; video demo | A, C, D | Done (release notes v1.0.0, README, runbook) |

## 3. Cập nhật backlog

- Trạng thái **Done** chỉ ghi khi pull request đã được review và merge vào `main`, đạt Definition of Done; ghi kèm số PR.
- Ngày hoàn thành thực tế lấy theo ngày đóng Issue và ngày merge PR trên GitHub.
- Thay đổi phạm vi (thêm, bỏ, đổi mức ưu tiên) cập nhật vào file này qua pull request và ghi lý do trong mô tả PR.
