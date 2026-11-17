# Kiểm thử phi chức năng

Hai script Node.js, không cần cài thêm thư viện (Node.js 22, dùng `fetch` có sẵn).

| Mã test | Yêu cầu | Script | Lệnh | Chạy trong CI |
|---|---|---|---|---|
| PERF-T01 | NFR-01: `GET /products` phản hồi nhanh với dữ liệu seed, 95% trong 20 yêu cầu liên tiếp dưới 500 ms | `tests/perf/products-latency.mjs` | `npm run test:perf` | Job "E2E (Playwright)", sau bước khởi động API và web |
| SEC-T01 | NFR-03: secret không nằm trong repository | `scripts/check-secrets.mjs` | `npm run check:secrets` | Job "Install, Lint, Unit Test, Build", ngay sau `npm ci` |
| PERF-U01–U04 | Hàm tính phân vị của PERF-T01 | `tests/perf/percentile.test.mjs` | `node --test tests/perf/percentile.test.mjs` | Job "Install, Lint, Unit Test, Build" |

## PERF-T01 – hiệu năng `GET /products`

Script gửi 1 yêu cầu khởi động (không tính), sau đó 20 yêu cầu **liên tiếp** (không song song), đọc hết body và kiểm tra API trả danh sách món khác rỗng. Kết quả gồm min, trung bình, p95 (phương pháp nearest-rank: với 20 mẫu là mẫu lớn thứ 19), max. Test đạt khi p95 < 500 ms; nghĩa là được phép tối đa 1 yêu cầu trong 20 chậm hơn ngưỡng.

```bash
# API đang chạy ở http://localhost:3001 với dữ liệu seed (docker compose up hoặc npm run dev:api)
npm run test:perf

# Tùy chọn
npm run test:perf -- --url http://localhost:3001 --requests 20 --threshold-ms 500 --json perf.json

# Production: chỉ đo để tham khảo, không đánh trượt (Render gói Free ngủ khi không có truy cập,
# lần gọi đầu có thể mất khoảng 50 giây; yêu cầu khởi động đã loại lần này khỏi kết quả)
npm run test:perf -- --url https://brewlite-as2-api-k8xj.onrender.com --report-only
```

Mã thoát 1 khi p95 ≥ ngưỡng, API lỗi hoặc database chưa seed, nên CI báo đỏ.

Giới hạn: đây là đo độ trễ tuần tự từ một máy, không phải load test nhiều người dùng đồng thời. Trong CI, API và database chạy cùng máy runner nên số đo thấp hơn môi trường thật.

## SEC-T01 – quét secret

Quét mọi tệp Git đang theo dõi (`git ls-files`). Trượt khi:

- có tệp `.env` thật được commit (chỉ cho phép `.env.example`);
- có khóa riêng, token GitHub, khóa AWS, URL deploy hook Render;
- có chuỗi kết nối PostgreSQL kèm mật khẩu trỏ tới máy chủ khác `localhost` / `db`;
- `JWT_SECRET` hoặc `VNPAY_HASH_SECRET` được gán giá trị không phải giá trị mẫu (giá trị mẫu chứa `test`, `ci`, `local`, `dev`, `example`, `doi-gia-tri`...).

Giá trị tìm thấy được che (`***`) khi in ra, để log CI không làm lộ secret.

Giới hạn: quét theo mẫu nên không thay được việc rà soát; không quét lịch sử commit cũ; không kiểm tra log CI (log CI được GitHub tự che các giá trị trong GitHub Secrets).
