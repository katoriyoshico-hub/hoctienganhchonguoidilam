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
    [speed, setSpeed] = useState("0.85"),
    [mode,setMode] = useState("audio"),
    [audioStatus,setAudioStatus] = useState(null),
    [rangeStart,setRangeStart] = useState(0),
    [rangeEnd,setRangeEnd] = useState(180);
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
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/youtube/audio/status',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(setAudioStatus).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  useEffect(() => () => {request.current?.abort(); window.speechSynthesis?.cancel();}, []);
  useEffect(() => {window.speechSynthesis?.cancel();}, [view]);
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    window.speechSynthesis?.cancel();
    setResult(null);
    setView("paragraph");
    setStart(null);
    setLoading(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(mode === "audio" ? "/api/youtube/audio" : "/api/youtube/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "audio" ? {url,start:rangeStart,end:rangeEnd} : { url, language }),
        signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error(
          "Máy chủ chưa trả về phụ đề. Hãy kiểm tra ứng dụng đã cập nhật phiên bản mới.",
        );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa lấy được phụ đề.");
      setResult(data);
      if(data.range?.start>0)setStart(data.range.start);
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
        <p>Dán link YouTube, chọn đoạn clip để AI nghe và chép lời thành đoạn văn bên dưới.</p>
      </div>
      <div className="filters" aria-label="Cách chép lời video">
        <button className={mode==='audio'?'active':''} disabled={loading} onClick={()=>{setMode('audio');setError('');}}>Nghe clip và chép lời</button>
        <button className={mode==='captions'?'active':''} disabled={loading} onClick={()=>{setMode('captions');setError('');}}>Lấy phụ đề miễn phí</button>
      </div>
      {mode==='audio'&&audioStatus&&!audioStatus.configured&&<div className="ai-config-note" role="status">Chép lời từ âm thanh cần khóa Gemini. Thêm GEMINI_API_KEY vào Biến môi trường Vibehost, lưu rồi triển khai lại. Link Gemini trên Google không cung cấp quyền API cho website.</div>}
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
        {mode==='captions'&&<><label htmlFor="youtube-language">Ngôn ngữ phụ đề</label>
        <select
          id="youtube-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
        >
          <option value="en">Tiếng Anh</option>
          <option value="vi">Tiếng Việt</option>
          <option value="auto">Ngôn ngữ gốc</option>
        </select></>}
        {mode==='audio'&&<div className="youtube-audio-range">
          <label>Bắt đầu (giây)<input type="number" min="0" max="28799" step="1" required value={rangeStart} disabled={loading} onChange={e=>setRangeStart(e.target.value===''?'':Number(e.target.value))}/></label>
          <label>Kết thúc (giây)<input type="number" min="1" max="28800" step="1" required value={rangeEnd} disabled={loading} onChange={e=>setRangeEnd(e.target.value===''?'':Number(e.target.value))}/></label>
          <p className="note">Mỗi lượt tối đa 180 giây (3 phút). Chọn đoạn tiếp theo để học tiếp. Chép nguyên ngôn ngữ người nói, không tự dịch.</p>
        </div>}
        <button
          className="primary"
          disabled={loading || !url.trim() || (mode==='audio'&&audioStatus?.configured===false)}
          type="submit"
        >
          {loading ? (mode==='audio'?"Đang nghe clip và chép lời…":"Đang lấy phụ đề…") : mode==='audio'?"Nghe clip và tạo đoạn văn":"Lấy văn bản"}
        </button>
        <p className="note">{mode==='audio'?'Dùng Gemini để nghe âm thanh video công khai. Bản chép bằng AI có thể sai; hãy đối chiếu video gốc. Lượt gọi dùng quota/chi phí theo tài khoản Gemini.':'Lấy phụ đề miễn phí có sẵn của YouTube; phụ đề có thể bị YouTube giới hạn truy cập.'}</p>
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
              : result.source === "user-pasted" ? "Văn bản bạn đã dán" : result.source === "gemini-audio" ? `Chép lời từ âm thanh bằng Gemini · giây ${result.range.start}–${result.range.end}` : "Phụ đề từ video"}
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
          <h2>{result.source==='gemini-audio'?'Bản chép lời từ clip':'Bài đọc từ phụ đề'}</h2>
          {result.source==='gemini-audio'&&<p className="note">Văn bản và mốc thời gian do AI nhận dạng, có thể chưa chính xác. Nhấn Nghe từ video để đối chiếu.</p>}
          <div className="youtube-study-text">
            {(view === "paragraph" ? paragraphs : turns).map((part,i)=>(
              <article key={i} className={view === "dialogue" ? "youtube-turn" : "youtube-paragraph"}>
                {view === "dialogue" && <strong>{part.speaker}</strong>}
                <p lang={result.language}>{part.text}</p>
                {result.videoId&&part.offset!=null&&<button className="outline" onClick={()=>{setStart(part.offset);setSeekCount(n=>n+1);}}><Play size={16}/>Nghe từ video</button>}
                <button className="outline" onClick={()=>read(part.text)} aria-label={`Đọc đoạn ${i+1}`}><Volume2 size={16}/>Đọc mẫu bằng giọng máy</button>
              </article>
            ))}
          </div>
          <details className="youtube-timeline"><summary>{result.source==='gemini-audio'?'Các câu và mốc thời gian AI nhận dạng':'Phụ đề gốc và mốc thời gian'}</summary>
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
