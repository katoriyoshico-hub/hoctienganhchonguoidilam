-- Keep existing vocabulary exercises and complete each lesson with sentence listening.
ALTER TABLE listening_exercises ADD COLUMN exercise_type TEXT NOT NULL DEFAULT 'vocabulary'
  CHECK (exercise_type IN ('vocabulary', 'sentence'));
WITH counts AS (
 SELECT p.lesson_id, count(*)::int AS total FROM listening_exercises e
 JOIN phrases p USING (phrase_id) GROUP BY p.lesson_id
), candidates AS (
 SELECT p.*, l.title, row_number() OVER (PARTITION BY p.lesson_id ORDER BY p.phrase_id) AS position,
 COALESCE(c.total,0) AS existing
 FROM phrases p JOIN lessons l USING (lesson_id) LEFT JOIN counts c USING (lesson_id)
 WHERE p.context_note IS DISTINCT FROM 'VOCABULARY'
 AND NOT EXISTS (SELECT 1 FROM listening_exercises e WHERE e.phrase_id=p.phrase_id)
)
INSERT INTO listening_exercises (phrase_id,situation,situation_en,spoken_text,spoken_translation,exercise_type)
SELECT phrase_id,
 'Giả sử bạn đang luyện giao tiếp trong tình huống: ' || title || '. Hãy nghe và chọn nghĩa của câu người đối thoại nói.',
 'Imagine you are talking with someone in the situation shown above. Listen to your partner and choose the meaning of their sentence.',
 english_text,vietnamese_meaning,'sentence'
FROM candidates WHERE position <= GREATEST(20-existing,0)
ORDER BY lesson_id,phrase_id;
