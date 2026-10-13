-- AI conversations are separate from previous lesson practice and review history.
CREATE TABLE ai_conversations (
  conversation_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  scenario_id INT NOT NULL REFERENCES scenarios(scenario_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_conversations_user_idx ON ai_conversations(user_id, created_at DESC);
CREATE TABLE ai_messages (
  message_id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  tip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages(conversation_id,message_id);
CREATE TABLE ai_daily_usage (
  usage_day DATE PRIMARY KEY,
  requests INT NOT NULL DEFAULT 0
);
