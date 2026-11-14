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
npm ci
cp .env.example .env
docker compose up -d db      # chỉ chạy database
npm run dev:api              # API ở cổng 3001
npm run dev:web              # Web ở cổng 3000
```

## Lint, test, build

```bash
npm run lint                     # ESLint cho api và web
npm test                         # Unit test (Vitest) cho api và web
npm run test:e2e -w apps/api     # Test tích hợp API (supertest)
npm run build                    # Build api và web
```

CI chạy các bước Install → Lint → Unit Test → Build cho mọi pull request (`.github/workflows/ci.yml`).

## Quy ước làm việc

Xem [docs/contributing.md](docs/contributing.md): chiến lược nhánh, pull request, quy ước commit, Definition of Done.

## Tài liệu

- Yêu cầu: [docs/requirements](docs/requirements)
- Sơ đồ: [docs/diagrams](docs/diagrams)
- Kiến trúc và ADR: [docs/architecture](docs/architecture)
