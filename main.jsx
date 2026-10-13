import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Plane,
  Briefcase,
  Mic,
  Volume2,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  House,
  MessageCircle,
  Layers,
  ChartNoAxesColumn,
  Menu,
  X,
  Star,
  Flame,
} from "lucide-react";
import "./style.css";
async function api(path, body, method = "PUT") {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Không lưu được dữ liệu. Vui lòng thử lại.");
  return r.json();
}
function Catalog() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/catalog", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Không tải được nội dung học.");
        return r.json();
      })
      .then((d) => {
        if (
          !d.lessons?.length ||
          !d.scenarios?.length ||
          d.lessons.some((l) => !l.phrases?.length) ||
          d.scenarios.some((s) => !s.lines?.length)
        )
          throw new Error("Nội dung học chưa sẵn sàng.");
        return fetch("/api/state", { signal: controller.signal })
          .then((r) => {
            if (!r.ok) throw new Error("Không tải được tiến độ.");
            return r.json();
          })
          .then((state) => setData({ ...d, state }));
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Không tải được nội dung học. Vui lòng kiểm tra kết nối và thử lại.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <main role="alert">
        <p>{error}</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Thử lại</button>
      </main>
    );
  if (!data) return <main role="status">Đang tải nội dung học…</main>;
  return (
    <App
      lessons={data.lessons}
      scenarios={data.scenarios}
      initialState={data.state}
    />
  );
}
function App({ lessons, scenarios, initialState }) {
  const [page, setPage] = useState("home"),
    [category, setCategory] = useState("all"),
    [done, setDone] = useState(initialState.done),
    [goal, setGoal] = useState(initialState.goal),
    [active, setActive] = useState(lessons[0]),
    [idx, setIdx] = useState(0),
    [heard, setHeard] = useState(""),
    [listening, setListening] = useState(false),
    [scenario, setScenario] = useState(scenarios[0]),
    [turn, setTurn] = useState(0),
    [answers, setAnswers] = useState([]),
    [cardIdx, setCardIdx] = useState(0),
    [flipped, setFlipped] = useState(false),
    [reviews, setReviews] = useState(initialState.reviews),
    [mobile, setMobile] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [sessionId, setSessionId] = useState(null),
    [sessions, setSessions] = useState(initialState.sessions);
  const persist = async (action) => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await action();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const all = lessons.flatMap((l) =>
    l.phrases.map((p, i) => ({ key: `${l.id}-${i}`, p, lesson: l })),
  );
  const speak = (t) => {
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ phát âm.");
      return;
    }
    speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(t);
    u.lang = "en-US";
    u.rate = 0.82;
    speechSynthesis.speak(u);
  };
  const record = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(
        "Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy thử Chrome và cho phép microphone.",
      );
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setHeard(t);
      if (page === "roleplay")
        setAnswers((a) => {
          const next = [...a];
          next[turn] = t;
          return next;
        });
    };
    r.onerror = (e) => {
      setListening(false);
      alert("Không thể nhận giọng nói: " + e.error);
    };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };
  const navigate = (p) => {
    setPage(p);
    setMobile(false);
    setHeard("");
  };
  const openLesson = (l) => {
    setActive(l);
    setIdx(0);
    navigate("lesson");
  };
  const finish = () =>
    persist(async () => {
      await api("/api/state/progress", { lessonId: active.id });
      setDone((a) => (a.includes(active.id) ? a : [...a, active.id]));
      navigate("lessons");
    });
  const review = (rating) =>
    persist(async () => {
      const item = all[cardIdx];
      const result = await api("/api/state/reviews", {
        lessonId: item.lesson.id,
        phraseIndex:
          cardIdx - all.findIndex((x) => x.lesson.id === item.lesson.id),
        rating,
      });
      setReviews((r) => ({ ...r, [item.key]: result }));
      setFlipped(false);
      setCardIdx((i) => (i + 1) % all.length);
    });
  const advance = () =>
    persist(async () => {
      let id = sessionId;
      if (!id) {
        id = (await api("/api/sessions", { scenarioId: scenario.id }, "POST"))
          .id;
        setSessionId(id);
      }
      await api(`/api/sessions/${id}/turns`, {
        turnIndex: turn,
        transcript: heard,
      });
      setHeard("");
      if (turn < scenario.lines.length - 1) setTurn((t) => t + 1);
      else {
        setTurn(0);
        setAnswers([]);
        setSessionId(null);
        const r = await fetch("/api/state");
        if (!r.ok) throw new Error("Không tải được lịch sử.");
        setSessions((await r.json()).sessions);
      }
    });
  const nav = [
    ["home", House, "Tổng quan"],
    ["lessons", BookOpen, "Bài học"],
    ["roleplay", MessageCircle, "Hội thoại"],
    ["flashcards", Layers, "Flashcards"],
    ["progress", ChartNoAxesColumn, "Tiến độ"],
  ];
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "show" : "")}>
        <div className="brand">
          <div className="brandicon">CT</div>
          <div>
            <strong>CT-Speak</strong>
            <small>Speak with confidence</small>
          </div>
        </div>
        <nav>
          {nav.map(([p, Icon, t]) => (
            <button
              key={p}
              className={page === p ? "selected" : ""}
              onClick={() => navigate(p)}
            >
              <Icon size={19} />
              {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">CT</div>
          <div>
            <b>Học viên CT-Speak</b>
            <small>Hành trình 60 ngày</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <button className="menu" onClick={() => setMobile(!mobile)}>
            {mobile ? <X /> : <Menu />}
          </button>
          <span className="breadcrumb">
            CT-Speak <span>/</span>{" "}
            {nav.find((x) => x[0] === page)?.[2] || "Bài học"}
          </span>
          <span className="headright">
            <Flame size={18} color="#f69b41" /> Học mỗi ngày{" "}
            <span className="avatar tiny">CT</span>
          </span>
        </header>
        <div className="content">
          {saveError && <p role="alert">{saveError}</p>}
          <fieldset
            disabled={saving}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            {saving && <p role="status">Đang lưu…</p>}
            {page === "home" && (
              <>
                <section className="hero">
                  <div>
                    <span className="eyebrow">
                      ✨ LỘ TRÌNH 60 NGÀY · 15 PHÚT/NGÀY
                    </span>
                    <h1>
                      Tiếng Anh tự tin,
                      <br />
                      cơ hội rộng mở.
                    </h1>
                    <p>
                      Luyện giao tiếp thực tế trong công việc và du lịch, từng
                      bước từ những câu đơn giản nhất.
                    </p>
                    <button
                      className="primary"
                      onClick={() =>
                        openLesson(
                          lessons.find((l) => !done.includes(l.id)) ||
                            lessons[0],
                        )
                      }
                    >
                      Bắt đầu học ngay <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="hero-art">
                    <span>HELLO!</span>
                    <div className="bubble">How can I help you?</div>
                    <div className="orb">✦</div>
                  </div>
                </section>
                <div className="stats">
                  <div className="stat">
                    <span>Tiến độ bài học</span>
                    <strong>
                      {done.length}/{lessons.length}
                    </strong>
                    <div className="track">
                      <i
                        style={{
                          width: (done.length / lessons.length) * 100 + "%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="stat">
                    <span>Thời gian đã học (ước tính)</span>
                    <strong>
                      {done.length * 15} <small>phút</small>
                    </strong>
                    <p>15 phút cho mỗi bài hoàn thành</p>
                  </div>
                  <div className="stat">
                    <span>Mẫu câu luyện tập</span>
                    <strong>{all.length}</strong>
                    <p>Trong hai chủ đề thực tế</p>
                  </div>
                </div>
                <div className="section-head">
                  <div>
                    <h2>Chọn hành trình của bạn</h2>
                    <p>Hai chủ đề thiết kế riêng cho nhu cầu của bạn.</p>
                  </div>
                </div>
                <div className="two">
                  <button
                    className="path work"
                    onClick={() => {
                      setCategory("work");
                      navigate("lessons");
                    }}
                  >
                    <span className="path-icon">
                      <Briefcase />
                    </span>
                    <span>
                      <b>Tiếng Anh tư vấn & bán hàng</b>
                      <small>
                        Chào khách, giới thiệu sản phẩm, chốt đơn và đổi trả
                      </small>
                      <em>Khám phá bài học →</em>
                    </span>
                  </button>
                  <button
                    className="path travel"
                    onClick={() => {
                      setCategory("travel");
                      navigate("lessons");
                    }}
                  >
                    <span className="path-icon">
                      <Plane />
                    </span>
                    <span>
                      <b>Tiếng Anh du lịch</b>
                      <small>
                        Tham quan, giao tiếp với người bản địa và mua quà
                      </small>
                      <em>Khám phá bài học →</em>
                    </span>
                  </button>
                </div>
                <div className="section-head">
                  <h2>Học nhanh hôm nay</h2>
                </div>
                <div className="quick">
                  <div>
                    <span className="quick-icon">🎙️</span>
                    <b>Thử hội thoại thực tế</b>
                    <p>Thực hành các tình huống có hướng dẫn.</p>
                  </div>
                  <button
                    className="outline"
                    onClick={() => navigate("roleplay")}
                  >
                    Luyện hội thoại <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {page === "lessons" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">CHƯƠNG TRÌNH HỌC</span>
                  <h1>Thư viện bài học</h1>
                  <p>
                    Học những mẫu câu thiết thực và luyện phát âm từng ngày.
                  </p>
                </div>
                <div className="filters">
                  {[
                    ["all", "Tất cả"],
                    ["work", "Tư vấn & bán hàng"],
                    ["travel", "Du lịch"],
                  ].map(([c, t]) => (
                    <button
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                      key={c}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="lesson-grid">
                  {lessons
                    .filter((l) => category === "all" || l.cat === category)
                    .map((l, i) => (
                      <button
                        className="lesson-card"
                        key={l.id}
                        onClick={() => openLesson(l)}
                      >
                        <div className={"lesson-icon " + l.cat}>
                          {l.cat === "work" ? <Briefcase /> : <Plane />}
                        </div>
                        <div className="lesson-text">
                          <span className="mini">BÀI {l.id} · 15 PHÚT</span>
                          <h3>{l.title}</h3>
                          <p>{l.desc}</p>
                          <span
                            className={
                              "status " +
                              (done.includes(l.id) ? "completed" : "")
                            }
                          >
                            {done.includes(l.id)
                              ? "✓ Đã hoàn thành"
                              : "Bắt đầu học →"}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </>
            )}
            {page === "lesson" && (
              <>
                <button className="back" onClick={() => navigate("lessons")}>
                  ← Quay lại danh sách
                </button>
                <div className="page-title">
                  <span className="eyebrow dark">
                    BÀI {active.id} · MẪU CÂU {idx + 1}/{active.phrases.length}
                  </span>
                  <h1>{active.title}</h1>
                  <p>{active.desc}</p>
                </div>
                <div className="lesson-detail">
                  <div className="progressbar">
                    <div
                      style={{
                        width: ((idx + 1) / active.phrases.length) * 100 + "%",
                      }}
                    />
                  </div>
                  <span className="tag">LUYỆN NGHE & NHẠI ÂM</span>
                  <h2>{active.phrases[idx][0]}</h2>
                  <p className="ipa">{active.phrases[idx][2]}</p>
                  <p className="translation">{active.phrases[idx][1]}</p>
                  <div className="practice-actions">
                    <button
                      className="outline"
                      onClick={() => speak(active.phrases[idx][0])}
                    >
                      <Volume2 size={18} /> Nghe phát âm
                    </button>
                    <button className="primary" onClick={record}>
                      <Mic size={18} />
                      {listening ? "Đang nghe..." : "Thử đọc câu này"}
                    </button>
                  </div>
                  {heard && (
                    <div className="transcript">
                      <b>Máy nghe được:</b> {heard}
                      <p>
                        Đây là bản ghi nhận diện giọng nói, chưa phải điểm chấm
                        phát âm AI.
                      </p>
                    </div>
                  )}
                  {active.vocabulary?.length > 0 && (
                    <section
                      className="vocabulary"
                      aria-label="Từ vựng theo tình huống"
                    >
                      <h3>Từ vựng theo tình huống</h3>
                      <p>
                        Ôn nghĩa và nghe phát âm. Những từ này cũng có trong
                        Flashcards.
                      </p>
                      <div className="vocabulary-grid">
                        {active.vocabulary.map(([word, meaning, ipa]) => (
                          <article key={word} className="vocabulary-item">
                            <strong>{word}</strong>
                            <span>{ipa}</span>
                            <p>{meaning}</p>
                            <button
                              className="outline"
                              onClick={() => speak(word)}
                              aria-label={`Nghe từ ${word}`}
                            >
                              <Volume2 size={16} /> Nghe
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                  <div className="lesson-footer">
                    <span>
                      {idx + 1} / {active.phrases.length} mẫu câu
                    </span>
                    <button
                      className="primary"
                      onClick={() => {
                        setHeard("");
                        idx + 1 < active.phrases.length
                          ? setIdx((i) => i + 1)
                          : finish();
                      }}
                    >
                      {idx + 1 === active.phrases.length
                        ? "Hoàn thành bài học"
                        : "Câu tiếp theo"}{" "}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              </>
            )}
            {page === "roleplay" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">THỰC HÀNH GIAO TIẾP</span>
                  <h1>Hội thoại tình huống</h1>
                  <p>
                    Đóng vai với kịch bản mẫu và luyện trả lời bằng tiếng Anh.
                  </p>
                </div>
                <div className="filters">
                  {scenarios.map((s, i) => (
                    <button
                      className={scenario === s ? "active" : ""}
                      key={s.title}
                      onClick={() => {
                        setScenario(s);
                        setSessionId(null);
                        setTurn(0);
                        setAnswers([]);
                        setHeard("");
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
                <div className="scenario-context">
                  <p>
                    <strong>Vai của bạn:</strong> {scenario.userRole}
                  </p>
                  <p>{scenario.briefing}</p>
                </div>
                <div className="chat-panel">
                  <div className="chat-header">
                    <div className="bot-avatar">✦</div>
                    <div>
                      <b>{scenario.role}</b>
                      <small>
                        Kịch bản mô phỏng · {turn + 1}/{scenario.lines.length}
                      </small>
                    </div>
                  </div>
                  <div className="chat-body">
                    {scenario.lines.slice(0, turn + 1).map((line, i) => (
                      <React.Fragment key={i}>
                        <div className="chat bot">
                          {line}
                          <button
                            onClick={() => speak(line)}
                            aria-label="Nghe câu"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                        {answers[i] && (
                          <div className="chat user">{answers[i]}</div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="chat-bottom">
                    <p>
                      <b>Gợi ý trả lời:</b>{" "}
                      {scenario.hints[
                        Math.min(turn, scenario.hints.length - 1)
                      ] || "Thank you very much!"}
                    </p>
                    <div className="practice-actions">
                      <button
                        className="outline"
                        onClick={() => speak(scenario.lines[turn])}
                      >
                        <Volume2 size={17} /> Nghe câu hỏi
                      </button>
                      <button className="outline" onClick={record}>
                        <Mic size={17} />
                        {listening ? "Đang nghe..." : "Nói câu trả lời"}
                      </button>
                      <button className="primary" onClick={advance}>
                        {turn === scenario.lines.length - 1
                          ? "Luyện lại"
                          : "Tiếp tục"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <small className="disclaimer">
                      Phiên bản demo: lời thoại được định sẵn, chưa có AI phản
                      hồi linh hoạt hay chấm điểm.
                    </small>
                  </div>
                </div>
              </>
            )}
            {page === "flashcards" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">ÔN TẬP NGẮT QUÃNG</span>
                  <h1>Flashcards</h1>
                  <p>Chạm vào thẻ để xem nghĩa, sau đó chọn mức độ ghi nhớ.</p>
                </div>
                <div className="flash-count">
                  Thẻ {cardIdx + 1} / {all.length}
                </div>
                <button
                  className={"flashcard " + (flipped ? "flipped" : "")}
                  onClick={() => setFlipped((v) => !v)}
                >
                  <span>
                    {flipped ? "NGHĨA TIẾNG VIỆT" : "MẪU CÂU TIẾNG ANH"}
                  </span>
                  <strong>
                    {flipped ? all[cardIdx].p[1] : all[cardIdx].p[0]}
                  </strong>
                  <small>
                    <RotateCcw size={15} /> Chạm để lật thẻ
                  </small>
                </button>
                <div className="flash-actions">
                  <button onClick={() => review("hard")}>
                    Chưa thuộc <small>10 phút</small>
                  </button>
                  <button onClick={() => review("good")}>
                    Tạm nhớ <small>1 ngày</small>
                  </button>
                  <button onClick={() => review("easy")}>
                    Đã thuộc <small>4 ngày</small>
                  </button>
                </div>
                <p className="note">
                  Lịch ôn tập được lưu trên máy chủ cho hồ sơ học tập của bạn.
                </p>
              </>
            )}
            {page === "progress" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">HÀNH TRÌNH CỦA BẠN</span>
                  <h1>Tiến độ học tập</h1>
                  <p>Theo dõi bài đã hoàn thành và chọn mục tiêu học tập.</p>
                </div>
                <div className="stats">
                  <div className="stat">
                    <span>Bài hoàn thành</span>
                    <strong>
                      {done.length}/{lessons.length}
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Tiến độ nội dung mẫu</span>
                    <strong>
                      {Math.round((done.length / lessons.length) * 100)}%
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Thẻ đã đánh giá</span>
                    <strong>{Object.keys(reviews).length}</strong>
                  </div>
                </div>
                <div className="settings">
                  <p>Phiên luyện tập đã lưu: {sessions.length}</p>
                  <h2>Mục tiêu ưu tiên</h2>
                  <select
                    value={goal}
                    onChange={(e) => {
                      const value = e.target.value;
                      persist(async () => {
                        await api("/api/state/goal", { goal: value });
                        setGoal(value);
                      });
                    }}
                  >
                    <option value="both">Tư vấn & Du lịch</option>
                    <option value="work">Tư vấn & bán hàng</option>
                    <option value="travel">Du lịch quốc tế</option>
                  </select>
                  <h2>Bài học đã hoàn thành</h2>
                  {done.length === 0 ? (
                    <p>Chưa có bài hoàn thành. Hãy bắt đầu với bài đầu tiên!</p>
                  ) : (
                    lessons
                      .filter((l) => done.includes(l.id))
                      .map((l) => (
                        <p key={l.id}>
                          <CheckCircle2 size={17} color="#1cae88" /> {l.title}
                        </p>
                      ))
                  )}
                </div>
              </>
            )}
          </fieldset>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Catalog />);
import "./style.css";
