# Báo cáo LaTeX – Bài tập lớn 2 (BrewLite AS2)

Báo cáo theo mẫu `Assigment_template_SGU` của khoa, nội dung khớp repository tại `v1.1.1`.

| Tệp | Nội dung |
|---|---|
| `main.tex` | Tệp chính: trang bìa, mục lục, gọi các chương |
| `preamble.tex` | Gói, đầu trang và chân trang theo mẫu SGU, lệnh chèn hình |
| `chapters/` | Các chương 1–11, tài liệu tham khảo, phụ lục |
| `chapters/tables/` | Bảng sinh từ tài liệu trong `docs/` (SRS, use case, kiến trúc, backlog, truy vết) và tên test case trong mã nguồn |
| `uml/` | Sơ đồ kết xuất từ các tệp `.puml` trong `docs/` (SVG đổi sang PDF) |
| `figures/` | Ảnh bằng chứng (thư mục `AS2-bang-chung` của nhóm), đặt tên `t4-…` (Task 4), `t5-…` (Task 5) |

## Biên dịch

Trình biên dịch **pdfLaTeX** (gói `vntex`):

```bash
cd docs/report
latexmk main.tex        # hoặc chạy pdflatex main.tex ba lần để cập nhật mục lục và số trang
```

Overleaf: tải cả thư mục `docs/report` lên, chọn Compiler = pdfLaTeX, Main document = `main.tex`.

File PDF không commit vào repository; nộp riêng.
