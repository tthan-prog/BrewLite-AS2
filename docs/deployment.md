# Triển khai production

Tài liệu này mô tả bản production đang chạy. Các bước thao tác (tạo dịch vụ, seed, phát hành, rollback) nằm trong [deploy/runbook.md](deploy/runbook.md). Quyết định kiến trúc: [ADR 007](architecture/adr/007-deployment-render-ghcr.md).

## Thành phần

| Thành phần | Nơi chạy | URL / định danh |
|---|---|---|
| Web (Next.js) | Render Web Service `brewlite-as2-web`, image `ghcr.io/tthan-prog/brewlite-as2-web` | https://brewlite-as2-web.onrender.com |
| API (NestJS) | Render Web Service `brewlite-as2-api`, image `ghcr.io/tthan-prog/brewlite-as2-api` | https://brewlite-as2-api-k8xj.onrender.com |
| Health check | API | https://brewlite-as2-api-k8xj.onrender.com/health |
| Database | Render PostgreSQL 16 `brewlite-as2-db` | Chỉ kết nối nội bộ |
| Registry | GitHub Container Registry, package Public | `ghcr.io/tthan-prog/brewlite-as2-*` |

Tất cả dịch vụ Render ở region Singapore, gói Free, trong workspace riêng "BrewLite AS2" (không dùng chung với bản Assignment trước). Workspace riêng là bắt buộc vì Render chỉ cho một database Free mỗi workspace.

## Pipeline

```
push tag v* ─► CI (lint, unit, test HTTP, integration với PostgreSQL, build; job E2E Playwright)
            ─► build image API, Web ─► push GHCR (<tag>, sha-<commit>, latest)
            ─► đánh thức dịch vụ ─► deploy hook Render (imgURL = image <tag>)
            ─► smoke test: /health version = <tag> và db up, /products, trang / và /menu
```

Smoke test thất bại thì pipeline đỏ; dịch vụ giữ bản đang chạy hoặc rollback theo runbook.

## Cấu hình và secret

| Nơi | Tên | Ghi chú |
|---|---|---|
| Render, API | `DATABASE_URL` | Internal Database URL |
| Render, API | `JWT_SECRET` | Render sinh ngẫu nhiên |
| Render, API | `JWT_EXPIRES_IN` | `1d` |
| Render, API | `WEB_ORIGIN` | `https://brewlite-as2-web.onrender.com` (CORS) |
| Render, API | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`, `VNPAY_RETURN_URL` | VNPay sandbox (FR-21), tùy chọn; xem runbook mục 5 |
| GitHub Secrets | `RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB` | Deploy hook của từng dịch vụ |
| GitHub Variables | `API_URL`, `WEB_URL` | URL công khai, không phải secret |

`NEXT_PUBLIC_API_URL` của web được nhúng lúc build image từ biến `API_URL`.

## Bảo mật

- Database: Inbound IP Rules để trống, chỉ API trong cùng region Render kết nối được (NFR-03).
- Không có secret trong repository; `.env` nằm trong `.gitignore`.
- Seed production chỉ chạy một lần khi database trống (seed xóa toàn bộ dữ liệu trước khi tạo lại).
