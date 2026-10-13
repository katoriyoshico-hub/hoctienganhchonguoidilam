-- Keep history while removing the old provider name from empty conversations.
ALTER TABLE ai_conversations ALTER COLUMN title SET DEFAULT 'Cuộc trò chuyện mới';
UPDATE ai_conversations SET title='Cuộc trò chuyện mới' WHERE title='Trò chuyện với Gemini';
