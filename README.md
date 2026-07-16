# Mộc Đọc

Trình đọc chương truyện từ file TXT. Ứng dụng tự nhận diện tiêu đề, dàn lại đoạn văn và cho phép tùy chỉnh màu nền, cỡ chữ, kiểu chữ, giãn dòng cùng độ rộng trang đọc.

## Bản chạy local

Mở trực tiếp [`local/index.html`](local/index.html) bằng Chrome, Edge hoặc Firefox. Không cần cài đặt và không cần kết nối Internet.

## GitHub Pages

Thư mục `local/` cũng là nguồn của bản GitHub Pages. Workflow `.github/workflows/pages.yml` tự xuất bản lại trang mỗi khi nhánh `main` thay đổi.

## Quyền riêng tư

File TXT được xử lý hoàn toàn trong trình duyệt. Nội dung truyện không được tải lên máy chủ và thư mục `Docs/` được loại khỏi Git.

## Phát triển ứng dụng Sites

Phiên bản React/Vinext nằm trong `app/`:

```bash
npm install
npm run dev
npm test
```
