# Mô tả kiến trúc BrewLite (Assignment 2 – Task 3.1)

## 1. Phương pháp

Nhóm dùng **kiến trúc phân lớp** kết hợp chia **module theo domain** ở backend, trình bày theo hai mức của mô hình C4:

- **Mức Container:** trình duyệt, Next.js, NestJS API, PostgreSQL, cổng thanh toán.
- **Mức Component:** các module NestJS bên trong API.

Sơ đồ: `docs/architecture/container-diagram.puml` (kèm ảnh) và `docs/architecture/deployment-diagram.puml` (kèm ảnh).

Đầu vào của thiết kế:

- Yêu cầu: `docs/requirements/srs.md`, `docs/requirements/use-case-checkout.md`.
- Mô hình: các sơ đồ trong `docs/diagrams/` (activity, sequence, class, ERD).

## 2. Các container

| Container | Công nghệ | Trách nhiệm | Mã nguồn | Yêu cầu chính |
|---|---|---|---|---|
| Web app | Next.js (App Router), React, TypeScript | Giao diện mobile-first: menu, giỏ hàng, đặt đơn, thanh toán, lịch sử, màn hình nhân viên. Giỏ hàng lưu ở trình duyệt | `apps/web` | FR-01..04, FR-11, FR-15, NFR-05, NFR-06 |
| API | NestJS, TypeScript, Prisma | Toàn bộ nghiệp vụ: xác thực, đơn hàng, thanh toán, tồn kho, khuyến mãi, điểm thưởng. REST/JSON | `apps/api` | FR-05..FR-21, NFR-02, NFR-04 |
| Database | PostgreSQL 16 | Lưu dữ liệu theo ERD; transaction cho đặt đơn và thanh toán | `apps/api/prisma` (schema, migration, seed) | FR-12, NFR-10 |
| Cổng thanh toán mô phỏng | Module trong API (`MockPaymentGateway`) | Xử lý Ví, Thẻ, QR với tài khoản thử nghiệm; điều khiển được kết quả để kiểm thử | `apps/api/src/payments` | FR-08, FR-18 |
| VNPay sandbox | Dịch vụ bên ngoài, HTTPS | Thanh toán thử nghiệm qua redirect và Return URL | Adapter `VnpayGateway` trong `apps/api/src/payments` | FR-21 (Could) |

Luồng gọi: Trình duyệt → Web app (HTTPS) → API (HTTPS, JSON, JWT trong header `Authorization`) → PostgreSQL (kết nối nội bộ). Web app không truy cập database trực tiếp.

## 3. Các lớp và module của API

Mỗi module NestJS có ba lớp:

1. **Controller:** nhận HTTP request, kiểm tra JWT và vai trò (guard), validate DTO bằng `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
2. **Service:** nghiệp vụ, transaction, máy trạng thái đơn.
3. **Truy cập dữ liệu:** Prisma Client qua `PrismaService` dùng chung.

| Module | Trách nhiệm | Lớp domain (class diagram) |
|---|---|---|
| `auth` | Đăng ký, đăng nhập, phát JWT, guard theo vai trò | User, Role |
| `catalog` | Sản phẩm, topping, tính số ly còn đặt được theo nguyên liệu | Product, Topping |
| `inventory` | Công thức, định lượng theo size/topping/đường/đá, trừ và hoàn kho, nhập kho | Ingredient, RecipeItem, ToppingRecipeItem, OrderIngredientUse |
| `orders` | Tạo đơn, máy trạng thái, lịch sử, hủy đơn, tự hủy đơn quá hạn | Order, OrderItem, OrderStatus |
| `payments` | Thanh toán Ví/Thẻ/QR, idempotency, adapter cổng thanh toán | Payment, PaymentIntent, PaymentAccount |
| `promotions` | Kiểm tra và áp mã khuyến mãi | Promotion |
| `loyalty` | Cộng và trừ điểm, đổi quà | LoyaltyTransaction, Reward, RewardRedemption |
| `health` | `GET /health` kiểm tra API và kết nối database | – |

Quy tắc phụ thuộc: controller chỉ gọi service của module mình; service gọi service module khác qua interface công khai (ví dụ `orders` gọi `inventory.reserve()`), không truy cập trực tiếp bảng của module khác ngoài transaction dùng chung.

## 4. Các cơ chế xuyên suốt

| Cơ chế | Cách làm | Yêu cầu |
|---|---|---|
| Transaction và tồn kho | `prisma.$transaction`; trừ kho bằng `updateMany` có điều kiện `stock >= lượng cần`; số dòng cập nhật nhỏ hơn số nguyên liệu thì rollback | FR-12, UC-01 E4 |
| Idempotency | Header `Idempotency-Key`; ràng buộc `UNIQUE(user_id, idempotency_key)` trên `payments`; gửi lại cùng key trả kết quả đã lưu | FR-09 |
| Xác thực, phân quyền | JWT có hạn; mật khẩu và PIN băm bằng bcrypt; `RolesGuard` cho STAFF | FR-05, FR-06, NFR-02 |
| Cấu hình | Biến môi trường, kiểm tra khi khởi động; `.env.example` trong repo, `.env` không commit | NFR-03 |
| Logging | Logger của NestJS, mỗi request ghi method, path, status, thời gian; không ghi mật khẩu, PIN, token | NFR-09 |
| Health check | `GET /health` trả `{status: "ok", db: "up"}` | NFR-09 |
| Lỗi | Exception filter trả JSON thống nhất; frontend chuyển thành thông báo tiếng Việt | NFR-06 |
| Migration | Prisma Migrate; seed tái tạo dữ liệu mẫu | NFR-10 |

## 5. Lý do chọn, ưu điểm, hạn chế, trade-off

**Lý do chọn:** đề bắt buộc Next.js, NestJS và PostgreSQL. Kiến trúc phân lớp với module theo domain là cách tổ chức mặc định của NestJS, phù hợp với nhóm 4 người trong thời gian ngắn.

**Ưu điểm:**

- Một API duy nhất, một database: dễ dùng transaction cho đặt đơn và thanh toán, dễ chạy bằng Docker Compose.
- Module theo domain khớp với class diagram, dễ chia việc và dễ truy vết yêu cầu → module → test.
- Cổng thanh toán qua interface: đổi giữa mô phỏng và VNPay sandbox mà không sửa nghiệp vụ.

**Hạn chế:**

- Monolith: mọi module scale cùng nhau, một lỗi nghiêm trọng có thể làm dừng cả API.
- Frontend và backend tách hai dịch vụ nên phải cấu hình CORS và URL API theo môi trường.

**Trade-off đã chấp nhận:**

| Lựa chọn | Thay vì | Lý do |
|---|---|---|
| Modular monolith | Microservices | Quy mô nhỏ, cần transaction xuyên module (đơn, kho, thanh toán, điểm) |
| Trừ kho có điều kiện trong transaction | Khóa bi quan (`SELECT ... FOR UPDATE`) hoặc hàng đợi | Đơn giản, đủ an toàn cho mức tải của một cửa hàng, kiểm thử được bằng test đồng thời |
| Idempotency lưu trên bảng `payments` | Bảng idempotency riêng | Ít bảng hơn, mỗi lần thanh toán đúng một bản ghi |
| Giỏ hàng lưu ở trình duyệt | Lưu giỏ hàng trên server | Giảm API và bảng; giá cuối vẫn do server tính khi tạo đơn |

## 6. Các quyết định kiến trúc (ADR)

| ADR | Quyết định |
|---|---|
| [001](adr/001-monorepo.md) | Monorepo `apps/web`, `apps/api`, `docs` |
| [002](adr/002-layered-modular-backend.md) | Backend NestJS phân lớp, module theo domain |
| [003](adr/003-postgresql-prisma.md) | PostgreSQL với Prisma ORM và Prisma Migrate |
| [004](adr/004-payment-gateway-adapter.md) | Cổng thanh toán qua interface: mô phỏng và VNPay sandbox |
| [005](adr/005-inventory-concurrency-idempotency.md) | Tồn kho đồng thời và idempotency |
| [006](adr/006-jwt-rbac.md) | Xác thực JWT và phân quyền theo vai trò |
| [007](adr/007-deployment-render-ghcr.md) | Docker, GHCR và Render; CI/CD bằng GitHub Actions |
| [008](adr/008-config-logging-health.md) | Cấu hình, logging và health check |
