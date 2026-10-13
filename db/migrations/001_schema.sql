-- 1. Bảng Người dùng (Users)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    current_level VARCHAR(30) DEFAULT 'A0_ZERO_BASE', -- A0_ZERO_BASE, A1_BEGINNER, A2_ELEMENTARY
    primary_goal VARCHAR(50) NOT NULL, -- CONSULTING, TRAVEL, BOTH
    job_title VARCHAR(100),
    streak_count INT DEFAULT 0,
    confidence_index INT DEFAULT 10, -- Thang điểm 0 - 100
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Mô-đun kiến thức (Modules: Workplace Consulting vs Travel Survival)
CREATE TABLE modules (
    module_id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- WORKPLACE_CONSULTING, TRAVEL_SURVIVAL
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Bảng Bài học vi mô (Lessons)
CREATE TABLE lessons (
    lesson_id SERIAL PRIMARY KEY,
    module_id INT REFERENCES modules(module_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    target_situation TEXT NOT NULL,
    estimated_minutes INT DEFAULT 15,
    order_index INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Mẫu câu & Từ vựng then chốt (Phrases)
CREATE TABLE phrases (
    phrase_id SERIAL PRIMARY KEY,
    lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    english_text TEXT NOT NULL,
    vietnamese_meaning TEXT NOT NULL,
    ipa_phonetic VARCHAR(255) NOT NULL,
    audio_sample_url VARCHAR(255) NOT NULL,
    context_note TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'EASY' -- EASY, MEDIUM, ADVANCED
);

-- 5. Bảng Kịch bản đóng vai AI (Scenarios)
CREATE TABLE scenarios (
    scenario_id SERIAL PRIMARY KEY,
    lesson_id INT REFERENCES lessons(lesson_id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    ai_role_name VARCHAR(100) NOT NULL,       -- Ví dụ: 'Mr. David (Client)', 'Immigration Officer'
    user_role_name VARCHAR(100) NOT NULL,     -- Ví dụ: 'Financial Consultant', 'Tourist'
    context_briefing TEXT NOT NULL,
    initial_ai_greeting TEXT NOT NULL,
    difficulty_level VARCHAR(20) DEFAULT 'EASY'
);

-- 6. Bảng Kịch bản lượt thoại mẫu (Scenario Turns / Prompts)
CREATE TABLE scenario_turns (
    turn_id SERIAL PRIMARY KEY,
    scenario_id INT REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    expected_user_intent VARCHAR(150) NOT NULL,
    suggested_sample_phrases TEXT[], -- Gợi ý 3 cách nói từ dễ đến tự nhiên
    bot_reaction_rules TEXT
);

-- 7. Bảng Phiên thực hành & Báo cáo chấm điểm AI (Practice Sessions)
CREATE TABLE practice_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    scenario_id INT REFERENCES scenarios(scenario_id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    fluency_score NUMERIC(5, 2),        -- 0.00 đến 100.00
    pronunciation_score NUMERIC(5, 2),  -- 0.00 đến 100.00
    ai_feedback_summary TEXT
);

-- 8. Bảng Lịch sử lượt nói chi tiết trong phiên (Session Turns)
CREATE TABLE session_turns (
    session_turn_id SERIAL PRIMARY KEY,
    session_id INT REFERENCES practice_sessions(session_id) ON DELETE CASCADE,
    turn_index INT NOT NULL,
    user_speech_transcript TEXT,
    detected_pronunciation_score NUMERIC(5,2),
    ai_response_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bảng Ôn tập Thẻ nhớ ngắt quãng (Flashcard Reviews - Spaced Repetition)
CREATE TABLE flashcard_reviews (
    review_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    phrase_id INT REFERENCES phrases(phrase_id) ON DELETE CASCADE,
    repetition_count INT DEFAULT 0,
    interval_days INT DEFAULT 1,
    easiness_factor NUMERIC(3, 2) DEFAULT 2.50,
    next_review_due TIMESTAMP WITH TIME ZONE NOT NULL,
    last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Bảng Theo dõi tiến độ học bài (User Progress)
CREATE TABLE user_progress (
    progress_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'IN_PROGRESS', -- NOT_STARTED, IN_PROGRESS, COMPLETED
    completion_percentage INT DEFAULT 0,
    highest_score NUMERIC(5, 2) DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_lesson UNIQUE(user_id, lesson_id)
);
