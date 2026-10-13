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

Cấu hình `DATABASE_URL` tới PostgreSQL có xác thực; giữ chuỗi kết nối ở máy chủ, không đưa vào frontend. Máy chủ mặc định lắng nghe trên `0.0.0.0` và dùng cổng trong biến `PORT`; địa chỉ lắng nghe không bị biến `HOST` của nền tảng ghi đè khi triển khai container và cung cấp HTTPS qua reverse proxy. Khi `NODE_ENV=production`, cookie chỉ gửi qua HTTPS. API phục vụ cả `dist`; frontend tĩnh trên Vercel/Netlify riêng cần cấu hình proxy `/api` tới backend. Không thể triển khai đầy đủ chỉ bằng việc tải `dist` lên hosting tĩnh.

Phát âm và nhận diện giọng nói vẫn dùng Web Speech API, phụ thuộc trình duyệt, quyền microphone và có thể cần mạng. Hội thoại vẫn dựa trên kịch bản trong CSDL; chưa có AI sinh phản hồi hay chấm phát âm. Lịch ôn hiện giữ quy tắc 10 phút / 1 ngày / 4 ngày, chưa triển khai SM-2 đầy đủ. Lộ trình hiện có 23 bài; không tuyên bố đáp ứng toàn bộ tiêu chí sản phẩm trong PRD.

## Triển khai trên Vibehost

Dùng nhánh `main`. Nếu nền tảng hỗ trợ Dockerfile, dùng Dockerfile trong repository (Node.js 24, build frontend và đóng gói backend/migration). Nếu dùng Node trực tiếp, chọn Node.js 24, lệnh build `npm ci && npm run build`, lệnh chạy `npm start`.

- Cấu hình `DATABASE_URL` trong phần biến môi trường của Vibehost tới PostgreSQL mà container truy cập được. Không dùng địa chỉ PostgreSQL loopback trong `.env.example` cho hosting; đó chỉ là CSDL máy phát triển.
- Đặt `HOST=0.0.0.0`, `NODE_ENV=production`; Đặt `PORT=3001` nếu health check của Vibehost đang chờ cổng 3001 như nhật ký triển khai này. Nếu nền tảng bắt buộc cấp cổng khác qua `PORT`, cấu hình cổng dịch vụ/health check khớp với cổng đó; ứng dụng luôn đọc `PORT`. Không tải `.env` chứa mật khẩu lên GitHub hoặc image.
- Khi chạy `npm start`, ứng dụng tự chạy migration và seed trước khi mở cổng. CSDL mới tự được khởi tạo; khởi động lại không tạo nội dung trùng. Tài khoản CSDL cần quyền tạo bảng, sequence và ghi dữ liệu trong schema `public`. Không chạy migration trong bước build vì build có thể không có quyền kết nối CSDL.
- Dùng `/api/health` làm đường dẫn health check nếu nền tảng cho cấu hình. Khi PostgreSQL chưa truy cập được, ứng dụng báo lỗi thay vì che giấu bằng dữ liệu giả. Dùng HTTPS để cookie hồ sơ học tập hoạt động trong production.
- Sau khi triển khai, kiểm tra `/api/health`, `/api/catalog` và hoàn thành một bài rồi tải lại trang để xác minh tiến độ được lưu.

Kiểm thử triển khai sử dụng CSDL trống, chạy đúng hàm khởi động production, kiểm tra health check rồi khởi động lần nữa trên cùng CSDL. Chưa xác minh trực tiếp phiên triển khai của tài khoản Vibehost.

### Health check báo chỉ nghe ở 127.0.0.1

`npm start` luôn lắng nghe trên `0.0.0.0`, kể cả khi nền tảng đặt `HOST=127.0.0.1` hoặc `HOST=localhost`. Cổng vẫn lấy từ `PORT`. Vite dev/preview cũng được cấu hình lắng nghe trên `0.0.0.0`; lệnh chạy website có backend là `npm start`. Nhật ký khởi động ghi rõ địa chỉ và cổng để đối chiếu với health check. Sau khi cập nhật mã nguồn, build lại và triển khai lại image mới; không tái sử dụng image cũ.

## Nội dung bán hàng, tham quan và quà lưu niệm

Migration `004_sales_sightseeing_souvenirs.sql` thêm 15 bài, 45 câu giao tiếp, 45 mục từ vựng và 15 kịch bản (60 lượt thoại). Tổng thư viện: **23 bài, 108 câu/từ vựng, 18 kịch bản và 72 lượt thoại**.

- Bán hàng: hỏi nhu cầu/ngân sách, giới thiệu sản phẩm, báo giá/giảm giá, chốt đơn/thanh toán, đổi trả/chăm sóc sau mua.
- Tham quan: hỏi đường tới tháp Eiffel, mua vé và hỏi quy định tại Louvre, hỏi hướng dẫn viên tại Colosseum, ứng xử khi tham quan đền ở Kyoto, nhờ người bản địa gợi ý điểm ngắm cảnh và chụp ảnh.
- Quà lưu niệm: chọn quà cho gia đình, hỏi xuất xứ/chất liệu đồ thủ công, thương lượng giá lịch sự, thanh toán/kiểm tra tiền thừa, gói quà và bảo vệ đồ dễ vỡ.

Mỗi bài mới có nghĩa tiếng Việt, IPA, mục từ vựng với nút nghe và nội dung ôn trong Flashcards. Hội thoại hiển thị vai của người học cùng bối cảnh. Các câu hỏi ở địa điểm nổi tiếng dùng để luyện giao tiếp, không cung cấp giá vé/lịch mở cửa hoặc quy định du lịch hiện hành.

Triển khai lại từ `main`; `npm start` tự áp dụng migration mới. Không xóa CSDL, không sửa migration cũ; bài học cũ và tiến độ đã lưu được giữ nguyên.

## Luyện nghe từ vựng trong tình huống giả định

Mở **Luyện nghe từ vựng** trên thanh điều hướng. Migration `005_contextual_listening.sql` thêm 45 bài nghe ngắn, liên kết với từ vựng có sẵn: 15 tình huống bán hàng và 30 tình huống tham quan/mua quà lưu niệm.

1. Đọc bối cảnh giả định bằng tiếng Việt; chọn chủ đề nếu muốn.
2. Nhấn **Nghe tình huống** hoặc **Nghe chậm**. Trình duyệt đọc câu tiếng Anh rồi nhắc từ khóa; có thể nghe lại nhiều lần.
3. Chọn một trong bốn nghĩa tiếng Việt. Câu tiếng Anh, từ khóa và IPA chỉ hiện sau khi trả lời.
4. Xem đáp án, chuyển tình huống và nhận kết quả cuối lượt. Có thể luyện lại chủ đề.

Nội dung bài nghe được lưu trong PostgreSQL và trả về ở `listeningExercises` trong `/api/catalog`; không dùng nội dung giả lập trong frontend. Giọng đọc dùng SpeechSynthesis của trình duyệt, chưa phải bản thu của người bản địa. Điểm lượt nghe nằm trong phiên giao diện hiện tại, chưa lưu lịch sử điểm vào tài khoản. Khi triển khai lại, `npm start` tự chạy migration mới.
