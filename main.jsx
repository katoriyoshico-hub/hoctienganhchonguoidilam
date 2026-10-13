import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Plane,
  Briefcase,
  Mic,
  Volume2,
  Play,
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
import "./theme.css";
import AIChat from "./AIChat.jsx";
import Conversation, { SceneIllustration } from "./Conversation.jsx";
import LessonGame from "./LessonGame.jsx";
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
      levels={data.levels || []}
      fields={data.fields || []}
      lessons={data.lessons}
      scenarios={data.scenarios}
      listeningExercises={data.listeningExercises || []}
      initialState={data.state}
    />
  );
}
function ListeningPractice({ exercises, speak }) {
  const [category, setCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [played, setPlayed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const filtered = exercises.filter(
    (e) => category === "all" || e.cat === category,
  );
  const exercise = filtered[index];
  const reset = (cat = category) => {
    window.speechSynthesis?.cancel();
    setCategory(cat);
    setIndex(0);
    setAnswer(null);
    setPlayed(false);
    setCorrect(0);
    setCompleted(0);
    setFinished(false);
  };
  if (!exercise)
    return <p role="status">Chưa có bài luyện nghe trong chủ đề này.</p>;
  const distractors = [...new Set(exercises.map((e) => e.meaning))]
    .filter((m) => m !== exercise.meaning)
    .slice(0, 3);
  const choices = [exercise.meaning, ...distractors];
  // Stable shuffle avoids reshuffling answers during playback or feedback.
  let seed = exercise.id * 7919;
  for (let i = choices.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const play = (rate) => {
    const text = exercise.spokenText + " Key word: " + exercise.word + ".";
    speak(text, rate);
    if ("speechSynthesis" in window) setPlayed(true);
  };
  const choose = (meaning) => {
    if (!played || answer !== null) return;
    setAnswer(meaning);
    setCompleted((n) => n + 1);
    if (meaning === exercise.meaning) setCorrect((n) => n + 1);
  };
  return (
    <section className="listening-practice">
      <div className="page-title">
        <span className="eyebrow dark">NGHE TRONG TÌNH HUỐNG</span>
        <h1>Luyện nghe từ vựng</h1>
        <p>Nghe câu và từ khóa, chọn nghĩa tiếng Việt rồi xem giải thích.</p>
      </div>
      <div className="filters">
        {[
          ["all", "Tất cả"],
          ["work", "Bán hàng"],
          ["travel", "Tham quan & quà lưu niệm"],
        ].map(([cat, label]) => (
          <button
            key={cat}
            className={category === cat ? "active" : ""}
            onClick={() => reset(cat)}
          >
            {label}
          </button>
        ))}
      </div>
      {finished ? (
        <div className="lesson-detail" role="status">
          <h2>Hoàn thành lượt luyện nghe</h2>
          <p>
            Bạn trả lời đúng {correct}/{completed} câu.
          </p>
          <button className="primary" onClick={() => reset()}>
            Luyện lại chủ đề
          </button>
        </div>
      ) : (
        <div className="lesson-detail">
          <p>
            Câu {index + 1}/{filtered.length} · Đúng {correct}/{completed}
          </p>
          <h2>{exercise.lessonTitle}</h2>
          <div className="listening-situation bilingual-listening">
            <div lang="en"><span className="bilingual-label">English</span><p>{exercise.situationEn}</p></div>
            <div lang="vi"><span className="bilingual-label">Tiếng Việt</span><p>{exercise.situation}</p></div>
          </div>
          <div className="practice-actions">
            <button className="primary" onClick={() => play(0.82)}>
              <Volume2 size={18} /> Nghe tình huống
            </button>
            <button className="outline" onClick={() => play(0.65)}>
              Nghe chậm
            </button>
          </div>
          <h3>Từ khóa bạn vừa nghe có nghĩa là gì?</h3>
          {!played && (
            <p>Nhấn nghe để bắt đầu. Bạn có thể nghe lại nhiều lần.</p>
          )}
          <div className="listening-choices">
            {choices.map((meaning) => (
              <button
                key={meaning}
                className={
                  "outline " +
                  (answer !== null && meaning === exercise.meaning
                    ? "answer-correct"
                    : answer === meaning
                      ? "answer-wrong"
                      : "")
                }
                disabled={!played || answer !== null}
                onClick={() => choose(meaning)}
              >
                {meaning}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div className="listening-feedback" role="status">
              <strong>
                {answer === exercise.meaning
                  ? "Chính xác!"
                  : "Chưa đúng. Hãy nghe lại và chú ý từ khóa."}
              </strong>
              <p>
                <b>{exercise.word}</b> {exercise.ipa} — {exercise.meaning}
              </p>
              <div className="bilingual-listening listening-transcript-pair">
                <div lang="en"><span className="bilingual-label">English</span><p className="listening-transcript">{exercise.spokenText}</p></div>
                <div lang="vi"><span className="bilingual-label">Tiếng Việt</span><p className="listening-translation">{exercise.spokenTranslation}</p></div>
              </div>
              <button
                className="primary"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  if (index + 1 === filtered.length) setFinished(true);
                  else {
                    setIndex((i) => i + 1);
                    setAnswer(null);
                    setPlayed(false);
                  }
                }}
              >
                {index + 1 === filtered.length
                  ? "Xem kết quả"
                  : "Tình huống tiếp theo"}
              </button>
            </div>
          )}
        </div>
      )}
      <p className="note">
        Giọng đọc tổng hợp phụ thuộc trình duyệt và giọng tiếng Anh đã cài. Kết
        quả lượt nghe chỉ hiển thị trong phiên hiện tại.
      </p>
    </section>
  );
}

function App({ levels, fields, lessons, scenarios, listeningExercises, initialState }) {
  const [page, setPage] = useState("home"),
    [category, setCategory] = useState("all"),
    [lessonField, setLessonField] = useState("all"),
    [lessonLevel,setLessonLevel] = useState("all"),
    [scenarioField, setScenarioField] = useState("all"),
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
    (l.flashcards || l.phrases.map((p, i) => ({ p, phraseIndex: i }))).map(
      (card) => ({
        key: `${l.id}-${card.phraseIndex}`,
        p: card.p,
        lesson: l,
        phraseIndex: card.phraseIndex,
      }),
    ),
  );
  const speak = (t, rate = 0.82) => {
    window.dispatchEvent(new Event("ct-stop-dialogue"));
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ phát âm.");
      return;
    }
    speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(t);
    u.lang = "en-US";
    u.rate = rate;
    speechSynthesis.speak(u);
  };
  const record = () => {
    window.dispatchEvent(new Event("ct-stop-dialogue"));
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
      navigate("game");
    });
  const review = (rating) =>
    persist(async () => {
      const item = all[cardIdx];
      const result = await api("/api/state/reviews", {
        lessonId: item.lesson.id,
        phraseIndex: item.phraseIndex,
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
    ["listening", Volume2, "Luyện nghe từ vựng"],
    ["ai", MessageCircle, "Chat luyện tiếng Anh"],
    ["progress", ChartNoAxesColumn, "Tiến độ"],
  ];
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "show" : "")}>
        <div className="brand">
          <div className="brandicon">TA</div>
          <div>
            <strong>Tiếng Anh Hữu Ích</strong>
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
          <div className="avatar">TA</div>
          <div>
            <b>Học viên Tiếng Anh Hữu Ích</b>
            <small>Phiên bản {__APP_VERSION__}</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <button className="menu" onClick={() => setMobile(!mobile)}>
            {mobile ? <X /> : <Menu />}
          </button>
          <span className="breadcrumb">
            Tiếng Anh Hữu Ích <span>/</span>{" "}
            {page === "flashcards" ? "Flashcards" : nav.find((x) => x[0] === page)?.[2] || "Bài học"}
          </span>
          <span className="headright">
            <Flame size={18} color="#f69b41" /> Học mỗi ngày{" "}
            <span className="avatar tiny">TA</span>
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
                  <div className="hero-copy">
                    <span className="eyebrow">
                      ✨ {lessons.length} BÀI HỌC · 15 PHÚT/NGÀY
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
                  <div className="hero-visual">
                    <img
                      src="/illustrations/anime-conversation-hero.png"
                      alt="Hai người bạn trò chuyện vui vẻ tại quán cà phê, cùng xem bản đồ du lịch dưới ánh nắng"
                      width="1536"
                      height="1024"
                      fetchPriority="high"
                    />
                    <div className="hero-picture-label">
                      <MessageCircle size={18} />
                      <span>
                        Tự tin trò chuyện
                        <br />
                        <strong>Kết nối với thế giới</strong>
                      </span>
                    </div>
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
                      setLessonField("all");
                      navigate("lessons");
                    }}
                  >
                    <span className="path-icon">
                      <Briefcase />
                    </span>
                    <span>
                      <b>Tiếng Anh công việc</b>
                      <small>
                        Công nghệ, y tế, giáo dục, tài chính và các ngành nghề
                      </small>
                      <em>Khám phá bài học →</em>
                    </span>
                  </button>
                  <button
                    className="path travel"
                    onClick={() => {
                      setCategory("travel");
                      setLessonField("all");
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
            {page === "home" && (
              <section className="home-conversations">
                <div className="section-head">
                  <h2>Hội thoại có hình minh họa</h2>
                  <span>{scenarios.length} tình huống</span>
                </div>
                <div className="conversation-previews">
                  {[
                    scenarios[0],
                    scenarios.find((s) => s.lessonId === 205),
                    scenarios.find((s) => s.lessonId === 210),
                  ]
                    .filter(Boolean)
                    .map((s) => (
                      <button
                        key={s.id}
                        className="conversation-preview"
                        onClick={() => {
                          setScenario(s);
                          setSessionId(null);
                          setTurn(0);
                          setAnswers([]);
                          navigate("roleplay");
                        }}
                      >
                        <SceneIllustration scenario={s} />
                        <span>{s.title}</span>
                        <small>Nghe hai nhân vật giao tiếp →</small>
                      </button>
                    ))}
                </div>
              </section>
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
                    ["work", "Công việc"],
                    ["travel", "Du lịch"],
                  ].map(([c, t]) => (
                    <button
                      className={category === c ? "active" : ""}
                      onClick={() => {
                        setCategory(c);
                        setLessonField("all");
                      }}
                      key={c}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <section className="cefr-levels" aria-label="Cấp độ tiếng Anh">
                  <div className="cefr-heading"><h2>Chọn cấp độ của bạn</h2><button className={lessonLevel==='all'?'outline active':'outline'} onClick={()=>setLessonLevel('all')}>Tất cả cấp độ</button></div>
                  <div className="cefr-groups">
                    {['basic','independent','proficient'].map(group=><div className={'cefr-group '+group} key={group}>
                      <h3>{levels.find(l=>l.group===group)?.groupTitle}</h3>
                      {levels.filter(l=>l.group===group).map(level=><button key={level.code} aria-pressed={lessonLevel===level.code} className={lessonLevel===level.code?'active':''} onClick={()=>setLessonLevel(level.code)}>
                        <strong>{level.code}</strong><span>{level.title}<small>{lessons.filter(l=>l.level===level.code&&(category==='all'||l.cat===category)&&(lessonField==='all'||String(l.fieldId)===lessonField)).length} bài học</small></span>
                      </button>)}
                    </div>)}
                  </div>
                  <p className="note">Mỗi cấp độ có 35 bài, mỗi bài 20 câu. Mức học là gợi ý theo nội dung; bạn có thể chọn mức phù hợp để luyện.</p>
                  {lessonLevel!=='all'&&<p className="cefr-description">{lessonLevel} · {levels.find(l=>l.code===lessonLevel)?.description}</p>}
                </section>
                <label className="field-filter">
                  Lĩnh vực
                  <select
                    aria-label="Lĩnh vực bài học"
                    value={lessonField}
                    onChange={(e) => {
                      setLessonField(e.target.value);
                      setCategory("all");
                    }}
                  >
                    <option value="all">Tất cả lĩnh vực</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="lesson-grid">
                  {lessons
                    .filter(
                      (l) =>
                        (category === "all" || l.cat === category) &&
                        (lessonLevel === "all" || l.level === lessonLevel) &&
                        (lessonField === "all" ||
                          String(l.fieldId) === lessonField),
                    )
                    .sort((a,b)=>a.levelOrder-b.levelOrder||a.id-b.id)
                    .map((l, i) => (
                      <button
                        className="lesson-card"
                        key={l.id}
                        onClick={() => openLesson(l)}
                      >
                        <div className="lesson-card-art">
                          <SceneIllustration scenario={l} />
                        </div>
                        <div className={"lesson-icon " + l.cat}>
                          {l.cat === "work" ? <Briefcase /> : <Plane />}
                        </div>
                        <div className="lesson-text">
                          <span className="mini">
                            {l.level} · {l.fieldTitle} · BÀI {l.id} · 15 PHÚT
                          </span>
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
                {!lessons.some(l=>(lessonLevel==='all'||l.level===lessonLevel)&&(category==='all'||l.cat===category)&&(lessonField==='all'||String(l.fieldId)===lessonField))&&<div className="cefr-empty" role="status">Chưa có bài phù hợp với cấp độ và lĩnh vực đã chọn. Bạn có thể chọn cấp độ khác hoặc Tất cả cấp độ.</div>}
              </>
            )}
            {page === "lesson" && (
              <>
                <button className="back" onClick={() => navigate("lessons")}>
                  ← Quay lại danh sách
                </button>
                <div className="page-title">
                  <span className="eyebrow dark">
                    {active.level} · BÀI {active.id} · MẪU CÂU {idx + 1}/{active.phrases.length}
                  </span>
                  <h1>{active.title}</h1>
                  <p>{active.desc}</p>
                </div>
                <div className="lesson-detail">
                  <div className="lesson-detail-art"><SceneIllustration scenario={active} /></div>
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
            {page === "game" && (
              <LessonGame
                key={active.id}
                lesson={active}
                speak={speak}
                onClose={() => navigate("lessons")}
              />
            )}
            {page === "listening" && (
              <ListeningPractice exercises={listeningExercises} speak={speak} />
            )}
            {page === "roleplay" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">THỰC HÀNH GIAO TIẾP</span>
                  <h1>Hội thoại tình huống</h1>
                  <p>
                    Nghe hai nhân vật trò chuyện và luyện trả lời bằng tiếng
                    Anh.
                  </p>
                </div>
                <label className="field-filter">
                  Lĩnh vực hội thoại
                  <select
                    aria-label="Lĩnh vực hội thoại"
                    value={scenarioField}
                    onChange={(e) => {
                      const value = e.target.value;
                      setScenarioField(value);
                      if (
                        value !== "all" &&
                        String(scenario.fieldId) !== value
                      ) {
                        const next = scenarios.find(
                          (s) => String(s.fieldId) === value,
                        );
                        if (next) {
                          setScenario(next);
                          setSessionId(null);
                          setTurn(0);
                          setAnswers([]);
                          setHeard("");
                        }
                      }
                    }}
                  >
                    <option value="all">Tất cả lĩnh vực</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="scenario-picker">
                  <summary>
                    Chọn tình huống: {scenario.title} ·{" "}
                    {
                      scenarios.filter(
                        (s) =>
                          scenarioField === "all" ||
                          String(s.fieldId) === scenarioField,
                      ).length
                    }{" "}
                    hội thoại
                  </summary>
                  <div className="filters">
                    {scenarios
                      .filter(
                        (s) =>
                          scenarioField === "all" ||
                          String(s.fieldId) === scenarioField,
                      )
                      .map((s, i) => (
                        <button
                          className={scenario === s ? "active" : ""}
                          key={s.title}
                          onClick={(event) => {
                            event.currentTarget.closest("details").open = false;
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
                </details>
                <div className="scenario-context">
                  <p>
                    <strong>Vai của bạn:</strong> {scenario.userRole}
                  </p>
                  <p>{scenario.briefing}</p>
                </div>
                <Conversation key={scenario.id} scenario={scenario} />
                <details className="guided-practice">
                  <summary>Luyện trả lời từng lượt</summary>
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
                </details>
              </>
            )}
            {page === "ai" && <AIChat onFlashcards={()=>navigate("flashcards")} />}
            {page === "flashcards" && (
              <>
                <div className="page-title">
                  <span className="eyebrow dark">ÔN TẬP NGẮT QUÃNG</span>
                  <h1>Flashcards</h1>
                  <button className="outline" onClick={()=>navigate("ai")}>Quay lại chat luyện tiếng Anh</button>
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
