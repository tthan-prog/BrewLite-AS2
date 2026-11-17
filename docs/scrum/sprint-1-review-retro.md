# Sprint 1 (Task 4) – Sprint Review và Retrospective

- **Thời gian:** 14/11/2026 – 15/11/2026 (Task 1–3 làm trước, Sprint 1 chạy Task 4)
- **Sprint Goal:** có nền tảng kỹ thuật (repository, CI, database có migration và seed) và MVP đầu tiên chạy được cho luồng xem menu.
- **Người dự:** Nguyễn Lê Nhựt Thắng (A, Scrum Master), Hồ Thiên Ngân (B), Hà Thiên Long (C, Product Owner), Giản Thiên Lực (D)
- **Kết quả:** Đạt Sprint Goal. 5/5 user story Done, 16/16 story point.

## Sprint Review

### Increment đã hoàn thành

| User story | Point | Kết quả | PR |
|---|---|---|---|
| US-01 Xem danh sách món | 5 | `GET /products`; trang `/menu` có loading, empty, error, dùng được ở 360–414 px | #11 (D), #17 (A) |
| US-02 Xem chi tiết món | 3 | `GET /products/:id` có size, topping, mức đường và đá; 404 khi không có | #17 (A) |
| US-03 Database có migration và seed | 3 | Prisma schema 17 model khớp ERD, migration `init`, seed chạy lặp lại được | #15 (B) |
| US-04 CI chặn merge khi lỗi | 3 | Workflow Install → Lint → Unit Test → Build; ruleset `protect-main` bắt buộc check xanh | #9 (A), #10 (minh chứng đỏ) |
| US-05 Product Backlog và Issues | 2 | `docs/scrum/product-backlog.md`; Issue US-01…US-05 gắn Milestone Sprint 1, đã đóng | #14 (A soạn, C đưa lên) |

Tài liệu Task 1–3 cũng đã vào `docs/` qua pull request: SRS và UC-01 (#2, #3), use case (#4), activity (#5), sequence (#7), class và ERD (#6, #13, #18), kiến trúc và 8 ADR (#8).

### Demo

- API chạy local với PostgreSQL: `/health` báo `db: up`, `/products` trả 6 món từ seed.
- Trang `/menu` lấy dữ liệu từ API thật.
- CI: PR #9 xanh; PR #10 cố ý làm test lỗi, CI đỏ và nút merge bị khóa.

Bằng chứng: thư mục `AS2-bang-chung/task4` của nhóm (ảnh 01–17).

### Phản hồi của Product Owner

[cần C bổ sung]

## Sprint Retrospective

### Điều làm tốt

- Làm đúng thứ tự Task 1 → 4: task sau chỉ merge khi tạo phẩm của task trước đã có trên `main`.
- Mọi thay đổi đi qua pull request và CI; ruleset chặn push thẳng lên `main`.
- Mỗi người tự commit phần của mình bằng tài khoản riêng.

### Điều chưa tốt

- **Góp ý của D (Giản Thiên Lực):** Khi làm trang Menu, việc cấu hình giao diện và kết nối API chưa được kiểm tra đầy đủ từ đầu nên phải chỉnh sửa trước khi merge.
- Một số tạo phẩm phải sửa nhiều lần trước khi merge: ảnh sơ đồ là PNG nhưng đặt đuôi `.svg`, `erd.puml` bị lỗi cú pháp, trang menu dùng class Tailwind khi chưa cài Tailwind, bản backlog đầu chép kế hoạch cũ.
- Công cụ gặp lỗi môi trường: Jest không chạy với NestJS 12 (chuyển sang Vitest); Windows Smart App Control chặn binary của SWC (bỏ SWC, dùng `@Inject` tường minh).
- Nhiều PR được merge mà chưa có approve của thành viên khác (ruleset đặt 0 approval), chưa đạt đủ mục 4 của Definition of Done.
- Sơ đồ class và ERD (B) vẽ khi chưa đối chiếu hết UC-01 nên phải sửa sau khi đã merge (bỏ `Product.stock`, `usesRecipe`, PR #13); PR #13 chỉ đưa file `.puml`, ảnh PNG trên `main` vẫn là bản cũ cho tới PR #18.

### Hành động cho Sprint 2

| Hành động | Người phụ trách |
|---|---|
| D kiểm tra cấu hình giao diện và kết nối API trên máy trước khi mở PR | D |
| Chạy `npm run lint`, `npm test`, `npm run build` trên máy trước khi push | Cả nhóm |
| Mở PR nhỏ, mô tả PR ghi Issue, mã FR/NFR, tick Definition of Done | Cả nhóm |
| Có ít nhất một thành viên review trước khi merge; ghi người review trong PR | A theo dõi |
| Thống nhất hợp đồng API trước khi làm giao diện (`docs/api/api-contract.md`) | A |
