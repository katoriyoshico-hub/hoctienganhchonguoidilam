# CT-Speak — Tiếng Anh Tư vấn & Du lịch

Ứng dụng React/Vite với API Express và cơ sở dữ liệu PostgreSQL thật. Bài học, mẫu câu, kịch bản và lượt thoại được nạp từ SQL qua API; mục tiêu, tiến độ, lượt ôn và phiên luyện tập được ghi vào PostgreSQL thay cho localStorage.

## Cài đặt và chạy

Cần Node.js 22.9+ (khuyến nghị 24), npm và Docker Compose, hoặc một máy chủ PostgreSQL có sẵn.

```bash
npm ci
# Chỉ tạo .env nếu chưa có; chỉnh DATABASE_URL khi dùng PostgreSQL riêng.
test -f .env || cp .env.example .env
docker compose up -d --wait
npm run db:migrate
```

Compose chỉ mở PostgreSQL trên `127.0.0.1:5433`, dùng trust authentication cho phát triển cục bộ. Không dùng cấu hình này cho máy chủ công khai. Dữ liệu nằm tại `../.ct-speak/postgres` ngoài checkout; có thể đặt `CT_SPEAK_DATA_DIR` sang thư mục riêng. Không xóa thư mục dữ liệu khi khởi động lại.

Chạy trong hai terminal, cùng thư mục repository:

```bash
npm run dev:server
npm run dev
```

Vite chuyển `/api` tới API trên cổng 3001. Truy cập địa chỉ do Vite hiển thị. Kiểm tra API và cơ sở dữ liệu:

```bash
curl --fail http://127.0.0.1:3001/api/health
curl --fail http://127.0.0.1:3001/api/catalog
npm test
```

`npm test` build ứng dụng, tạo cơ sở dữ liệu kiểm thử riêng rồi xóa cơ sở dữ liệu đó khi kết thúc. Tài khoản trong `DATABASE_URL` cần quyền `CREATEDB` để chạy kiểm thử; migration ứng dụng không cần quyền này.

## Cơ sở dữ liệu và API

- `db/migrations/001_schema.sql`: hiện thực 10 bảng theo PRD (`users`, `modules`, `lessons`, `phrases`, `scenarios`, `scenario_turns`, `practice_sessions`, `session_turns`, `flashcard_reviews`, `user_progress`).
- `002_content.sql`: seed 8 bài, 18 mẫu câu, 3 kịch bản và 12 lượt thoại, giữ nội dung của giao diện trước đây.
- `003_state_constraints.sql`: ràng buộc chống trùng và mức đánh giá thẻ.
- `server/migrate.js`: chạy migration và seed trong transaction, khóa chống chạy đồng thời, lưu checksum, đồng bộ sequence. Chạy lại không thêm dữ liệu trùng; thay đổi nội dung bằng migration mới, không sửa migration đã áp dụng.

| API                           | Chức năng                                                      |
| ----------------------------- | -------------------------------------------------------------- |
| `GET /api/health`             | Kiểm tra kết nối PostgreSQL                                    |
| `GET /api/catalog`            | Đọc bài học, mẫu câu, kịch bản, lượt thoại                     |
| `GET /api/state`              | Đọc mục tiêu, tiến độ, lịch ôn và danh sách phiên              |
| `PUT /api/state/goal`         | Lưu `{goal: "both" / "work" / "travel"}`                       |
| `PUT /api/state/progress`     | Lưu hoàn thành `{lessonId}`                                    |
| `PUT /api/state/reviews`      | Lưu `{lessonId, phraseIndex, rating}`; chỉ số câu bắt đầu từ 0 |
| `POST /api/sessions`          | Tạo phiên `{scenarioId}`                                       |
| `PUT /api/sessions/:id/turns` | Lưu `{turnIndex, transcript}`; chỉ số lượt bắt đầu từ 0        |
| `GET /api/sessions/:id`       | Đọc phiên và transcript thuộc hồ sơ hiện tại                   |

Hồ sơ ẩn danh được nhận diện bằng cookie ngẫu nhiên HttpOnly/SameSite; mỗi hồ sơ chỉ đọc/ghi phiên của mình. Xóa cookie hoặc đổi trình duyệt sẽ tạo hồ sơ mới; chưa có đăng nhập và liên kết hồ sơ nhiều thiết bị. API lưu thành công trước khi giao diện chuyển bài/thẻ/lượt. Khi mất mạng, giao diện giữ bước hiện tại và báo lỗi để người học thử lại; chưa có hàng đợi lưu offline.

## Kiểm thử

Bộ kiểm thử tích hợp chạy trên PostgreSQL và giao diện đã build: migration lặp lại, nội dung cập nhật từ CSDL, lưu/đọc tiến độ và flashcard, phiên và transcript, cô lập hồ sơ, kiểm tra đầu vào, thao tác giao diện không dùng localStorage, và lỗi kết nối CSDL không báo thành công giả.

## Triển khai

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

Cấu hình `DATABASE_URL` tới PostgreSQL có xác thực; giữ chuỗi kết nối ở máy chủ, không đưa vào frontend. Máy chủ mặc định lắng nghe trên `0.0.0.0` và dùng cổng trong biến `PORT`; giữ `HOST=0.0.0.0` khi triển khai container và cung cấp HTTPS qua reverse proxy. Khi `NODE_ENV=production`, cookie chỉ gửi qua HTTPS. API phục vụ cả `dist`; frontend tĩnh trên Vercel/Netlify riêng cần cấu hình proxy `/api` tới backend. Không thể triển khai đầy đủ chỉ bằng việc tải `dist` lên hosting tĩnh.

Phát âm và nhận diện giọng nói vẫn dùng Web Speech API, phụ thuộc trình duyệt, quyền microphone và có thể cần mạng. Hội thoại vẫn dựa trên kịch bản trong CSDL; chưa có AI sinh phản hồi hay chấm phát âm. Lịch ôn hiện giữ quy tắc 10 phút / 1 ngày / 4 ngày, chưa triển khai SM-2 đầy đủ. Lộ trình hiện có 8 bài; không tuyên bố đáp ứng toàn bộ tiêu chí sản phẩm trong PRD.

## Triển khai trên Vibehost

Dùng nhánh `main`. Nếu nền tảng hỗ trợ Dockerfile, dùng Dockerfile trong repository (Node.js 24, build frontend và đóng gói backend/migration). Nếu dùng Node trực tiếp, chọn Node.js 24, lệnh build `npm ci && npm run build`, lệnh chạy `npm start`.

- Cấu hình `DATABASE_URL` trong phần biến môi trường của Vibehost tới PostgreSQL mà container truy cập được. Không dùng địa chỉ PostgreSQL loopback trong `.env.example` cho hosting; đó chỉ là CSDL máy phát triển.
- Đặt `HOST=0.0.0.0`, `NODE_ENV=production`; Đặt `PORT=3001` nếu health check của Vibehost đang chờ cổng 3001 như nhật ký triển khai này. Nếu nền tảng bắt buộc cấp cổng khác qua `PORT`, cấu hình cổng dịch vụ/health check khớp với cổng đó; ứng dụng luôn đọc `PORT`. Không tải `.env` chứa mật khẩu lên GitHub hoặc image.
- Khi chạy `npm start`, ứng dụng tự chạy migration và seed trước khi mở cổng. CSDL mới tự được khởi tạo; khởi động lại không tạo nội dung trùng. Tài khoản CSDL cần quyền tạo bảng, sequence và ghi dữ liệu trong schema `public`. Không chạy migration trong bước build vì build có thể không có quyền kết nối CSDL.
- Dùng `/api/health` làm đường dẫn health check nếu nền tảng cho cấu hình. Khi PostgreSQL chưa truy cập được, ứng dụng báo lỗi thay vì che giấu bằng dữ liệu giả. Dùng HTTPS để cookie hồ sơ học tập hoạt động trong production.
- Sau khi triển khai, kiểm tra `/api/health`, `/api/catalog` và hoàn thành một bài rồi tải lại trang để xác minh tiến độ được lưu.

Kiểm thử triển khai sử dụng CSDL trống, chạy đúng hàm khởi động production, kiểm tra health check rồi khởi động lần nữa trên cùng CSDL. Chưa xác minh trực tiếp phiên triển khai của tài khoản Vibehost.
