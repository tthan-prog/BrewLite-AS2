# Runbook triển khai BrewLite AS2 (Task 5, ADR 007)

Production gồm 3 dịch vụ mới trên Render (không dùng lại dịch vụ của bản cũ):

| Dịch vụ | Loại | Nguồn |
|---|---|---|
| `brewlite-as2-db` | Render PostgreSQL | Lưu trữ bền vững |
| `brewlite-as2-api` | Web Service, image có sẵn | `ghcr.io/tthan-prog/brewlite-as2-api:<tag>` |
| `brewlite-as2-web` | Web Service, image có sẵn | `ghcr.io/tthan-prog/brewlite-as2-web:<tag>` |

Pipeline `.github/workflows/cd.yml` chạy khi push tag `v*`:

1. **CI**: gọi lại `ci.yml` (lint, unit test, e2e, integration test với PostgreSQL, build).
2. **Build và push**: build image API (kèm `APP_VERSION=<tag>`) và Web (kèm `NEXT_PUBLIC_API_URL`), push lên GHCR với 3 tag: `<tag>`, `sha-<commit>`, `latest`.
3. **Deploy**: gọi deploy hook của Render với `imgURL` trỏ đúng image `<tag>`.
4. **Smoke test**: chờ `GET /health` trả `"version":"<tag>"` và `"db":"up"`, gọi `GET /products`, rồi kiểm tra trang `/` và `/menu` của web trả 200. Quá 15 phút thì pipeline báo lỗi.

Trước bước 3, pipeline gọi `/health` và trang web để đánh thức dịch vụ. Gói Free của Render tắt dịch vụ khi không có truy cập; nếu deploy lúc dịch vụ đang ngủ, yêu cầu đầu tiên của smoke test sẽ đánh thức bản cũ và tiếp tục đi vào bản cũ (đã gặp ở lần chạy `v0.9.1`).

## Cấu hình một lần

### 1. Đẩy image lần đầu

Dịch vụ Render cần image có sẵn, nên push một tag khởi tạo trước:

```bash
git checkout main && git pull
git tag -a v0.9.0 -m "Image khởi tạo cho Render"
git push origin v0.9.0
```

Job Deploy sẽ báo cảnh báo "Chưa cấu hình Render" và bỏ qua; image đã có trên GHCR.

Trên GitHub: trang cá nhân → **Packages** → `brewlite-as2-api` → **Package settings** → **Change visibility** → **Public**. Làm tương tự với `brewlite-as2-web`. Render kéo image public không cần mật khẩu; image không chứa secret.

### 2. Tạo dịch vụ trên Render (region Singapore)

1. **New → PostgreSQL**: tên `brewlite-as2-db`, database `brewlite`, gói Free.
2. **New → Web Service → Existing Image**: `ghcr.io/tthan-prog/brewlite-as2-api:latest`, tên `brewlite-as2-api`, gói Free.
   - **Health Check Path**: `/health`
   - Biến môi trường:

     | Biến | Giá trị |
     |---|---|
     | `DATABASE_URL` | Internal Database URL của `brewlite-as2-db` |
     | `JWT_SECRET` | chuỗi ngẫu nhiên dài (nút **Generate** của Render) |
     | `JWT_EXPIRES_IN` | `1d` |
     | `WEB_ORIGIN` | URL của web, ví dụ `https://brewlite-as2-web.onrender.com` |

3. **New → Web Service → Existing Image**: `ghcr.io/tthan-prog/brewlite-as2-web:latest`, tên `brewlite-as2-web`, gói Free.

Ghi lại URL thật Render cấp cho hai dịch vụ (nếu tên đã có người dùng, Render thêm hậu tố). Nếu URL web khác ví dụ trên thì sửa lại `WEB_ORIGIN` của API.

API tự chạy `prisma migrate deploy` mỗi lần khởi động.

### 3. Nạp dữ liệu mẫu (một lần)

Seed **xóa toàn bộ dữ liệu** rồi tạo lại, chỉ chạy một lần khi database còn trống. Chạy từ máy cá nhân bằng **External Database URL**:

```powershell
cd apps/api
$env:DATABASE_URL="<External Database URL của brewlite-as2-db>"
npx prisma db seed
Remove-Item Env:DATABASE_URL
```

Sau đó vào **brewlite-as2-db → Networking** và xóa mọi dòng trong **Access Control**, để database chỉ nhận kết nối nội bộ.

### 4. Khai báo cho GitHub Actions

**Settings → Secrets and variables → Actions**:

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_API` | Deploy Hook của `brewlite-as2-api` (Settings → Deploy Hook) |
| Secret | `RENDER_DEPLOY_HOOK_WEB` | Deploy Hook của `brewlite-as2-web` |
| Variable | `API_URL` | URL API, không có `/` ở cuối |
| Variable | `WEB_URL` | URL web, không có `/` ở cuối |

### 5. Bật VNPay sandbox (FR-21, tùy chọn)

1. Đăng ký tài khoản thử nghiệm tại https://sandbox.vnpayment.vn/devreg/. VNPay gửi qua email `vnp_TmnCode` (mã website) và `vnp_HashSecret` (chuỗi bí mật).
2. Render → `brewlite-as2-api` → **Environment**, thêm rồi **Save, rebuild, and deploy**:

   | Biến | Giá trị |
   |---|---|
   | `VNPAY_TMN_CODE` | `vnp_TmnCode` trong email |
   | `VNPAY_HASH_SECRET` | `vnp_HashSecret` trong email |
   | `VNPAY_URL` | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` |
   | `VNPAY_RETURN_URL` | `https://brewlite-as2-web.onrender.com/checkout/vnpay-return` |

3. (Tùy chọn) Trên trang quản trị sandbox của VNPay, khai báo IPN URL: `https://brewlite-as2-api-k8xj.onrender.com/payments/vnpay/ipn`.
4. Kiểm tra: `GET /payments/vnpay/config` trả `{"enabled":true}`. Thẻ thử do VNPay cung cấp trong email hoặc trang tài liệu sandbox.

Không đưa `VNPAY_HASH_SECRET` vào repository hay ảnh chụp màn hình.

## Phát hành phiên bản

```bash
git checkout main && git pull
git tag -a v1.1.1 -m "BrewLite AS2 v1.1.1"
git push origin v1.1.1
```

Theo dõi ở tab **Actions → CD**. Thành công khi job **Deploy Render và smoke test** xanh. Kiểm tra tay:

```bash
curl https://<api>/health      # {"status":"ok","db":"up","version":"v1.1.1",...}
```

## Rollback

**Cách 1, qua pipeline (ưu tiên):** Actions → **CD** → **Run workflow** → nhập tag đã chạy ổn trước đó (ví dụ `v1.1.0`) → **Run**. Pipeline kiểm tra image tag đó có trên GHCR, gọi deploy hook với đúng image, rồi chạy cùng smoke test.

**Cách 2, trên Render:** dịch vụ → **Events** → chọn lần deploy trước → **Rollback**.

Migration chỉ thêm bảng hoặc cột, không xóa trong cùng phiên bản, nên image cũ vẫn chạy được với schema mới.

## Lưu ý

- Gói Free của Render ngủ sau một thời gian không có truy cập; mở `/health` và trang web khoảng 1 phút trước khi demo.
- Secret (`JWT_SECRET`, `DATABASE_URL`, deploy hook) chỉ nằm trên Render và GitHub Secrets, không có trong repository (NFR-03).
