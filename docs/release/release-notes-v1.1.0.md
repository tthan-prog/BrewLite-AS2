# Release notes – BrewLite AS2 v1.1.0

- **Ngày phát hành:** 17/11/2026
- **Tag:** `v1.1.0` (commit `2eb672f`, main sau khi merge PR #53, #54)
- **Phiên bản trước:** [v1.0.0](release-notes-v1.0.0.md) (URL production, tài khoản thử, thẻ thử, cách rollback giữ nguyên)
- **Repository:** https://github.com/tthan-prog/BrewLite-AS2

## Truy cập production

| Thành phần | URL |
|---|---|
| Web (HTTPS) | https://brewlite-as2-web.onrender.com |
| API | https://brewlite-as2-api-k8xj.onrender.com |
| Health check | https://brewlite-as2-api-k8xj.onrender.com/health (`"version":"v1.1.0"`) |

## Thay đổi so với v1.0.0 (Sprint 3)

| User story | Nội dung | API | Giao diện |
|---|---|---|---|
| US-23 | Chọn nhiều topping cho một ly (tối đa 5). Số ly tối đa tính theo size, đường, đá, topping và các món khác trong giỏ; trang chi tiết món và giỏ hàng chặn đặt vượt nguyên liệu | `POST /products/availability` | `/product/[id]`, `/cart` |
| US-24 | Nhân viên xem công thức từng món theo size S/M/L, số ly làm được với tồn kho hiện tại, nguyên liệu giới hạn; nhập kho tại chỗ và số ly cập nhật ngay. Trang kho hiện "Dùng cho" kèm số ly | `GET /ingredients/recipes` | `/staff/recipes`, `/staff/ingredients` |
| US-25 | Trang chủ mới; hình minh họa đồ uống (SVG tự vẽ, thay ảnh món bị lỗi); trang theo dõi đơn `/orders/[id]` có tiến trình và tự cập nhật; manifest PWA; link "Quầy nhân viên" cho STAFF, nhân viên đăng nhập vào thẳng `/staff`; điều chỉnh hiển thị trên điện thoại | – | `/`, `/orders/[id]`, header |
| US-20 | Test E2E Playwright 7 kịch bản trên API, web và PostgreSQL thật; chạy trong CI ở job "E2E (Playwright)" | – | `tests/e2e` |

Không có migration mới. Không đổi biến môi trường.

## Kiểm thử

| Loại | Số test | Lệnh |
|---|---|---|
| Unit API | 62 | `npm test -w apps/api` |
| Test HTTP API (Prisma giả) | 16 | `npm run test:e2e -w apps/api` |
| Integration API (PostgreSQL thật) | 53 | `npm run test:int -w apps/api` |
| Unit web | 71 | `npm test -w apps/web` |
| E2E trình duyệt (Playwright) | 7 kịch bản | `cd tests/e2e && npx playwright test` |

Test số lượng thêm ở bản này, lấy theo các trường hợp của AS1: size L không đủ dù size S còn đủ; topping hết nguyên liệu; hai dòng trong giỏ tranh cùng nguyên liệu; giới hạn 50 ly mỗi dòng; không trả tồn kho cho khách; số ly giảm khi đơn được thanh toán và tăng khi nhập kho. Truy vết yêu cầu đến test: [docs/traceability-matrix.md](../traceability-matrix.md).

## Pipeline

- CI có 2 job: "Install, Lint, Unit Test, Build" (bắt buộc để merge) và "E2E (Playwright)" (migrate, seed database riêng, khởi động API và web, chạy Playwright trên Chromium). Job E2E chạy trên `ubuntu-24.04` vì Playwright 1.56 chưa hỗ trợ Ubuntu 26.04.
- CD gọi lại CI nên mỗi lần phát hành cũng chạy E2E trước khi build image.

## Hạn chế đã biết

- Như v1.0.0: Render Free tắt dịch vụ khi không có truy cập (lần mở đầu chậm); JWT không thu hồi được trước khi hết hạn; VNPay chỉ dùng sandbox.
- Số ly cho khách giới hạn ở 50 mỗi dòng để không lộ tồn kho; số ly cho nhân viên là số thật.
- Hiệu năng `GET /products` (NFR-01) mới đo thủ công, chưa có test tự động.

## Rollback

GitHub → Actions → CD → Run workflow với tag `v1.0.0` (xem `docs/deploy/runbook.md`). Bản này không có migration nên rollback không cần đổi database.
