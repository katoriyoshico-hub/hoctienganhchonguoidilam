# CT-Speak — Website học tiếng Anh Tư vấn & Du lịch

Bản demo frontend dựa trên `PRD_English_Consulting_Travel.md`.

## Chạy trên máy tính

Cài Node.js 20+ và chạy:

```bash
npm install
npm run dev
```

Mở địa chỉ do Vite hiển thị (thường là http://localhost:5173).

## Đưa lên GitHub

Tạo repository mới trên GitHub, rồi chạy trong thư mục `ct-speak`:

```bash
git init
git add .
git commit -m "Initial CT-Speak website"
git branch -M main
git remote add origin https://github.com/USERNAME/ct-speak.git
git push -u origin main
```

Thay `USERNAME` bằng tên tài khoản GitHub của bạn. Nếu GitHub yêu cầu xác thực, đăng nhập qua Git Credential Manager hoặc GitHub CLI.

## Triển khai website

- **Vercel**: Import repository GitHub → Framework Preset `Vite` → Build Command `npm run build` → Output Directory `dist` → Deploy.
- **Netlify**: Import repository → Build Command `npm run build` → Publish directory `dist`.

## Chức năng demo

- Dashboard, 8 bài học mẫu trong 2 chủ đề.
- Nghe phát âm bằng SpeechSynthesis; nhận dạng lời nói bằng Web Speech API khi trình duyệt hỗ trợ.
- 3 hội thoại kịch bản mẫu; flashcards và lịch ôn 10 phút / 1 ngày / 4 ngày.
- Lưu bài đã hoàn thành và đánh giá flashcard bằng localStorage.
- Giao diện responsive.

## Giới hạn và bước tiếp theo

Đây là **frontend demo**, không phải sản phẩm hoàn chỉnh theo PRD. Chưa có đăng nhập, PostgreSQL, AI Roleplay sinh phản hồi động, chấm phát âm AI chính xác, lịch ôn SM-2 đầy đủ, đồng bộ nhiều thiết bị, hay lộ trình đủ 60 bài. Web Speech API phụ thuộc trình duyệt và có thể yêu cầu HTTPS, quyền micro và kết nối mạng. Không đưa API key bí mật vào mã frontend hoặc GitHub; các dịch vụ AI và xác thực cần backend an toàn.
