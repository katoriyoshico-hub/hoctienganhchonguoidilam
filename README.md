# CT-Speak — Tiếng Anh Tư vấn & Du lịch

Ứng dụng React/Vite với API Express và cơ sở dữ liệu PostgreSQL thật. Bài học, mẫu câu, kịch bản và lượt thoại được nạp từ SQL qua API; mục tiêu, tiến độ, lượt ôn và phiên luyện tập được ghi vào PostgreSQL thay cho localStorage.

Hiện có **87 bài học, 1107 mẫu câu/từ vựng, 82 hội thoại hai nhân vật và 45 tình huống luyện nghe từ vựng**.

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

Phát âm và nhận diện giọng nói vẫn dùng Web Speech API, phụ thuộc trình duyệt, quyền microphone và có thể cần mạng. Hội thoại vẫn dựa trên kịch bản trong CSDL; chưa có AI sinh phản hồi hay chấm phát âm. Lịch ôn hiện giữ quy tắc 10 phút / 1 ngày / 4 ngày, chưa triển khai SM-2 đầy đủ. Lộ trình hiện có 39 bài; không tuyên bố đáp ứng toàn bộ tiêu chí sản phẩm trong PRD.

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

## Hội thoại hai nhân vật có hình minh họa

Migration `006_illustrated_conversations.sql` thêm 16 bài mới (96 mẫu câu/từ vựng) và 16 kịch bản. Tổng thư viện hiện có **39 bài, 483 mẫu câu/từ vựng và 34 hội thoại**. Nội dung bổ sung gồm chọn kích cỡ, kiểm tra tồn kho, giao hàng, bảo hành, khiếu nại, tư vấn điện thoại, đặt lịch, mã ưu đãi, tham quan Sagrada Família/Vạn Lý Trường Thành/Niagara/Central Park, gọi cà phê, hỏi thành phần món ăn, gửi hành lý và đồ thất lạc.

Mỗi hội thoại có hai nhân vật được đặt tên, tám lượt nói luân phiên và bản dịch tiếng Việt. Mở **Hội thoại**, chọn tình huống rồi:

- Nhấn **Nghe toàn bộ hội thoại** để nghe lần lượt cả hai nhân vật; lượt đang phát được tô viền.
- Chọn tốc độ chậm/vừa/tự nhiên; chọn giọng riêng cho mỗi nhân vật nếu trình duyệt có nhiều giọng tiếng Anh.
- Nhấn **Nghe lượt** để nghe một câu, **Dừng phát** để dừng; thay đổi tình huống hoặc rời trang sẽ hủy giọng đọc cũ.
- Tắt **Hiện bản dịch** để tập nghe tiếng Anh. Mở **Luyện trả lời từng lượt** để tiếp tục luyện nói và lưu phiên thực hành như trước.

Các hình minh họa được tạo cho ứng dụng và đóng gói trong `public/illustrations`, gồm bối cảnh giao tiếp chung và các địa danh tương ứng. Đây là tranh minh họa, không phải ảnh thực địa. Giọng đọc vẫn là SpeechSynthesis; chưa phải ghi âm của diễn viên/người bản địa. Hệ thống không cần khóa API hay dịch vụ ảnh bên ngoài để dùng các hình này.

Migration thêm dữ liệu và bảng `dialogue_lines`, không xóa bài học hay lịch sử luyện tập. Các lượt luyện nói cũ vẫn được giữ; lời thoại hướng dẫn được đồng bộ với bản hội thoại mẫu mới. Dockerfile sao chép cả component và ảnh để chúng có mặt khi triển khai trên Vibehost.

## Kiểm tra khi website vẫn hiện 8 bài hoặc giao diện cũ

Bản 1.10.0 có nhãn **Phiên bản 1.10.0** ở chân thanh điều hướng, ảnh trên Tổng quan/thẻ Bài học và mục Luyện nghe từ vựng. HTML và API có header `Cache-Control: no-store`; asset JavaScript/CSS của Vite dùng tên theo nội dung. Ứng dụng không có service worker.

- `/app-version.json`: phiên bản frontend đã build.
- `/api/version`: phiên bản backend, số bài/hội thoại/mẫu câu thực tế trong PostgreSQL và migration mới nhất; không trả về chuỗi kết nối hay biến môi trường.
- Mọi phản hồi backend có header `X-CT-Speak-Version`.

Với bản này, frontend/backend đều là `1.10.0`; CSDL phải có 87 bài, 82 hội thoại, 1107 mẫu câu/từ vựng và migration `013_website_chat.sql`. Nếu website còn thiếu mục Luyện nghe từ vựng và hiện 8/8, giao diện được hiển thị là bản cũ. Nhật ký build đúng commit và HTTP 200 chưa chứng minh tên miền đang phục vụ đúng container.

Sau khi triển khai, mở `/api/version` và `/app-version.json` để đối chiếu. Nếu vẫn trả về bản cũ hoặc không tồn tại mặc dù image mới đã LIVE, cần kiểm tra container thực tế mà Traefik đang định tuyến hoặc cache của nền tảng. Không xóa CSDL để xử lý lỗi frontend cũ.

Banner trang Tổng quan dùng hình minh họa giao tiếp mới, màu sắc sống động và bố cục hiển thị ảnh trên cả máy tính/điện thoại. Tệp `public/illustrations/hero-conversation-vivid.png` được đóng gói cùng frontend; phiên bản giao diện hiện tại là 1.10.0.

## Mỗi bài có 10 câu giao tiếp

Migration `007_ten_sentences_per_lesson.sql` bổ sung 279 câu theo từng tình huống, nâng mỗi bài trong 39 bài lên **đúng 10 câu giao tiếp** (390 câu). Nghĩa tiếng Việt và IPA đi kèm từng câu; phần từ vựng vẫn hiển thị riêng, không tính vào 10 câu. Nội dung câu bổ sung gồm lượt hỏi–đáp trong hội thoại liên quan và câu thực hành mở rộng theo chủ đề.

Flashcards có đủ 390 câu và 93 từ vựng, tổng 483 thẻ. API trả `phrases` cho 10 câu thực hành, `vocabulary` cho từ vựng và `flashcards` kèm `phraseIndex` ổn định. Các câu mới được thêm sau mã câu/từ cũ; không thay đổi ID, thứ tự thẻ cũ trong từng bài, tiến độ hoàn thành hay lịch ôn đã lưu. Bài đã hoàn thành không tự bị đánh dấu chưa hoàn thành; người học có thể mở lại để luyện các câu mới.

Phiên bản hiện tại: **1.10.0**. Triển khai lại từ `main`; `npm start` tự chạy migration mới. Không cần xóa hoặc seed lại CSDL.

## Trò chơi sau mỗi bài học

Sau câu thứ 10, nhấn **Hoàn thành bài học**. Ứng dụng lưu tiến độ qua API rồi mở một lượt chơi gồm 5 câu chọn từ bài vừa học:

- 3 câu điền một từ còn thiếu, kèm nghĩa tiếng Việt.
- 2 câu viết lại câu tiếng Anh dựa trên nghĩa và các từ gợi ý xáo trộn.

Nhập đáp án và nhấn **Kiểm tra đáp án** (hoặc Enter), xem phản hồi/câu mẫu, nghe lại câu rồi chuyển tiếp. Chấm theo câu đã học, bỏ qua chữ hoa, dấu câu, khoảng trắng và một số dạng viết tắt thông dụng. Câu diễn đạt khác có thể đúng ngữ pháp nhưng không khớp mẫu của trò chơi; phản hồi không khẳng định câu đó sai ngữ pháp.

Kết thúc lượt chơi có điểm trên 5, nút **Chơi lại** với bộ câu được xáo lại và **Về thư viện**. Trò chơi có cho cả 39 bài. Bài học vẫn được lưu hoàn thành nếu người học rời trò chơi; điểm trò chơi chỉ hiển thị trong lượt chơi hiện tại, chưa lưu lịch sử điểm trên máy chủ. Không cần migration mới hoặc khóa API.

Giao diện 1.10.0 dùng nền lavender–mint có họa tiết chấm, màu nhấn tím/hồng, thẻ viền nhẹ và bóng màu. Theme được đóng gói trong `theme.css`; giao diện có focus bàn phím và tôn trọng tùy chọn giảm chuyển động.

## Tiếng Anh theo lĩnh vực nghề nghiệp

Migration `008_professional_fields.sql` tạo 8 lĩnh vực; migration `009_six_lessons_and_scenario_art.sql` bổ sung 32 bài và 32 hội thoại để mỗi lĩnh vực có 6 bài, mỗi bài 10 câu giao tiếp, 3 từ vựng và một hội thoại hai nhân vật gồm 8 lượt nói, có nghĩa tiếng Việt và IPA cho phần bài học.

| Lĩnh vực                 | Tình huống mẫu                                            |
| ------------------------ | --------------------------------------------------------- |
| Công nghệ & IT           | Báo lỗi đăng nhập; trao đổi yêu cầu dự án phần mềm        |
| Y tế & chăm sóc sức khỏe | Đặt lịch khám; hỏi cách đọc hướng dẫn trên đơn thuốc      |
| Giáo dục & học tập       | Đăng ký khóa học; hỏi giảng viên về bài tập/dự án nhóm    |
| Tuyển dụng & nhân sự     | Phỏng vấn xin việc; hỏi hợp đồng, giờ làm và quyền lợi    |
| Ngân hàng & tài chính    | Mở tài khoản; báo giao dịch chưa rõ và kiểm tra thẻ       |
| Logistics & vận chuyển   | Đặt lịch lấy hàng; hỏi đơn giao chậm và thông quan        |
| Khách sạn & sự kiện      | Nhờ lễ tân đặt dịch vụ; đặt phòng họp và chuẩn bị sự kiện |
| Marketing & truyền thông | Lập kế hoạch chiến dịch; báo cáo kết quả và nhận phản hồi |

Chọn **Lĩnh vực** trên trang Bài học hoặc Hội thoại. Bộ lọc Công việc bao gồm các lĩnh vực nghề nghiệp; Du lịch giữ các bài du lịch có sẵn. API `/api/catalog` trả `fields`, `fieldId` và `fieldTitle` để giao diện lọc trực tiếp dữ liệu từ PostgreSQL.

Tổng nội dung hiện tại: **87 bài, 870 câu giao tiếp, 237 từ vựng, 82 hội thoại** (1107 flashcards). Game cuối bài và phần nghe hội thoại tự dùng nội dung mới. Bối cảnh chuyên ngành phục vụ luyện ngôn ngữ, không thay thế tư vấn chuyên môn. Migration giữ nguyên nội dung và lịch sử học cũ, không cần biến môi trường mới. `npm start` tự cập nhật CSDL khi triển khai phiên bản **1.10.0**.

Bản 1.10.0 tăng độ nổi bật của nền: gradient tím/hồng/mint/cam san hô, hình nền vector trang trí nguyên bản `playful-backdrop.svg`, các thẻ thống kê có màu riêng và nút nhấn tương phản. Vùng đọc vẫn dùng nền sáng.

Mỗi lĩnh vực chuyên ngành (CNTT, y tế, giáo dục, nhân sự, tài chính, logistics, khách sạn và marketing) có **6 bài khác nhau**, mỗi bài 10 câu và 3 từ vựng. Hai nhóm công việc/du lịch cũ giữ 17/22 bài. Migration 009 bổ sung 32 bài và 32 hội thoại, không xóa tiến độ cũ.

Toàn bộ **87 bài có hình riêng theo tình huống**, lưu khóa ảnh/miêu tả trong PostgreSQL, trả về qua API và hiển thị ở danh sách, chi tiết bài, hội thoại. 15 bộ ảnh mới được đóng gói trong Docker qua `public/illustrations`; mỗi bộ gồm 6 cảnh. Không cần dịch vụ ảnh ngoài hoặc biến môi trường mới.

Phiên bản 1.10.0 đổi tên hiển thị thành **Tiếng Anh Hữu Ích**, gồm thanh bên, breadcrumb, tên học viên và tiêu đề tab trình duyệt.

Giao diện 1.10.0 dùng nền anime nguyên bản `anime-sakura-background.png` và banner `anime-conversation-hero.png`, phối màu sakura/sky blue. Các vùng đọc giữ nền sáng; ảnh được đóng gói cùng frontend, không cần dịch vụ bên ngoài.

Bản 1.10.0 hiển thị bối cảnh luyện nghe song song Anh/Việt; sau khi trả lời, câu nghe cũng có bản dịch đối chiếu. Migration 010 bổ sung bản dịch viết sẵn cho 45 tình huống. Điện thoại xếp hai ngôn ngữ theo chiều dọc để dễ đọc.

## Chat trực tiếp với website (1.10.0)

Đã bỏ liên kết, giao diện và tích hợp Gemini. **Chat luyện tiếng Anh** có ô nhập và nút **Send** ngay trong website: Enter gửi, Shift+Enter xuống dòng, hoặc dùng micro rồi gửi. Cuộc trò chuyện được tạo tự động khi gửi câu đầu và lưu vào PostgreSQL theo hồ sơ hiện có. Có lịch sử, cuộc trò chuyện mới, nghe phản hồi và bản dịch tùy chọn.

Website dùng **phản hồi tự động đơn giản theo chủ đề**, không phải AI sinh văn bản. Hỗ trợ lời chào, tâm trạng, công việc, sở thích, đồ ăn, du lịch, thời tiết và lời cảm ơn/tạm biệt; vài gợi ý diễn đạt được lập trình sẵn. Câu ngắn tiếp theo có thể nối tiếp chủ đề trước. Nội dung ngoài phạm vi nhận diện có thể nhận phản hồi chung. Không cần API key, không gọi dịch vụ Gemini hoặc dịch vụ chat ngoài.

Migration 013 đổi tên cuộc chat trống, giữ lịch sử cũ. Hồ sơ cookie HttpOnly chỉ đọc được lịch sử của mình. Giọng đọc/micro phụ thuộc trình duyệt; không chấm phát âm. Mỗi cuộc tối đa 20 lượt và có giới hạn tốc độ gửi để tránh gửi trùng liên tiếp.
