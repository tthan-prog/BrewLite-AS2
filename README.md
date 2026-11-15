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

| Phương thức | Đường dẫn | Mô tả | Yêu cầu |
|---|---|---|---|
| GET | `/health` | Trạng thái API và database (`503` khi database lỗi) | NFR-09 |
| GET | `/products` | Danh sách món: giá, danh mục, còn hàng, số ly tối đa đặt được | FR-01, FR-16 |
| GET | `/products/:id` | Chi tiết món kèm size (phụ phí), topping, mức đường và đá | FR-03, FR-16 |

## Lint, test, build

```bash
npm run lint                     # ESLint cho api và web
npm test                         # Unit test (Vitest) cho api và web
npm run test:e2e -w apps/api     # Test tích hợp HTTP của API (supertest, Prisma giả lập)
npm run build                    # Build api và web
```

CI chạy các bước Install → Lint → Unit Test → Build cho mọi pull request (`.github/workflows/ci.yml`).

## Quy ước làm việc

Xem [docs/contributing.md](docs/contributing.md): chiến lược nhánh, pull request, quy ước commit, Definition of Done.

## Tài liệu

- Yêu cầu: [docs/requirements](docs/requirements)
- Sơ đồ: [docs/diagrams](docs/diagrams)
- Kiến trúc và ADR: [docs/architecture](docs/architecture)
