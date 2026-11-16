# Quy ước làm việc (Assignment 2 – Task 4.1)

## 1. Chiến lược nhánh

- `main` luôn ở trạng thái chạy được; **không commit trực tiếp** lên `main`.
- Mỗi việc làm trên một nhánh tạo từ `main` mới nhất:

  ```bash
  git switch main
  git pull
  git switch -c <loai>/<mo-ta-ngan>
  ```

- Tên nhánh theo loại việc:

| Tiền tố | Dùng cho | Ví dụ |
|---|---|---|
| `feat/` | Chức năng mới | `feat/products-api` |
| `fix/` | Sửa lỗi | `fix/cart-total` |
| `docs/` | Tài liệu, sơ đồ | `docs/traceability-matrix` |
| `chore/` | Cấu hình, công cụ, CI | `chore/task4-repo` |
| `test/` | Bổ sung test | `test/orders-e2e` |

- Các Task của đề được merge theo thứ tự: Task sau chỉ merge khi tạo phẩm của Task trước đã có trên `main`.

## 2. Pull request

1. Push nhánh và mở PR vào `main`, điền mẫu PR (liên kết issue bằng `Closes #<số>`).
2. Chọn ít nhất **1 reviewer** khác người viết.
3. **Chỉ merge khi CI xanh** (job "Install, Lint, Unit Test, Build" bắt buộc; job "E2E (Playwright)" cũng phải xanh) và đã được approve.
4. Dùng "Create a merge commit"; xóa nhánh sau khi merge.
5. Thay đổi yêu cầu, sơ đồ hoặc kiến trúc phải ghi rõ lý do trong mô tả PR.

## 3. Quy ước commit

Theo dạng [Conventional Commits](https://www.conventionalcommits.org/):

```
<loai>(<pham-vi>): <mô tả ngắn, tiếng Việt hoặc tiếng Anh>
```

- `loai`: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.
- `pham-vi` (không bắt buộc): `api`, `web`, `task1` … `task5`, `ci`.
- Ví dụ: `feat(api): GET /products và GET /products/:id`, `docs(task3): thêm ADR 007`.
- Mỗi thành viên commit bằng tài khoản Git của mình; đặt đúng tên thật:
  `git config --global user.name "Họ Tên"`.

## 4. Definition of Done

Một user story hoặc issue được coi là **Done** khi:

1. Đáp ứng tiêu chí chấp nhận trong `docs/requirements/srs.md` hoặc trong issue.
2. Có test tự động phù hợp (unit, integration hoặc e2e) và test chạy qua.
3. CI xanh: Lint, Unit Test, test HTTP, Integration Test, Build và E2E (Playwright).
4. Đã được ít nhất 1 thành viên khác review và approve.
5. Tài liệu liên quan được cập nhật: README, sơ đồ, `docs/traceability-matrix.md`.
6. Không có secret, `.env` hoặc file build trong commit.
7. Đã merge vào `main` và issue được đóng.
