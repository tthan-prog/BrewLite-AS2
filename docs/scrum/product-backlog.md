# Product Backlog – BrewLite Assignment 2 (AS2)

- **Repository AS2:** `https://github.com/tthan-prog/BrewLite-AS2`.
- **Product Owner tạm:** Hà Thiên Long (C).
- **Scrum Master:** Nguyễn Lê Nhựt Thắng (A).
- **Mốc nghiệm thu cuối cùng:** **15/11/2026**.
- **Nguyên tắc:** AS2 được thực hiện trên repository riêng và làm lại theo trình tự Task 1 → Task 2 → Task 3 → Task 4 → Task 5. Task sau chỉ được nghiệm thu khi tạo phẩm của Task trước đã có trên repository. PR sau chỉ mở sau khi PR trước đã merge, ngoại trừ các PR thuộc cùng một Task được phép thực hiện song song theo kế hoạch.

## 1. Danh sách hạng mục và mốc thời gian cập nhật

- **Sprint 1:** 14/11/2026 (Task 1–4; Review/Retrospective lúc 16:00).
- **Sprint 2:** 14–15/11/2026 (Task 5; hoàn tất release trước 16:00 ngày 15/11, video/slide trước 18:00).

| Ưu tiên | Mã | Hạng mục | Tiêu chí hoàn thành chính | Thời gian / PR |
|---|---|---|---|---|
| 1 | 4.1 | Thiết lập repository, cấu trúc `apps/web`, `apps/api`, README, `.gitignore`, `.env.example`, quy ước branch/commit và DoD; tạo Product Backlog và bảng Issues Sprint 1, 2 | Repository có cấu trúc và tài liệu hướng dẫn; quy ước làm việc được ghi rõ; backlog và Issues được tạo | 14/11 trước 11:30 – PR 7 |
| 2 | 4.2 | Quản lý tài liệu: đưa tạo phẩm Task 1–3 vào `docs`, thay đổi qua PR | Có tài liệu yêu cầu, use case, activity, sequence, class/ERD, kiến trúc, ADR và deployment diagram theo các PR 1–6 | 14/11 trước 10:30 – PR 1–6 |
| 3 | 4.3 | MVP: Prisma schema, migration, seed; Products API; trang menu mobile-first; loading, empty, error và test component/API | Có schema và dữ liệu mẫu; `GET /products`, `GET /products/:id` hoạt động; trang menu chạy được và có kiểm thử | 14/11 trước 13:30–15:30 – PR 9–11 |
| 4 | 4.4 | CI: Install → Lint → Unit Test → Build; bật bảo vệ nhánh | Có minh chứng một lần CI đỏ và một lần CI xanh; PR bị chặn khi CI không đạt | 14/11 trước 12:30 – PR 8 |
| 5 | 5.1 | Hoàn thiện luồng MVP: chi tiết món, size, topping, giỏ hàng, đăng ký/đăng nhập JWT, tạo đơn, thanh toán Ví/Thẻ mô phỏng, xác nhận và lịch sử đơn; validate và xử lý lỗi | Luồng từ menu đến lịch sử đơn hoạt động; các giao diện và API được tích hợp | 14/11 16:00–24:00 – PR 12–18 |
| 6 | 5.2 | Kiểm thử và tích hợp: unit, integration, E2E; Docker Compose; `/health` | Có unit test, integration test và ít nhất một E2E menu → xác nhận; Docker Compose và health check hoạt động | 14/11 trước 24:00 – PR 19 |
| 7 | 5.3 | CD: build Docker image, push GHCR, deploy Render, smoke test và rollback | Pipeline CD chạy được; image được đẩy lên GHCR; production được deploy và có minh chứng smoke test/rollback | 15/11 trước 08:00 – PR 20 |
| 8 | 5.1 mở rộng | Chức năng phụ: nhân viên xử lý đơn; kho nguyên liệu và công thức theo size/topping; thanh toán QR qua cổng mô phỏng; đổi điểm lấy phần thưởng | Từng chức năng có PR riêng; API, dữ liệu/seed và giao diện liên quan được tích hợp theo phân công | 15/11 08:00–14:00 – PR 21–24 |
| 9 | 5.4, 8 | Release và bàn giao: release notes, README, hướng dẫn chạy local/test/build/deploy/rollback, ma trận truy vết | Có release `v1.0.0`; tài liệu bàn giao và ma trận truy vết được đưa lên repository | 15/11 trước 16:00 – PR 25 |
| 10 | 5.4 | Sprint 2 Review/Retrospective, video demo production, báo cáo và slide | Có biên bản Review/Retro, video demo luồng end-to-end trên production, báo cáo và slide nộp bài | 15/11: Review/Retro lúc 16:00; video và slide trước 18:00 |

## 2. Kế hoạch PR và nghiệm thu chi tiết (14–15/11/2026)

Mỗi PR cần có người khác nghiệm thu và Approve trước khi merge. CI phải xanh từ Task 4 trở đi. Không mở PR của Task sau khi tạo phẩm Task trước chưa được merge.

| PR | Hạn chót | Nội dung | Task | Người mở / thực hiện | Người nghiệm thu |
|---:|---|---|---|---|---|
| 1 | 14/11 trước 07:00 | Bối cảnh, phạm vi, SRS (FR/NFR, MoSCoW, tiêu chí chấp nhận), đặc tả Use Case Đặt và thanh toán | 1.1, 1.2, 1.3 | C | B |
| 2 | 14/11 trước 08:00 | Use Case Diagram tổng quát và Use Case thanh toán | 1.2, 1.3 | D | C |
| 3 | 14/11 trước 09:00 | Activity Diagram (swimlane, hết hàng, chưa đăng nhập, thanh toán lỗi) | 2.1 | D | A |
| 4 | 14/11 trước 09:00 | Sequence Diagram đặt và thanh toán (JWT, validate, transaction, alt, idempotency) | 2.2 | A | D |
| 5 | 14/11 trước 09:00 | Class Diagram và ERD | 2.3 | B | A |
| 6 | 14/11 trước 10:30 | Mô tả kiến trúc, ADR và Deployment Diagram | 3.1, 3.2 | A | B |
| 7 | 14/11 trước 11:30 | Khung repo, README, `.gitignore`, `.env.example`, quy ước branch/commit, DoD; Product Backlog và bảng Issues Sprint 1, 2 | 4.1, 4.2 | A (repo), C (backlog) | B |
| 8 | 14/11 trước 12:30 | CI Install → Lint → Unit Test → Build; bật bảo vệ nhánh; một PR cố ý lỗi để minh chứng CI đỏ | 4.4 | A | C |
| 9 | 14/11 trước 13:30 | Prisma schema đủ bảng, migration và seed | 4.3 | B | A |
| 10 | 14/11 trước 14:30 | `GET /products`, `GET /products/:id` và test API | 4.3 | A | B |
| 11 | 14/11 trước 15:30 | Trang menu mobile-first, loading, empty, error và test component | 4.3 | D | A |
| 12–18 | 14/11 16:00–24:00 | Sprint 2: chi tiết món, size, topping; giỏ hàng; đăng ký/đăng nhập JWT; tạo đơn; thanh toán Ví/Thẻ; xác nhận và lịch sử đơn; validate | 5.1 | A (API), D (giao diện giỏ/thanh toán), C (giao diện đăng nhập/lịch sử) | Luân phiên theo PR |
| 19 | 14/11 trước 24:00 | Unit nghiệp vụ, tích hợp API đơn/thanh toán, E2E menu → xác nhận; `docker-compose.yml`; `/health` | 5.2 | C (test), A (Docker) | A, C |
| 20 | 15/11 trước 08:00 | Build Docker image, push GHCR, deploy Render, smoke test và rollback | 5.3 | A | B |
| 21–24 | 15/11 08:00–14:00 | Chức năng phụ: nhân viên xử lý đơn; kho nguyên liệu; QR; đổi thưởng (mỗi chức năng một PR) | 5.1 mở rộng | A (API), B (bảng mở rộng và seed công thức), D (trang đổi thưởng) | Luân phiên |
| 25 | 15/11 trước 16:00 | Release `v1.0.0`, release notes, README chạy local/test/build/deploy/rollback và ma trận truy vết | 5.4, 8 | A (release), C (truy vết) | B (release), C (truy vết) |

## 3. Phân công theo thành viên

| Thành viên | Phần việc chính | PR | Hạn chính |
|---|---|---|---|
| A – Nguyễn Lê Nhựt Thắng | Sequence diagram; kiến trúc/ADR/deployment; khung repo; CI; Products API và API Sprint 2; Docker Compose, `/health`; CD, Render, rollback; API chức năng phụ; release và tổng hợp báo cáo | 4, 6–8, 10, 12–20, 21–25 | Theo hạn từng PR; release trước 16:00 ngày 15/11 |
| B – Hồ Thiên Ngân | Class Diagram, ERD; Prisma schema, migration, seed; bảng nguyên liệu, công thức size/topping, phần thưởng và seed | 5, 9, 21–24 | 14/11 09:00; 14/11 13:30; 15/11 12:00 |
| C – Hà Thiên Long | Bối cảnh/phạm vi, SRS, đặc tả Use Case; Product Backlog và Issues; giao diện đăng nhập/đăng ký/lịch sử đơn; unit, integration, E2E; ma trận truy vết | 1, 7 (backlog), 12–18 (giao diện), 19 (test), 25 (truy vết) | 14/11 07:00; 14/11 11:30; 14/11 24:00; 15/11 16:00 |
| D – Giản Thiên Lực | Use Case Diagram; Activity Diagram; trang menu; giao diện chi tiết món/giỏ hàng/thanh toán và trang đổi thưởng; video demo và slide | 2, 3, 11, 12–18, 21–24 | 14/11 08:00, 09:00, 15:30; video/slide 15/11 18:00 |

## 4. Mốc kiểm tra và nghiệm thu

| Mốc | Thời gian | Điều kiện |
|---|---|---|
| Hoàn thành Task 1–3 | 14/11/2026 trước 10:30 | PR 1–6 đã được nghiệm thu và merge theo đúng thứ tự |
| Hoàn thành nền tảng Task 4 | 14/11/2026 trước 15:30 | PR 7–11 đã được nghiệm thu; CI có minh chứng đỏ và xanh |
| Đánh giá Sprint 1 | 14/11/2026 lúc 16:00 | Có biên bản Sprint Review và Retrospective; nếu PR 1–11 chưa xong thì báo giảng viên xin thêm thời gian ngay |
| Hoàn thành luồng MVP và kiểm thử | 14/11/2026 trước 24:00 | PR 12–19 hoàn thành theo kế hoạch; có test, Docker Compose và `/health` |
| Hoàn thành CD/production | 15/11/2026 trước 08:00 | PR 20 hoàn thành; deploy, smoke test và rollback có minh chứng |
| Hoàn thành chức năng mở rộng | 15/11/2026 trước 14:00 | PR 21–24 đã được nghiệm thu |
| **Nghiệm thu cuối cùng** | **15/11/2026 trước 16:00** | PR 25 được nghiệm thu; release `v1.0.0`, tài liệu bàn giao và ma trận truy vết sẵn sàng |
| Hoàn tất demo và nộp bài | 15/11/2026 trước 18:00 | Sprint Review/Retrospective, video demo production, báo cáo và slide hoàn tất |

## 5. Quy tắc cập nhật trạng thái và nghiệm thu

- Trạng thái `Done` chỉ được ghi khi tạo phẩm đã có trên repository AS2, PR đã được người khác nghiệm thu/Approve và đã merge.
- Không lấy trạng thái `Đạt DoD` trong biên bản Sprint cũ làm bằng chứng rằng PR tương ứng đã được thực hiện và nghiệm thu trên repository AS2 mới.
- Không sửa ngày commit hoặc lịch sử Git. Commit phải phản ánh ngày làm việc thực tế.
- Không đưa `.env`, mật khẩu hoặc token lên Git.
- Từ Task 4 trở đi, CI phải xanh trước khi merge; không tắt branch protection để né lỗi.
- Nếu chưa hoàn thành Sprint 1 trước 16:00 ngày 14/11, nhóm trưởng báo giảng viên và xin thêm thời gian theo kế hoạch trong file Word.
