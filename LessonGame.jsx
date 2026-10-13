import React, { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Volume2 } from "lucide-react";
import { makeLessonQuestions, normalizeAnswer } from "./lesson-game.js";
export default function LessonGame({ lesson, speak, onClose }) {
  const [round, setRound] = useState(0),
    [index, setIndex] = useState(0),
    [input, setInput] = useState(""),
    [checked, setChecked] = useState(false),
    [score, setScore] = useState(0),
    [finished, setFinished] = useState(false);
  const questions = useMemo(
    () => makeLessonQuestions(lesson, round),
    [lesson, round],
  );
  const question = questions[index];
  const matches = normalizeAnswer(input) === normalizeAnswer(question.answer);
  const check = (e) => {
    e.preventDefault();
    if (checked || !input.trim()) return;
    setChecked(true);
    if (matches) setScore((s) => s + 1);
  };
  const next = () => {
    if (index + 1 === questions.length) setFinished(true);
    else {
      setIndex((i) => i + 1);
      setInput("");
      setChecked(false);
    }
  };
  const replay = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setInput("");
    setChecked(false);
    setScore(0);
    setFinished(false);
  };
  return (
    <section className="lesson-game" aria-label="Trò chơi sau bài học">
      <button className="back" onClick={onClose}>
        ← Về thư viện
      </button>
      <div className="page-title">
        <span className="eyebrow dark">BÀI {lesson.id} · ÔN TẬP NHANH</span>
        <h1>Thử thách sau bài học</h1>
        <p>{lesson.title}</p>
      </div>
      {finished ? (
        <div className="game-panel" role="status">
          <div className="game-celebration" aria-hidden="true">
            {score === questions.length ? "🏆" : "🎯"}
          </div>
          <h2>
            {score === questions.length
              ? "Bạn đã nhớ rất tốt!"
              : "Hoàn thành lượt chơi!"}
          </h2>
          <p className="game-score">
            {score}/{questions.length} câu đúng
          </p>
          <p>
            Bài học đã được lưu hoàn thành. Bạn có thể chơi lại để ôn những câu
            chưa nhớ.
          </p>
          <div className="practice-actions">
            <button className="primary" onClick={replay}>
              <RotateCcw size={17} /> Chơi lại
            </button>
            <button className="outline" onClick={onClose}>
              Về thư viện
            </button>
          </div>
        </div>
      ) : (
        <div className="game-panel">
          <div className="game-progress">
            <span>
              Câu {index + 1}/{questions.length}
            </span>
            <span>Đúng: {score}</span>
          </div>
          <div className="progressbar">
            <div style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>
          <h2>
            {question.type === "blank"
              ? "Điền từ còn thiếu"
              : "Viết lại câu đã học"}
          </h2>
          <p className="game-meaning">{question.meaning}</p>
          {question.type === "blank" ? (
            <p className="game-sentence">{question.masked}</p>
          ) : (
            <>
              <p>
                Viết câu tiếng Anh theo nghĩa trên. Các từ gợi ý đã được xáo
                trộn:
              </p>
              <div className="game-word-bank">
                {question.words.map((word, i) => (
                  <span key={i}>{word}</span>
                ))}
              </div>
            </>
          )}
          <form onSubmit={check}>
            <label htmlFor="game-answer">
              {question.type === "blank" ? "Từ còn thiếu" : "Câu tiếng Anh"}
            </label>
            <input
              id="game-answer"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={checked}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={
                question.type === "blank" ? "Nhập một từ…" : "Nhập câu đã học…"
              }
            />
            <button
              className="primary"
              disabled={checked || !input.trim()}
              type="submit"
            >
              Kiểm tra đáp án
            </button>
          </form>
          {checked && (
            <div
              className={`game-feedback ${matches ? "correct" : "retry"}`}
              role="status"
            >
              <strong>
                {matches ? "Chính xác!" : "Đáp án chưa khớp câu đã học."}
              </strong>
              <p>
                {question.type === "blank" ? "Từ cần điền: " : "Câu mẫu: "}
                <b>{question.answer}</b>
              </p>
              <p>{question.english}</p>
              <p>{question.meaning}</p>
              <div className="practice-actions">
                <button
                  className="outline"
                  onClick={() => speak(question.english)}
                >
                  <Volume2 size={17} /> Nghe lại câu
                </button>
                <button className="primary" onClick={next}>
                  {index + 1 === questions.length
                    ? "Xem kết quả"
                    : "Câu tiếp theo"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
          <p className="note">
            So sánh với câu đã học; không phân biệt chữ hoa, dấu câu và khoảng
            trắng. Điểm trò chơi chỉ hiển thị trong lượt chơi này.
          </p>
        </div>
      )}
    </section>
  );
}
