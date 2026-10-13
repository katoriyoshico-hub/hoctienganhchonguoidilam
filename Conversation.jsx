import React, { useEffect, useRef, useState } from "react";
import { Volume2, Square, Play } from "lucide-react";

const panels = {
  office: [0, 0],
  phone: [50, 0],
  airport: [100, 0],
  online: [0, 100],
  fitting: [50, 100],
  packing: [100, 100],
  retail: [0, 0],
  city: [50, 0],
  museum: [100, 0],
  souvenir: [0, 100],
  hotel: [50, 100],
  restaurant: [100, 100],
  wall: [0, 0],
  falls: [50, 0],
  park: [100, 0],
  barcelona: [0, 100],
  temple: [50, 100],
  rome: [100, 100],
};
const extras = new Set([
  "office",
  "phone",
  "airport",
  "online",
  "fitting",
  "packing",
]);
const landmarks = new Set([
  "wall",
  "falls",
  "park",
  "barcelona",
  "temple",
  "rome",
]);
export default function Conversation({ scenario }) {
  const [voices, setVoices] = useState([]);
  const [partnerVoice, setPartnerVoice] = useState("");
  const [learnerVoice, setLearnerVoice] = useState("");
  const [rate, setRate] = useState(0.82);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(null);
  const [translations, setTranslations] = useState(true);
  const [error, setError] = useState("");
  const token = useRef(0);
  const pending = useRef(null);
  const speech =
    typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const voiceKey = (v) => v.voiceURI || `${v.name}:${v.lang}`;
  const dialogue = scenario.dialogue || [];
  useEffect(() => {
    if (!speech) return;
    const update = () => {
      const available = (speech.getVoices?.() || []).filter((v) =>
        /^en(?:[-_]|$)/i.test(v.lang),
      );
      setVoices(available);
      setPartnerVoice(
        (current) => current || (available[0] ? voiceKey(available[0]) : ""),
      );
      setLearnerVoice(
        (current) =>
          current ||
          (available[1]
            ? voiceKey(available[1])
            : available[0]
              ? voiceKey(available[0])
              : ""),
      );
    };
    const cancelPlayback = () => {
      token.current++;
      clearTimeout(pending.current);
      speech.cancel();
      setPlaying(false);
      setActive(null);
    };
    window.addEventListener("ct-stop-dialogue", cancelPlayback);
    update();
    speech.addEventListener?.("voiceschanged", update);
    return () => {
      token.current++;
      clearTimeout(pending.current);
      speech.cancel();
      speech.removeEventListener?.("voiceschanged", update);
      window.removeEventListener("ct-stop-dialogue", cancelPlayback);
    };
  }, [speech]);
  const stop = () => {
    token.current++;
    clearTimeout(pending.current);
    speech?.cancel();
    setPlaying(false);
    setActive(null);
  };
  const play = (indices) => {
    stop();
    setError("");
    if (!speech || typeof window.SpeechSynthesisUtterance !== "function") {
      setError(
        "Trình duyệt chưa hỗ trợ đọc hội thoại. Hãy thử Chrome, Edge hoặc Safari.",
      );
      return;
    }
    const run = token.current;
    setPlaying(true);
    const next = (offset) => {
      if (run !== token.current) return;
      if (offset >= indices.length) {
        setPlaying(false);
        setActive(null);
        return;
      }
      const index = indices[offset],
        line = dialogue[index];
      const utterance = new window.SpeechSynthesisUtterance(line.english);
      const key = line.speaker === "partner" ? partnerVoice : learnerVoice;
      const voice = voices.find((v) => voiceKey(v) === key);
      utterance.lang = voice?.lang || "en-US";
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = line.speaker === "partner" ? 1 : 1.12;
      utterance.onstart = () => {
        if (run === token.current) setActive(index);
      };
      utterance.onend = () => {
        if (run === token.current)
          pending.current = setTimeout(() => next(offset + 1), 150);
      };
      utterance.onerror = () => {
        if (run !== token.current) return;
        setError(
          "Không phát được giọng đọc. Hãy chọn giọng khác hoặc thử lại.",
        );
        stop();
      };
      setActive(index);
      try {
        speech.speak(utterance);
      } catch {
        setError("Không phát được giọng đọc. Vui lòng thử lại.");
        stop();
      }
    };
    next(0);
  };
  if (!dialogue.length) return <p>Hội thoại mẫu chưa sẵn sàng.</p>;
  return (
    <section
      className="conversation-player"
      aria-label="Hội thoại hai nhân vật"
    >
      <SceneIllustration scenario={scenario} />
      <div className="conversation-content">
        <div className="character-heading">
          <div>
            <span className="character-avatar partner">
              {scenario.partnerName?.[0]}
            </span>
            <strong>{scenario.partnerName}</strong>
            <small>{scenario.role}</small>
          </div>
          <span aria-hidden="true">↔</span>
          <div>
            <span className="character-avatar learner">
              {scenario.learnerName?.[0]}
            </span>
            <strong>{scenario.learnerName}</strong>
            <small>{scenario.userRole}</small>
          </div>
        </div>
        <div className="conversation-controls">
          <button
            className="primary"
            disabled={playing}
            onClick={() => play(dialogue.map((_, i) => i))}
          >
            <Play size={17} /> Nghe toàn bộ hội thoại
          </button>
          <button className="outline" disabled={!playing} onClick={stop}>
            <Square size={16} /> Dừng phát
          </button>
          <label>
            Tốc độ{" "}
            <select
              aria-label="Tốc độ hội thoại"
              value={rate}
              disabled={playing}
              onChange={(e) => setRate(Number(e.target.value))}
            >
              <option value={0.65}>Chậm</option>
              <option value={0.82}>Vừa</option>
              <option value={1}>Tự nhiên</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={translations}
              onChange={(e) => setTranslations(e.target.checked)}
            />{" "}
            Hiện bản dịch
          </label>
        </div>
        {voices.length > 0 && (
          <div className="voice-settings">
            {[
              [scenario.partnerName, partnerVoice, setPartnerVoice],
              [scenario.learnerName, learnerVoice, setLearnerVoice],
            ].map(([name, value, setValue]) => (
              <label key={name}>
                Giọng {name}
                <select
                  aria-label={`Giọng ${name}`}
                  value={value}
                  disabled={playing}
                  onChange={(e) => setValue(e.target.value)}
                >
                  {voices.map((v) => (
                    <option key={voiceKey(v)} value={voiceKey(v)}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="sample-dialogue">
          {dialogue.map((line, i) => (
            <article
              key={line.position}
              className={`dialogue-line ${line.speaker} ${active === i ? "speaking" : ""}`}
              aria-current={active === i ? "true" : undefined}
            >
              <strong>
                {line.speaker === "partner"
                  ? scenario.partnerName
                  : scenario.learnerName}
              </strong>
              <p>{line.english}</p>
              {translations && (
                <p className="dialogue-translation">{line.vietnamese}</p>
              )}
              <button
                className="outline"
                onClick={() => play([i])}
                aria-label={`Nghe lượt ${i + 1}`}
              >
                <Volume2 size={16} /> Nghe lượt
              </button>
            </article>
          ))}
        </div>
        <p className="note">
          Giọng đọc tổng hợp; có thể chọn hai giọng khi trình duyệt cung cấp.
          Hình minh họa theo bối cảnh, không phải ảnh thực địa.
        </p>
      </div>
    </section>
  );
}

export function SceneIllustration({ scenario }) {
  const key = scenario.illustrationKey || "retail",
    position = panels[key] || panels.retail;
  const sheet = extras.has(key)
    ? "additional-scenes.png"
    : landmarks.has(key)
      ? "landmark-scenes.png"
      : "conversation-scenes.png";
  return (
    <div
      className="conversation-illustration"
      role="img"
      aria-label={
        scenario.illustrationAlt || scenario.briefing || scenario.title
      }
      style={{
        backgroundImage: `url(/illustrations/${sheet})`,
        backgroundPosition: `${position[0]}% ${position[1]}%`,
      }}
    />
  );
}
