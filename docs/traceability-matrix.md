# Ma trận truy vết – BrewLite (Assignment 2)

Truy vết từ yêu cầu (`docs/requirements/srs.md`) đến user story (`docs/scrum/product-backlog.md`), use-case, thiết kế, mã nguồn/API và test. Cập nhật đến **v1.1.1** (17/11/2026).

## 1. Ký hiệu

**Use-case và thiết kế**

| Mã | Tạo phẩm | Tệp |
|---|---|---|
| UC-00 | Use-case tổng quát | `docs/requirements/usecase-overview.puml` (.svg) |
| UC-01 | Đặc tả use-case Đặt và thanh toán đơn hàng | `docs/requirements/use-case-checkout.md`, `usecase-checkout.puml` (.svg) |
| Activity-01 | Activity diagram luồng đặt món (hết hàng, chưa đăng nhập, thanh toán thất bại) | `docs/diagrams/activity-order-flow.puml` (.svg) |
| Sequence-01 | Sequence diagram thanh toán (JWT, validate, transaction, alt, idempotency) | `docs/diagrams/sequence-checkout.puml` (.svg) |
| Class-01 | Class diagram domain | `docs/diagrams/class-domain.puml` (.png) |
| ERD-01 | Mô hình dữ liệu | `docs/diagrams/erd.puml` (.png), `apps/api/prisma/schema.prisma` |
| C4-01 | Container diagram | `docs/architecture/container-diagram.puml` (.svg), `docs/architecture/architecture.md` |
| Deploy-01 | Deployment diagram production | `docs/architecture/deployment-diagram.puml` (.svg), `docs/deployment.md` |
| ADR-00x | Quyết định kiến trúc | `docs/architecture/adr/001`–`008` |

**Test** (lệnh chạy: xem `README.md`)

| Mã | Loại | Tệp |
|---|---|---|
| UT-* | Unit test API | `apps/api/src/**/*.spec.ts` |
| WEB-* | Unit/component test giao diện | `apps/web/**/*.test.tsx` |
| API-T01–T07 | Test HTTP API (Prisma giả) | `apps/api/test/app.e2e-spec.ts` (theo thứ tự trong tệp) |
| AUTH-T01–T09 | Test HTTP xác thực, phân quyền, validate | `apps/api/test/auth-guard.e2e-spec.ts` |
| INT-A01–A11 | Integration: xác thực, đơn hàng | `apps/api/test/integration/auth-orders.int-spec.ts` |
| INT-P01–P10 | Integration: thanh toán Ví/Thẻ, idempotency, tồn kho đồng thời | `apps/api/test/integration/payments.int-spec.ts` |
| INT-Q01–Q09 | Integration: thanh toán QR | `apps/api/test/integration/qr-payments.int-spec.ts` |
| INT-V01–V06 | Integration: VNPay sandbox | `apps/api/test/integration/vnpay.int-spec.ts` |
| INT-R01–R09 | Integration: số ly làm được, công thức | `apps/api/test/integration/recipes-availability.int-spec.ts` |
| INT-S01–S08 | Integration: kho, đổi quà, tự hủy đơn | `apps/api/test/integration/staff-rewards.int-spec.ts` |
| E2E-T01–T07 | E2E trình duyệt (Playwright) trên API, web, PostgreSQL thật | `tests/e2e/brewlite-flow.spec.ts` |

Số thứ tự trong mã test là thứ tự `it(...)` trong tệp. Integration và E2E chạy trong CI với PostgreSQL thật (`.github/workflows/ci.yml`).

## 2. Yêu cầu chức năng

| Mã yêu cầu | Use-case / User story | Thiết kế / Sơ đồ | Code / API | Test |
|---|---|---|---|---|
| FR-01 Menu | US-01 Xem menu; UC-00 | Activity-01, Class-01 (Product) | `GET /products`; `apps/web/app/menu` | API-T03; UT `products.service.spec`; WEB `menu/page.test`; E2E-T01 |
| FR-02 Trạng thái menu | US-01 | Activity-01 | `apps/web/app/menu` (loading, rỗng, lỗi) | WEB `menu/page.test` |
| FR-03 Chi tiết, size, topping, đường, đá | US-02, US-06, US-23 | Activity-01, Class-01 (Product, Topping) | `GET /products/:id`; `apps/web/app/product/[id]` (tối đa 5 topping) | API-T04–T06; WEB `product/[id]/page.test`; E2E-T02 |
| FR-04 Giỏ hàng, tối đa 50 ly | US-06, US-23 | Activity-01 | `apps/web/app/cart`, `lib/cart.ts`; `POST /products/availability` | WEB `cart/page.test`; INT-R04; UT `availability.spec`; E2E-T02, E2E-T07 |
| FR-05 Đăng ký, đăng nhập, JWT, bcrypt | US-07; UC-01 (tiền điều kiện) | Sequence-01 (kiểm tra JWT); ADR-006 | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`; `apps/web/app/login`, `register` | UT `auth.service.spec`; INT-A01–A02; AUTH-T02, T09; WEB `login/page.test`; E2E-T02 |
| FR-06 Chặn đặt đơn khi chưa đăng nhập | US-07; UC-01 (luồng ngoại lệ) | Activity-01 (nhánh chưa đăng nhập), Sequence-01 | `JwtAuthGuard`; checkout chuyển `/login?next=` | AUTH-T01; WEB `checkout/page.test`; E2E-T03 |
| FR-07 Tạo đơn PENDING sau khi kiểm tra nguyên liệu | US-08; UC-01 | Activity-01 (nhánh hết hàng), Sequence-01, Class-01 (Order, OrderItem) | `POST /orders`; `orders.service.ts`, `inventory/order-needs.ts` | INT-A03, A05, A06; INT-R06; AUTH-T06; UT `pricing.spec`, `order-needs.spec` |
| FR-08 Thanh toán Ví/Thẻ, thất bại cho thử lại | US-09; UC-01 | Sequence-01 (alt thành công/thất bại); ADR-004 | `POST /payments`; `payment-gateway.ts`; `apps/web/app/checkout` | UT `payment-gateway.spec`; INT-P01, P04; AUTH-T08; WEB `checkout/payment.test`, `recovery.test`; E2E-T02 |
| FR-09 Idempotency-Key | US-09; UC-01 | Sequence-01 (gửi lại yêu cầu); ADR-005 | `PaymentsService.settle`, `@@unique([userId, idempotencyKey])` | INT-P02, P03, P08, P09; INT-Q05, Q06; AUTH-T07 |
| FR-10 Máy trạng thái đơn | US-11, US-12, US-25 | Class-01 (OrderStatus) | `orders/order-status.ts`, `PATCH /orders/:id/status`; `apps/web/app/orders/[id]` | UT `order-status.spec`; INT-A10, P10; AUTH-T05; WEB `orders/[id]/page.test` |
| FR-11 Lịch sử, chi tiết đơn | US-11, US-25 | Class-01 | `GET /orders/me`, `GET /orders/:id`; `apps/web/app/orders/history`, `orders/[id]` | INT-A07, A08; WEB `orders/history/page.test`, `orders/[id]/page.test`; E2E-T02 |
| FR-12 Trừ kho có điều kiện, hoàn kho khi hủy | US-10 | Sequence-01 (transaction); ADR-005 | `inventory/stock.ts` (`UPDATE … WHERE stock >= q`) | INT-P01, P06, P07, P10; INT-Q07 |
| FR-13 Mã khuyến mãi | US-13 | Class-01 (Promotion) | `orders/pricing.ts`; ô mã ở checkout | UT `pricing.spec`; INT-A03, A04, A11 |
| FR-14 Điểm thưởng | US-14 | Class-01 (LoyaltyTransaction) | `loyalty/loyalty.ts` | INT-P01, P10; INT-Q04; INT-V02 |
| FR-15 Nhân viên xử lý đơn | US-12 | Class-01 | `GET /orders?status=`, `PATCH /orders/:id/status`; `apps/web/app/staff` (đăng xuất về trang chủ từ v1.1.1) | INT-A08–A10; AUTH-T03, T04; WEB `staff/staff.test` |
| FR-16 Định lượng theo công thức, size, topping | US-02, US-08, US-23, US-24 | ERD-01 (RecipeItem, ToppingRecipeItem) | `inventory/recipe-calculator.ts`, `availability.ts`; `POST /products/availability`; `GET /ingredients/recipes` | UT `recipe-calculator.spec`, `availability.spec`; INT-R01–R03, R08, R09 |
| FR-17 Kho nguyên liệu, nhập thêm | US-15, US-24 | ERD-01 (Ingredient) | `GET /ingredients`, `PATCH /ingredients/:id/restock`, `GET /ingredients/recipes`; `apps/web/app/staff/ingredients`, `staff/recipes` | UT `ingredient-status.spec`; INT-S01–S03; INT-R07, R09; WEB `staff/staff.test`; E2E-T05 |
| FR-18 Thanh toán QR mô phỏng | US-16 | ADR-004 | `POST /payments/qr`, `/payments/qr/:token…`; `apps/web/app/pay/qr/[token]`, `components/qr-payment-panel.tsx` | INT-Q01–Q09; WEB `pay/qr/[token]/page.test`, `qr-payment-panel.test`; E2E-T04 |
| FR-19 Đổi quà | US-17 | Class-01 (LoyaltyTransaction) | `GET /rewards`, `POST /rewards/:id/redeem`, `GET /rewards/me`; `apps/web/app/rewards` | UT `reward-code.spec`; INT-S04–S07; WEB `rewards/rewards.test` |
| FR-20 Tự hủy đơn quá hạn | US-18 | Class-01 (OrderStatus) | `orders/order-expiry.service.ts` | UT `order-expiry.service.spec`; INT-S08 |
| FR-21 VNPay sandbox | US-19 | ADR-004 | `payments/vnpay/*` (HMAC-SHA512, Return URL, IPN); `apps/web/app/checkout/vnpay-return`, `components/vnpay-button.tsx` | UT `vnpay-signature.spec`; INT-V01–V06; WEB `vnpay-return/page.test`, `vnpay-button.test`; kiểm thử thật trên production 16/11/2026 (bằng chứng task5 ảnh 16–26) |
| FR-22, FR-23 | Won't | – | Không thực hiện | – |

## 3. Yêu cầu phi chức năng

| Mã yêu cầu | User story | Thiết kế | Hiện thực | Kiểm chứng |
|---|---|---|---|---|
| NFR-01 Hiệu năng `GET /products` | US-01 | C4-01 | Một truy vấn có include, dữ liệu seed | Đo thủ công khi chạy Docker Compose (Sprint 1); chưa có test tự động |
| NFR-02 Băm mật khẩu, PIN; JWT có hạn; phân quyền | US-07 | ADR-006, Sequence-01 | bcrypt, `JWT_EXPIRES_IN`, `RolesGuard` | UT `auth.service.spec`; AUTH-T01–T05; INT-A01; INT-R07; INT-Q03 |
| NFR-03 Secret không nằm trong repo/log | US-21 | Deploy-01, ADR-007 | `.env.example` không có giá trị thật; GitHub Secrets, biến Render | Rà soát repo; `docs/deployment.md`; database production chặn kết nối Internet |
| NFR-04 Validate đầu vào hai phía | US-07, US-08 | ADR-002 | `ValidationPipe` (whitelist, forbidNonWhitelisted), DTO; kiểm tra form ở web | AUTH-T06, T08, T09; INT-R05; WEB `login/page.test`, `product/[id]/page.test` |
| NFR-05 Mobile-first, PWA | US-01, US-25 | C4-01 | Tailwind; `app/manifest.ts`, `app/icon.svg`, `public/icon-192.png`, `public/icon-512.png` | E2E-T06 (375px không cuộn ngang, manifest); WEB `page.test` (kích thước biểu tượng); bằng chứng task5 ảnh 62, 65 |
| NFR-06 Thông báo lỗi tiếng Việt | US-25 | ADR-008 | Thông báo trong service, `lib/api.ts` | Các test INT, WEB kiểm tra nội dung thông báo |
| NFR-07 `docker compose up` | US-21 | Deploy-01 (local) | `docker-compose.yml`, Dockerfile | Bằng chứng task5 ảnh 04 |
| NFR-08 CI/CD, rollback | US-04, US-21 | Deploy-01, ADR-007 | `.github/workflows/ci.yml` (2 job), `cd.yml` (CI → GHCR → Render → smoke test, rollback bằng `workflow_dispatch`) | Lần chạy CI/CD trên GitHub Actions; bằng chứng task5 ảnh 02–03, 05, 14–15, 24, 27–28, 64 |
| NFR-09 `GET /health`, log | US-21 | ADR-008 | `health.controller.ts` (version, db) | UT `health.controller.spec`; API-T01, T02; smoke test CD |
| NFR-10 Migration, seed tái tạo được | US-03 | ERD-01, ADR-003 | `prisma/migrations`, `prisma/seed.ts` | CI migrate mỗi lần chạy; job E2E migrate và seed database mới |
| NFR-11 Lint, test tự động | US-04, US-20 | – | ESLint, Vitest, Playwright | CI job "Install, Lint, Unit Test, Build" (bắt buộc) và "E2E (Playwright)" |

## 4. Use-case UC-01 → bước → test

| Bước của UC-01 | Yêu cầu | Test |
|---|---|---|
| Chọn món, tùy chọn, thêm vào giỏ | FR-03, FR-04 | E2E-T02; WEB `product/[id]/page.test` |
| Chưa đăng nhập bị chuyển sang đăng nhập | FR-06 | E2E-T03; AUTH-T01 |
| Tạo đơn, kiểm tra nguyên liệu | FR-07, FR-16 | INT-A03, A05; INT-R06 |
| Thanh toán, idempotency | FR-08, FR-09 | INT-P01–P04, P08, P09; E2E-T02 |
| Thanh toán thất bại, thử lại | FR-08 | INT-P04; E2E-T02 |
| Trừ kho, cộng điểm | FR-12, FR-14 | INT-P01, P06, P07 |
| Xác nhận, theo dõi đơn | FR-10, FR-11 | E2E-T02; WEB `orders/[id]/page.test` |
