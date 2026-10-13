ALTER TABLE flashcard_reviews ADD COLUMN rating TEXT CHECK (rating IN ('hard', 'good', 'easy'));
ALTER TABLE flashcard_reviews ADD CONSTRAINT unique_user_phrase UNIQUE (user_id, phrase_id);
ALTER TABLE session_turns ADD CONSTRAINT unique_session_turn UNIQUE (session_id, turn_index);
ALTER TABLE scenario_turns ADD CONSTRAINT unique_scenario_step UNIQUE (scenario_id, step_order);
