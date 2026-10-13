import React, { useEffect, useRef, useState } from "react";
import { Play, Copy, Download } from "lucide-react";
export default function YoutubeReader() {
  const [url, setUrl] = useState(""),
    [language, setLanguage] = useState("en"),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [start, setStart] = useState(null),
    [seekCount, setSeekCount] = useState(0);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
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
      await navigator.clipboard.writeText(result.text);
      setNotice("Đã sao chép văn bản.");
    } catch {
      setNotice(
        "Trình duyệt không cho sao chép tự động. Hãy chọn văn bản và sao chép thủ công.",
      );
    }
  };
  const download = () => {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" }),
      href = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = href;
    link.download = `youtube-${result.videoId}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return (
    <section className="youtube-reader">
      <div className="page-title">
        <span className="eyebrow dark">HỌC QUA VIDEO THẬT</span>
        <h1>YouTube → Văn bản</h1>
        <p>Dán link video để đọc phụ đề cùng mốc thời gian và luyện nghe.</p>
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
        <p className="note">
          Dùng phụ đề có sẵn hoặc phụ đề tự động của YouTube; chưa tự nhận dạng
          âm thanh cho clip không có phụ đề. Không tự dịch sang ngôn ngữ khác.
        </p>
      </form>
      {error && (
        <p className="youtube-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="youtube-result">
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
              : "Phụ đề từ video"}
          </p>
          <iframe
            key={`${result.videoId}-${seekCount}`}
            title="Video YouTube đang học"
            src={`https://www.youtube-nocookie.com/embed/${result.videoId}${start === null ? "" : `?start=${Math.floor(start)}&autoplay=1`}`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="transcript-segments">
            {result.segments.map((segment, i) => (
              <article key={i}>
                <button
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
                </button>
                <p>{segment.text}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
