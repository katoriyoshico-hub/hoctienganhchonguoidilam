import React, { useEffect, useMemo, useState } from "react";
import { Search, Volume2, ArrowRight } from "lucide-react";

const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim().replace(/\s+/g, " ");

export default function Dictionary({ lessons, speak, openLesson }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const entries = useMemo(() => {
    const unique = new Map();
    for (const lesson of lessons) {
      for (const [items, type] of [[lesson.vocabulary || [], "Từ vựng"], [lesson.phrases || [], "Mẫu câu"]]) {
        for (const [english, meaning, ipa] of items) {
          const key = JSON.stringify([normalize(english), normalize(meaning)]);
          if (!unique.has(key)) unique.set(key, { key, english, meaning, ipa, type, lesson });
        }
      }
    }
    return [...unique.values()].sort((a, b) => a.english.localeCompare(b.english, "en"));
  }, [lessons]);
  const term = normalize(query);
  const results = useMemo(() => entries.filter((entry) => normalize(entry.english).includes(term) || normalize(entry.meaning).includes(term)).sort((a, b) => {
    const rank = (entry) => normalize(entry.english) === term ? 0 : normalize(entry.english).startsWith(term) ? 1 : 2;
    return rank(a) - rank(b);
  }), [entries, term]);

  return (
    <section className="dictionary">
      <div className="page-title">
        <span className="eyebrow dark">TRA CỨU & HỌC TỪ</span>
        <h1>Từ điển Anh–Việt</h1>
        <p>Tra cứu từ vựng và mẫu câu trong các bài học, kèm nghĩa tiếng Việt và phiên âm.</p>
      </div>
      <div className="dictionary-search">
        <label htmlFor="dictionary-query">Nhập từ tiếng Anh hoặc nghĩa tiếng Việt</label>
        <div className="dictionary-input">
          <Search size={20} aria-hidden="true" />
          <input id="dictionary-query" type="search" value={query} maxLength={200} placeholder="Ví dụ: booking, đặt phòng…" onChange={(event) => { setQuery(event.target.value); setLimit(30); }} />
          {query && <button className="outline" onClick={() => { setQuery(""); setLimit(30); }}>Xóa</button>}
        </div>
        <p>Hỗ trợ tiếng Việt không dấu. Phạm vi: {entries.length} từ và mẫu câu có sẵn trong ứng dụng.</p>
      </div>
      <p role="status" aria-live="polite">{term ? `Tìm thấy ${results.length} kết quả.` : `${results.length} mục tra cứu. Nhập từ để tìm nhanh.`}</p>
      {results.length === 0 && <div className="lesson-detail"><h2>Chưa tìm thấy từ này</h2><p>Thử một từ ngắn hơn, kiểm tra chính tả hoặc tìm bằng nghĩa tiếng Việt. Kho tra cứu hiện chỉ bao gồm nội dung bài học.</p></div>}
      <div className="dictionary-results">
        {results.slice(0, limit).map((entry) => <article className="dictionary-entry" key={entry.key}>
          <span className="dictionary-type">{entry.type}</span>
          <h2 lang="en">{entry.english}</h2>
          {entry.ipa && <p className="dictionary-ipa">{entry.ipa}</p>}
          <p className="dictionary-meaning" lang="vi">{entry.meaning}</p>
          <div className="dictionary-actions">
            <button className="outline" aria-label={`Nghe ${entry.english}`} onClick={() => speak(entry.english)}><Volume2 size={17} /> Nghe</button>
            <button className="dictionary-lesson" onClick={() => openLesson(entry.lesson)}>Bài học: {entry.lesson.title} <ArrowRight size={16} /></button>
          </div>
        </article>)}
      </div>
      {results.length > limit && <button className="outline" onClick={() => setLimit((count) => count + 30)}>Xem thêm kết quả ({results.length - limit} còn lại)</button>}
    </section>
  );
}
