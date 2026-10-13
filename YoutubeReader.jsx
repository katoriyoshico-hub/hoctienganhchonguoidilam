import React, { useEffect, useRef, useState } from "react";
import { studyParagraphs, studyTurns, pastedCaptions } from "./youtube-study.js";
import { Play, Copy, Download, Volume2 } from "lucide-react";
export default function YoutubeReader() {
  const [url, setUrl] = useState(""),
    [language, setLanguage] = useState("en"),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [start, setStart] = useState(null),
    [seekCount, setSeekCount] = useState(0),
    [view, setView] = useState("paragraph"),
    [pasted, setPasted] = useState(""),
    [speed, setSpeed] = useState("0.85");
  const paragraphs = result ? studyParagraphs(result.segments) : [];
  const turns = result ? studyTurns(result.segments) : [];
  const exportText = view === "paragraph" ? paragraphs.map(p=>p.text).join("\n\n") : turns.map(t=>`${t.speaker}: ${t.text}`).join("\n");
  const read = (text) => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setNotice("Trình duyệt chưa hỗ trợ đọc thành tiếng. Bạn vẫn có thể nghe video gốc.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = result.language === "vi" ? "vi-VN" : "en-US";
    utterance.rate = Number(speed);
    window.speechSynthesis.speak(utterance);
  };
  const usePasted = () => {
    try {
      const segments=pastedCaptions(pasted);
      request.current?.abort();
      setLoading(false); setError(""); setNotice(""); setStart(null);
      window.speechSynthesis?.cancel();
      // This is explicitly user-supplied text, not a claimed YouTube retrieval.
      setResult({videoId:null,language:language === "vi" ? "vi" : "en",source:"user-pasted",segments,text:segments.map(s=>s.text).join("\n")});
    } catch(error) {setError(error.message);}
  };
  const request = useRef(null);
  useEffect(() => () => {request.current?.abort(); window.speechSynthesis?.cancel();}, []);
  useEffect(() => {window.speechSynthesis?.cancel();}, [view]);
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    window.speechSynthesis?.cancel();
    setResult(null);
    setStart(null);
    setLoading(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/youtube/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language }),
        signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error(
          "Máy chủ chưa trả về phụ đề. Hãy kiểm tra ứng dụng đã cập nhật phiên bản mới.",
        );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa lấy được phụ đề.");
      setResult(data);
    } catch (error) {
      if (error.name !== "AbortError") setError(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setNotice("Đã sao chép văn bản.");
    } catch {
      setNotice(
        "Trình duyệt không cho sao chép tự động. Hãy chọn văn bản và sao chép thủ công.",
      );
    }
  };
  const download = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" }),
      href = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = href;
    link.download = `youtube-${result.videoId || "bai-doc"}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return (
    <section className="youtube-reader">
      <div className="page-title">
        <span className="eyebrow dark">HỌC QUA VIDEO THẬT</span>
        <h1>YouTube → Văn bản</h1>
        <p>Dán link YouTube để tạo đoạn văn hoặc các lượt nói, nghe và luyện đọc theo.</p>
      </div>
      <form className="youtube-form" onSubmit={submit}>
        <label htmlFor="youtube-url">Link YouTube</label>
        <input
          id="youtube-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={loading}
        />
        <label htmlFor="youtube-language">Ngôn ngữ phụ đề</label>
        <select
          id="youtube-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
        >
          <option value="en">Tiếng Anh</option>
          <option value="vi">Tiếng Việt</option>
          <option value="auto">Ngôn ngữ gốc</option>
        </select>
        <button
          className="primary"
          disabled={loading || !url.trim()}
          type="submit"
        >
          {loading ? "Đang lấy phụ đề…" : "Lấy văn bản"}
        </button>
        <p className="note">Lấy phụ đề miễn phí từ video. Phụ đề tự động có thể sai; video không có phụ đề chưa hỗ trợ chuyển âm thanh thành chữ.</p>
      </form>
      {error && (
        <p className="youtube-error" role="alert">
          {error}
        </p>
      )}
      <details className="youtube-manual" open={Boolean(error)}>
        <summary>Dán bản chép lời nếu không lấy được từ link</summary>
        <p>Mở video trên YouTube → phần mô tả → Hiện bản chép lời (Show transcript), sao chép nội dung rồi dán bên dưới. Nếu video không có bản chép lời, hãy chọn video có phụ đề.</p>
        <label htmlFor="youtube-pasted">Bản chép lời / phụ đề</label>
        <textarea id="youtube-pasted" value={pasted} maxLength={100000} onChange={e=>setPasted(e.target.value)} placeholder="Dán nội dung đã sao chép từ video…" rows={8} />
        <button className="primary" disabled={!pasted.trim() || loading} onClick={usePasted}>Tạo bài đọc từ văn bản</button>
      </details>
      {result && (
        <div className="youtube-result">
          <div className="filters" aria-label="Cách trình bày bài đọc">
            <button className={view === "paragraph" ? "active" : ""} onClick={()=>setView("paragraph")}>Đoạn văn</button>
            <button className={view === "dialogue" ? "active" : ""} onClick={()=>setView("dialogue")}>Các lượt nói</button>
          </div>
          <div className="practice-actions">
            <button className="outline" onClick={copy}>
              <Copy size={17} /> Sao chép văn bản
            </button>
            <button className="outline" onClick={download}>
              <Download size={17} /> Tải file TXT
            </button>
          </div>
          {notice && <p role="status">{notice}</p>}
          <p className="note">
            {result.segments.length} đoạn · {result.language} ·{" "}
            {result.source === "youtube-auto-captions"
              ? "Phụ đề tự động, có thể có sai sót"
              : result.source === "user-pasted" ? "Văn bản bạn đã dán" : "Phụ đề từ video"}
          </p>
          {result.videoId && <iframe
            key={`${result.videoId}-${seekCount}`}
            title="Video YouTube đang học"
            src={`https://www.youtube-nocookie.com/embed/${result.videoId}${start === null ? "" : `?start=${Math.floor(start)}&autoplay=1`}`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />}
          <div className="youtube-study-controls">
            <label>Tốc độ đọc <select value={speed} onChange={e=>setSpeed(e.target.value)}><option value="0.7">Chậm</option><option value="0.85">Vừa</option><option value="1">Bình thường</option></select></label>
            <button className="outline" onClick={()=>window.speechSynthesis?.cancel()}>Dừng đọc</button>
          </div>
          <p className="note">Đọc thành tiếng dùng giọng của trình duyệt. Hãy nghe video gốc để đối chiếu cách phát âm. Tên người nói chỉ được giữ khi có trong phụ đề.</p>
          <div className="youtube-study-text">
            {(view === "paragraph" ? paragraphs : turns).map((part,i)=>(
              <article key={i} className={view === "dialogue" ? "youtube-turn" : "youtube-paragraph"}>
                {view === "dialogue" && <strong>{part.speaker}</strong>}
                <p lang={result.language}>{part.text}</p>
                <button className="outline" onClick={()=>read(part.text)} aria-label={`Đọc đoạn ${i+1}`}><Volume2 size={16}/>Nghe và đọc theo</button>
              </article>
            ))}
          </div>
          <details className="youtube-timeline"><summary>Phụ đề gốc và mốc thời gian</summary>
          <div className="transcript-segments">
            {result.segments.map((segment, i) => (
              <article key={i}>
                {result.videoId && segment.offset !== null && <button
                  className="outline"
                  aria-label={`Nghe từ giây ${Math.floor(segment.offset)}`}
                  onClick={() => {
                    setStart(segment.offset);
                    setSeekCount((n) => n + 1);
                  }}
                >
                  <Play size={14} />
                  {Math.floor(segment.offset / 60)}:
                  {String(Math.floor(segment.offset % 60)).padStart(2, "0")}
                </button>}
                <p>{segment.text}</p>
              </article>
            ))}
          </div></details>
        </div>
      )}
    </section>
  );
}
