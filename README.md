# BrewLite – Assignment 2

Ứng dụng web mobile-first để khách đặt đồ uống và thanh toán không tiền mặt; nhân viên xử lý đơn và quản lý nguyên liệu.

- Frontend: Next.js (`apps/web`)
- Backend: NestJS (`apps/api`)
- Database: PostgreSQL 16

## Cấu trúc repository

```
apps/
  api/        NestJS API
  web/        Next.js (mobile-first)
docs/
  requirements/   Task 1: bối cảnh, SRS, use case
  diagrams/       Task 2: activity, sequence, class, ERD
  architecture/   Task 3: kiến trúc, ADR, deployment diagram
  contributing.md Quy ước nhánh, PR, commit, Definition of Done
.github/workflows/  CI
docker-compose.yml
.env.example
```

## Yêu cầu

- Node.js 22 (xem `.nvmrc`), npm 10 trở lên
- Docker và Docker Compose (để chạy bằng container)

## Chạy bằng Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001, health check: http://localhost:3001/health
- PostgreSQL: `localhost:5432`

## Chạy khi phát triển

```bash
npm ci                         # cài thư viện, tự chạy "prisma generate" cho apps/api
cp .env.example .env           # dùng cho docker compose và API
cp .env.example apps/api/.env  # dùng cho Prisma CLI khi chạy trong apps/api
docker compose up -d db        # chỉ chạy PostgreSQL
npm run db:migrate -w apps/api # áp migration vào database local
npm run db:seed -w apps/api    # nạp dữ liệu mẫu
npm run dev:api                # API ở cổng 3001
npm run dev:web                # Web ở cổng 3000
```

Khi chạy bằng `docker compose up --build`, container `api` tự áp migration (`prisma migrate deploy`) trước khi khởi động. Nạp dữ liệu mẫu từ máy (database mở cổng 5432): `npm run db:seed -w apps/api`.

### Tài khoản thử (dữ liệu seed, chỉ dùng để kiểm thử)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `customer@brewlite.test` | `Customer@123` |
| Nhân viên | `staff@brewlite.test` | `Staff@123` |

Tài khoản thanh toán QR thử: `TEST-0001` (số dư 1.000.000đ), `TEST-0002` (số dư 10.000đ), PIN `123456`.

## API hiện có

Chi tiết request, response và mã lỗi: [docs/api/api-contract.md](docs/api/api-contract.md).

| Phương thức | Đường dẫn | Quyền | Mô tả | Yêu cầu |
|---|---|---|---|---|
| GET | `/health` | Công khai | Trạng thái API và database (`503` khi database lỗi) | NFR-09 |
| GET | `/products` | Công khai | Danh sách món: giá, danh mục, còn hàng, số ly tối đa đặt được | FR-01, FR-16 |
| GET | `/products/:id` | Công khai | Chi tiết món kèm size (phụ phí), topping, mức đường và đá | FR-03, FR-16 |
| POST | `/auth/register` | Công khai | Đăng ký tài khoản khách hàng | FR-05 |
| POST | `/auth/login` | Công khai | Đăng nhập, trả `accessToken` (JWT) | FR-05 |
| GET | `/auth/me` | Đăng nhập | Thông tin tài khoản và điểm thưởng | FR-05, FR-14 |
| POST | `/orders` | Đăng nhập | Tạo đơn PENDING, kiểm tra nguyên liệu, áp mã khuyến mãi | FR-06, FR-07, FR-13 |
| GET | `/orders/me` | Đăng nhập | Lịch sử đơn của tôi | FR-11 |
| GET | `/orders/:id` | Chủ đơn hoặc STAFF | Chi tiết đơn | FR-11 |
| GET | `/orders?status=` | STAFF | Danh sách đơn theo trạng thái | FR-15 |
| PATCH | `/orders/:id/status` | STAFF | Chuyển trạng thái đơn theo máy trạng thái | FR-10, FR-15 |
| POST | `/payments` | Đăng nhập | Thanh toán Ví hoặc Thẻ mô phỏng, header `Idempotency-Key` bắt buộc | FR-08, FR-09, FR-12, FR-14 |
| POST | `/payments/qr` | Đăng nhập | Tạo mã QR thanh toán (hạn 5 phút) | FR-18 |
| GET | `/payments/qr/:token/status` | Chủ đơn | Trạng thái mã QR | FR-18 |
| GET | `/payments/qr/:token` | Công khai | Thông tin cho trang xác nhận trên điện thoại | FR-18 |
| POST | `/payments/qr/:token/confirm` | Công khai | Chọn tài khoản thử, nhập PIN để thanh toán | FR-18 |
| GET | `/payments/vnpay/config` | Công khai | VNPay sandbox đã bật chưa | FR-21 |
| POST | `/payments/vnpay` | Đăng nhập | Tạo URL thanh toán VNPay sandbox đã ký | FR-21 |
| GET | `/payments/vnpay/return` | Công khai | Kiểm tra chữ ký, số tiền và chốt đơn khi VNPay chuyển khách về | FR-21 |
| GET | `/payments/vnpay/ipn` | VNPay | Thông báo máy chủ–máy chủ của VNPay | FR-21 |
| GET | `/ingredients` | STAFF | Tồn kho nguyên liệu kèm cờ hết, sắp hết | FR-17 |
| PATCH | `/ingredients/:id/restock` | STAFF | Nhập thêm nguyên liệu | FR-17 |
| GET | `/rewards` | Công khai | Danh sách quà đổi bằng điểm | FR-19 |
| POST | `/rewards/:id/redeem` | Đăng nhập | Đổi điểm lấy mã quà | FR-19 |
| GET | `/rewards/me` | Đăng nhập | Mã quà đã đổi | FR-19 |

Đơn chưa thanh toán tự hủy sau `ORDER_TIMEOUT_MINUTES` phút (mặc định 15, FR-20).

## Lint, test, build

```bash
npm run lint                     # ESLint cho api và web
npm test                         # Unit test (Vitest) cho api và web
npm run test:e2e -w apps/api     # Test HTTP của API (supertest, Prisma giả lập)
npm run build                    # Build api và web
npm run check:secrets            # NFR-03: quét secret trong các tệp Git theo dõi
npm run test:perf                # NFR-01: 20 yêu cầu GET /products, p95 < 500 ms (cần API đang chạy, đã seed)
```

Chi tiết hai test phi chức năng: [tests/perf/README.md](tests/perf/README.md).

Test tích hợp dùng PostgreSQL thật. Test sẽ **xóa toàn bộ dữ liệu** của database được trỏ tới, nên dùng database riêng, không dùng database đang chạy thử:

```bash
docker compose up -d db
docker compose exec db createdb -U brewlite brewlite_test
cd apps/api
# PowerShell: $env:DATABASE_URL="postgresql://brewlite:brewlite@localhost:5432/brewlite_test?schema=public"
export DATABASE_URL="postgresql://brewlite:brewlite@localhost:5432/brewlite_test?schema=public"
npx prisma migrate deploy
npm run test:int
```

Test E2E trên trình duyệt (Playwright, `tests/e2e`) chạy trên API, web và database thật đã seed; cách chạy trên máy xem [tests/e2e/README.md](tests/e2e/README.md).

CI chạy Install → Kiểm tra secret → Lint → Unit Test → E2E Test → Integration Test (PostgreSQL trong service container) → Build cho mọi pull request (`.github/workflows/ci.yml`). Job thứ hai **E2E (Playwright)** migrate và seed một database riêng, khởi động API và web, đo hiệu năng `GET /products` (NFR-01) rồi chạy các kịch bản Playwright trên Chromium; khi lỗi, báo cáo và log được lưu thành artifact.

## Triển khai (CD)

Push tag `v*` chạy `.github/workflows/cd.yml`: CI → build image API và Web → push GHCR → deploy Render → smoke test `/health` (đúng phiên bản, database up), `/products`, trang `/` và `/menu`. Rollback: Actions → CD → Run workflow với tag cũ.

Cấu hình Render, biến môi trường, seed production và rollback: [docs/deploy/runbook.md](docs/deploy/runbook.md).

## Quy ước làm việc

Xem [docs/contributing.md](docs/contributing.md): chiến lược nhánh, pull request, quy ước commit, Definition of Done.

## Tài liệu

- Yêu cầu: [docs/requirements](docs/requirements)
- Sơ đồ: [docs/diagrams](docs/diagrams)
- Kiến trúc và ADR: [docs/architecture](docs/architecture)
- API: [docs/api/api-contract.md](docs/api/api-contract.md)
- Ma trận truy vết (yêu cầu → user story → thiết kế → code → test): [docs/traceability-matrix.md](docs/traceability-matrix.md)
- Triển khai production: [docs/deployment.md](docs/deployment.md), runbook: [docs/deploy/runbook.md](docs/deploy/runbook.md)
- Scrum: [Product Backlog](docs/scrum/product-backlog.md), [Sprint 1 Review và Retro](docs/scrum/sprint-1-review-retro.md), [Sprint 2 Review và Retro](docs/scrum/sprint-2-review-retro.md), [Sprint 3 Review và Retro](docs/scrum/sprint-3-review-retro.md)
- Báo cáo LaTeX Bài tập lớn 2 (mẫu SGU): [docs/report](docs/report)
- Kịch bản test API bằng Postman (83 request, chạy được bằng newman): [docs/postman](docs/postman/README.md)
- Phiên bản: [CHANGELOG.md](CHANGELOG.md), [release notes v1.0.0](docs/release/release-notes-v1.0.0.md), [release notes v1.1.0](docs/release/release-notes-v1.1.0.md), [release notes v1.1.1](docs/release/release-notes-v1.1.1.md)

## Production

- Web: https://brewlite-as2-web.onrender.com
- API: https://brewlite-as2-api-k8xj.onrender.com, health check: https://brewlite-as2-api-k8xj.onrender.com/health

Gói Free của Render ngủ khi không có truy cập; lần mở đầu có thể chậm khoảng 50 giây.
