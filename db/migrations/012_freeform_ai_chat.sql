-- Preserve previous conversations and allow new chats without a scenario.
ALTER TABLE ai_conversations ALTER COLUMN scenario_id DROP NOT NULL;
ALTER TABLE ai_conversations ADD COLUMN title TEXT NOT NULL DEFAULT 'Trò chuyện với Gemini';
UPDATE ai_conversations c SET title=s.title FROM scenarios s WHERE c.scenario_id=s.scenario_id;
