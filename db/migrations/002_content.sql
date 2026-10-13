INSERT INTO modules (module_id, category, title, order_index) VALUES
(1, 'WORKPLACE_CONSULTING', 'Tiếng Anh tư vấn', 1),
(2, 'TRAVEL_SURVIVAL', 'Tiếng Anh du lịch', 2);
INSERT INTO lessons (lesson_id, module_id, title, target_situation, order_index) VALUES
(101, 1, 'Chào đón khách & Mở đầu cuộc hẹn', 'Gặp khách quốc tế tại văn phòng', 1),
(102, 1, 'Lắng nghe & Khai thác nhu cầu', 'Tìm hiểu nhu cầu khách hàng', 2),
(103, 1, 'Báo giá & Giải thích gói dịch vụ', 'Trình bày mức giá và quyền lợi', 3),
(104, 1, 'Xử lý khi khách chê đắt', 'Đề xuất giải pháp thay thế', 4),
(201, 2, 'Thủ tục Sân bay & Xuất nhập cảnh', 'Trả lời nhân viên nhập cảnh', 5),
(202, 2, 'Nhận phòng Khách sạn', 'Check-in và hỏi tiện ích', 6),
(203, 2, 'Gọi món & Thanh toán', 'Nhà hàng và cà phê', 7),
(204, 2, 'Hỏi đường & Di chuyển', 'Tàu điện, taxi và tìm đường', 8);
INSERT INTO phrases (phrase_id, lesson_id, english_text, vietnamese_meaning, ipa_phonetic, audio_sample_url) VALUES
(10101, 101, 'Good morning! Welcome to our office.', 'Chào buổi sáng! Chào mừng quý khách đến văn phòng chúng tôi.', '/ɡʊd ˈmɔː.nɪŋ/', ''),
(10102, 101, 'Did you have any trouble finding our place?', 'Quý khách tìm đường đến đây có khó khăn gì không ạ?', '/dɪd juː hæv ˈen.i ˈtrʌb.l/', ''),
(10103, 101, 'Please take a seat. Can I get you some water or coffee?', 'Mời quý khách ngồi. Tôi có thể lấy chút nước hoặc cà phê không?', '/pliːz teɪk ə siːt/', ''),
(10201, 102, 'How can I help you today?', 'Hôm nay tôi có thể giúp gì cho quý khách?', '/haʊ kæn aɪ help juː/', ''),
(10202, 102, 'What are you looking for?', 'Quý khách đang tìm kiếm điều gì?', '/wɒt ɑː juː ˈlʊkɪŋ fɔː/', ''),
(10203, 102, 'Could you tell me more?', 'Quý khách có thể chia sẻ thêm không?', '/kʊd juː tel miː mɔː/', ''),
(10301, 103, 'Our standard package starts at two hundred dollars per month.', 'Gói tiêu chuẩn có giá từ 200 đô mỗi tháng.', '/ɑːr ˈstæn.dəd ˈpæk.ɪdʒ/', ''),
(10302, 103, 'This plan includes 24/7 customer support and free consultation.', 'Gói này bao gồm hỗ trợ 24/7 và tư vấn miễn phí.', '/ðɪs plæn ɪnˈkluːdz/', ''),
(10401, 104, 'I understand your concern.', 'Tôi hiểu mối bận tâm của quý khách.', '/aɪ ˌʌndəˈstænd/', ''),
(10402, 104, 'Let me suggest another option.', 'Để tôi đề xuất lựa chọn khác.', '/let mi səˈdʒest/', ''),
(20101, 201, 'I am here for a vacation for five days.', 'Tôi đến đây nghỉ dưỡng trong 5 ngày.', '/aɪ æm hɪər fɔːr ə vəˈkeɪ.ʃən/', ''),
(20102, 201, 'Here is my passport and return flight ticket.', 'Đây là hộ chiếu và vé máy bay khứ hồi của tôi.', '/hɪər ɪz maɪ ˈpɑːs.pɔːt/', ''),
(20201, 202, 'I have a reservation under the name Nguyen Minh Tuan.', 'Tôi đã đặt phòng dưới tên Nguyễn Minh Tuấn.', '/aɪ hæv ə ˌrez.əˈveɪ.ʃən/', ''),
(20202, 202, 'Could you please give me the Wi-Fi password?', 'Bạn có thể cho tôi mật khẩu Wi-Fi không?', '/kʊd juː pliːz ɡɪv miː/', ''),
(20301, 203, 'Could I see the menu, please?', 'Cho tôi xem thực đơn được không?', '/kʊd aɪ siː ðə ˈmen.juː/', ''),
(20302, 203, 'Can I pay by card?', 'Tôi có thể thanh toán bằng thẻ không?', '/kæn aɪ peɪ baɪ kɑːd/', ''),
(20401, 204, 'How do I get to the train station?', 'Làm sao để đến ga tàu?', '/haʊ duː aɪ ɡet/', ''),
(20402, 204, 'Is this the right way?', 'Đây có đúng đường không?', '/ɪz ðɪs ðə raɪt weɪ/', '');
INSERT INTO scenarios (scenario_id, lesson_id, title, ai_role_name, user_role_name, context_briefing, initial_ai_greeting) VALUES
(501, 101, 'Đón tiếp đối tác nước ngoài', 'Mr. Robert', 'Chuyên viên tư vấn', 'Đón tiếp đối tác nước ngoài', 'Hello, good morning! I am Robert from Singapore. I have an appointment here today.'),
(502, 201, 'Kiểm soát nhập cảnh sân bay', 'Immigration Officer', 'Du khách', 'Kiểm soát nhập cảnh sân bay', 'Good day. May I see your passport, please?'),
(503, 203, 'Gọi món tại nhà hàng', 'Sarah', 'Du khách', 'Gọi món tại nhà hàng', 'Hi there! Are you ready to order?');
INSERT INTO scenario_turns (scenario_id, step_order, expected_user_intent, bot_reaction_rules) VALUES
(501, 1, 'Good morning! Welcome to our office.', 'Hello, good morning! I am Robert from Singapore. I have an appointment here today.'),
(501, 2, 'Please follow me to the meeting room.', 'Thank you. Where is the meeting room?'),
(501, 3, 'Of course. Please take a seat.', 'That sounds great. Could I have some water?'),
(501, 4, 'Of course. Please take a seat.', 'Thank you for your help!'),
(502, 1, 'Here is my passport.', 'Good day. May I see your passport, please?'),
(502, 2, 'I am here for a vacation.', 'What is the purpose of your visit?'),
(502, 3, 'I will stay for five days.', 'How long will you stay here?'),
(502, 4, 'I will stay for five days.', 'Enjoy your trip!'),
(503, 1, 'Could I see the menu?', 'Hi there! Are you ready to order?'),
(503, 2, 'Water, please.', 'Would you like something to drink?'),
(503, 3, 'Can I pay by card?', 'Would you like to pay by cash or card?'),
(503, 4, 'Can I pay by card?', 'Thank you! Have a nice day.');
UPDATE scenario_turns SET suggested_sample_phrases = ARRAY[expected_user_intent];
