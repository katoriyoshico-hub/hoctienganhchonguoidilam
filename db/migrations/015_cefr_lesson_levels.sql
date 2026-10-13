-- Suggested study levels. Existing lesson content and learner progress are retained.
CREATE TABLE cefr_levels (
 code VARCHAR(2) PRIMARY KEY,
 title TEXT NOT NULL,
 group_code TEXT NOT NULL,
 group_title TEXT NOT NULL,
 description TEXT NOT NULL,
 sort_order INT NOT NULL UNIQUE
);
INSERT INTO cefr_levels VALUES
('A1','Mới bắt đầu','basic','Cơ bản','Lời chào, nhu cầu đơn giản và giao tiếp quen thuộc với sự hỗ trợ.',1),
('A2','Sơ cấp','basic','Cơ bản','Trao đổi thông tin thường ngày, mua sắm, di chuyển và dịch vụ.',2),
('B1','Trung cấp','independent','Trung cấp','Mô tả trải nghiệm, giải thích nhu cầu và xử lý tình huống công việc.',3),
('B2','Trên trung cấp','independent','Trung cấp','Thảo luận điều kiện, quy trình và vấn đề chuyên môn chi tiết hơn.',4),
('C1','Cao cấp','proficient','Nâng cao','Diễn đạt linh hoạt, lập luận và trao đổi các chủ đề phức tạp.',5),
('C2','Thành thạo','proficient','Nâng cao','Diễn đạt tinh tế, chính xác và xử lý các sắc thái ngôn ngữ khó.',6);
ALTER TABLE lessons ADD COLUMN cefr_level VARCHAR(2) NOT NULL DEFAULT 'B1' REFERENCES cefr_levels(code);
UPDATE lessons SET cefr_level='A1' WHERE lesson_id IN (101,201,202,203,204,219);
UPDATE lessons SET cefr_level='A2' WHERE lesson_id IN (105,106,108,110,111,112,116,117,205,206,207,208,209,210,211,212,213,214,215,216,217,218,220,221,222,303,305,313,404,408,409,413,426,427,428);
UPDATE lessons SET cefr_level='B2' WHERE lesson_id IN (308,315,316,403,415,417,419,420,421,429,431);
