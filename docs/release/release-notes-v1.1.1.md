# Release notes – BrewLite AS2 v1.1.1

- **Ngày phát hành:** 17/11/2026
- **Tag:** `v1.1.1` (commit `6229753`, main sau khi merge PR #55)
- **Phiên bản trước:** [v1.1.0](release-notes-v1.1.0.md) (URL production, tài khoản thử, thẻ thử giữ nguyên)
- **Loại:** bản sửa lỗi (patch). Không có tính năng mới, không có migration, không đổi biến môi trường.

## Truy cập production

| Thành phần | URL |
|---|---|
| Web (HTTPS) | https://brewlite-as2-web.onrender.com |
| API | https://brewlite-as2-api-k8xj.onrender.com |
| Health check | https://brewlite-as2-api-k8xj.onrender.com/health (`"version":"v1.1.1"`) |

## Lỗi đã sửa

Ba lỗi được phát hiện khi nhóm kiểm thử thủ công bản `v1.1.0` trên production ngày 17/11/2026.

| Lỗi | Nguyên nhân | Cách sửa | Test |
|---|---|---|---|
| Nhân viên bấm "Đăng xuất" thì ở lại form đăng nhập nhân viên, không về trang web | Nút chỉ xóa phiên và đổi trạng thái trang `/staff` | Nút đăng xuất là liên kết về `/`, xóa token và thông tin người dùng trước khi chuyển trang | WEB `staff/staff.test` (đăng xuất về `/`, xóa token và người dùng) |
| Chữ "100%" ở nút mức đường, mức đá bị cắt trên màn hình rộng | Lớp `px-4` mặc định của nút đè lên `px-0` | Hàm tạo lớp nút nhận khoảng đệm riêng; nút đường/đá không có đệm ngang, không xuống dòng; hai nhóm nằm cạnh nhau từ màn hình `xl` | Kiểm tra trực quan ở 1920 px và 1024 px |
| Chrome báo không tải được biểu tượng ứng dụng trong manifest | Manifest chỉ có biểu tượng SVG; image web không chép thư mục `public` | Thêm `icon-192.png`, `icon-512.png` vào manifest; `apps/web/Dockerfile` chép `public` vào bản chạy | WEB `page.test` (manifest có 192x192, 512x512, any); bằng chứng task5 ảnh 63 (trước) và 65 (sau) |

## Kiểm thử

| Loại | Số test | Lệnh |
|---|---|---|
| Unit API | 62 | `npm test -w apps/api` |
| Test HTTP API (Prisma giả) | 16 | `npm run test:e2e -w apps/api` |
| Integration API (PostgreSQL thật) | 53 | `npm run test:int -w apps/api` |
| Unit web | 72 | `npm test -w apps/web` |
| E2E trình duyệt (Playwright) | 7 kịch bản | `cd tests/e2e && npx playwright test` |

CI của PR #55 và CD tag `v1.1.1` đều xanh (CI 2 job → build và push GHCR → deploy Render và smoke test, tổng 10m 56s; bằng chứng task5 ảnh 64).

## Kiểm thử thủ công trên production

Bộ ảnh 27–67 trong thư mục bằng chứng `AS2-bang-chung/task5` (mô tả trong README của thư mục): luồng khách (menu, giỏ hàng, thanh toán Ví, Thẻ, QR, VNPay, theo dõi đơn, lịch sử, đổi quà), quầy nhân viên (chuyển trạng thái, đơn tự hủy), công thức và số ly trước/sau nhập kho, giao diện điện thoại, và kiểm tra lại ba lỗi trên sau khi phát hành.

## Rollback

GitHub → Actions → CD → Run workflow với tag `v1.1.0` (xem `docs/deploy/runbook.md`). Không có migration nên rollback không cần đổi database.
