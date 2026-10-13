export class TranscriptError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function parseVideoId(value) {
  if (typeof value !== "string" || value.length > 2048)
    throw new TranscriptError(
      "INVALID_URL",
      "Vui lòng nhập link YouTube hợp lệ.",
      400,
    );
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new TranscriptError(
      "INVALID_URL",
      "Vui lòng nhập link YouTube đầy đủ.",
      400,
    );
  }
  const hosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
  ]);
  if (
    !hosts.has(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new TranscriptError(
      "INVALID_URL",
      "Chỉ hỗ trợ link từ YouTube.",
      400,
    );
  const parts = url.pathname.split("/").filter(Boolean);
  const id = url.hostname.endsWith("youtu.be")
    ? parts[0]
    : url.pathname === "/watch"
      ? url.searchParams.get("v")
      : ["shorts", "embed", "live"].includes(parts[0])
        ? parts[1]
        : null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new TranscriptError(
      "INVALID_URL",
      "Không tìm thấy mã video trong link này.",
      400,
    );
  return id;
}
export function decodeText(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return String(value)
    .replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (all, entity) => {
        if (entity[0] !== "#") return entities[entity.toLowerCase()] || all;
        const code =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : all;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}
function jsonObjectAfter(text, marker) {
  let start = text.indexOf(marker);
  if (start < 0) return null;
  start = text.indexOf("{", start + marker.length);
  if (start < 0) return null;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
export function captionTracksFromHtml(html) {
  const player =
    jsonObjectAfter(html, "ytInitialPlayerResponse =") ||
    jsonObjectAfter(html, "ytInitialPlayerResponse=");
  const captions = player?.captions || jsonObjectAfter(html, '"captions":');
  return captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
}
export function parseCaptionBody(body) {
  let items = [];
  try {
    const data = JSON.parse(body);
    items = (data.events || [])
      .filter((e) => Array.isArray(e.segs))
      .map((e) => ({
        text: e.segs.map((s) => s.utf8 || "").join(""),
        offset: Number(e.tStartMs || 0) / 1000,
        duration: Number(e.dDurationMs || 0) / 1000,
      }));
  } catch {
    items = [...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(
      (m) => ({
        text: m[2].replace(/<[^>]*>/g, ""),
        offset: Number(m[1].match(/\bstart="([^"]+)"/)?.[1] || 0),
        duration: Number(m[1].match(/\bdur="([^"]+)"/)?.[1] || 0),
      }),
    );
  }
  if (!items.length && /<timedtext\b/.test(body)) {
    items = [...body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map(m => ({
      text: m[2].replace(/<[^>]*>/g, " "),
      offset: Number(m[1].match(/\bt="([^"]+)"/)?.[1] || 0) / 1000,
      duration: Number(m[1].match(/\bd="([^"]+)"/)?.[1] || 0) / 1000,
    }));
  }
  return items
    .map((item) => ({ ...item, text: decodeText(item.text) }))
    .filter(
      (item) =>
        item.text &&
        Number.isFinite(item.offset) &&
        item.offset >= 0 &&
        Number.isFinite(item.duration) &&
        item.duration >= 0,
    );
}
async function readBounded(response) {
  if (!response.ok)
    throw new TranscriptError(
      "UPSTREAM_BLOCKED",
      "YouTube chưa cho phép lấy phụ đề từ máy chủ này. Vui lòng thử lại sau.",
      502,
    );
  let result = "",
    size = 0;
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024)
        throw new TranscriptError(
          "VIDEO_TOO_LARGE",
          "Phụ đề quá dài. Hãy thử video ngắn hơn.",
        );
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
export async function fetchYoutubeTranscript(
  videoId,
  language = "en",
  { fetchImpl = fetch } = {},
) {
  const signal = AbortSignal.timeout(20000);
  const options = {
    signal,
    redirect: "error",
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" },
  };
  try {
    const html = await readBounded(
      await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, options),
    );
    const tracks = captionTracksFromHtml(html);
    if (!tracks.length)
      throw new TranscriptError(
        "NO_CAPTIONS",
        "Video không có phụ đề truy cập được, hoặc YouTube đang giới hạn truy cập. Bạn có thể dùng video khác có phụ đề.",
      );
    const track =
      language === "auto"
        ? tracks[0]
        : tracks.find((t) => t.languageCode === language) ||
          tracks.find((t) => t.languageCode?.startsWith(language + "-"));
    if (!track)
      throw new TranscriptError(
        "LANGUAGE_UNAVAILABLE",
        "Không có phụ đề ngôn ngữ đã chọn. Hãy chọn “Ngôn ngữ gốc” hoặc video khác.",
      );
    const url = new URL(decodeText(track.baseUrl));
    if (
      url.protocol !== "https:" ||
      !["www.youtube.com", "youtube.com"].includes(url.hostname) ||
      url.pathname !== "/api/timedtext" ||
      url.username ||
      url.password ||
      url.port
    )
      throw new TranscriptError(
        "INVALID_CAPTION_SOURCE",
        "Không xác minh được nguồn phụ đề của video.",
        502,
      );
    // Some tracks return an empty JSON3 body but still provide XML captions.
    let segments = [];
    for (const format of ["json3", null, "srv3"]) {
      if (format) url.searchParams.set("fmt", format);
      else url.searchParams.delete("fmt");
      const body = await readBounded(await fetchImpl(url.href, options));
      segments = parseCaptionBody(body);
      if (segments.length) break;
    }
    if (segments.length > 5000)
      throw new TranscriptError(
        "VIDEO_TOO_LONG",
        "Video có quá nhiều đoạn phụ đề. Hãy chọn clip ngắn hơn để luyện đọc.",
      );
    if (!segments.length)
      throw new TranscriptError(
        "EMPTY_CAPTIONS",
        "YouTube trả về phụ đề trống ở các định dạng đã thử. Bạn có thể mở bản chép lời trên YouTube, sao chép và dán vào phần bên dưới để tạo bài đọc.",
      );
    return {
      videoId,
      language: track.languageCode,
      source:
        track.kind === "asr" ? "youtube-auto-captions" : "youtube-captions",
      segments,
      text: segments.map((s) => s.text).join("\n"),
    };
  } catch (error) {
    if (error instanceof TranscriptError) throw error;
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new TranscriptError(
        "TIMEOUT",
        "Lấy phụ đề quá thời gian chờ. Vui lòng thử lại.",
        504,
      );
    throw new TranscriptError(
      "NETWORK_ERROR",
      "Không kết nối được YouTube để lấy phụ đề. Vui lòng thử lại sau.",
      502,
    );
  }
}
export function registerYoutube(
  app,
  { transcriptProvider = fetchYoutubeTranscript } = {},
) {
  let active = 0;
  app.post("/api/youtube/transcript", async (req, res) => {
    try {
      const id = parseVideoId(req.body?.url),
        language = req.body?.language || "en";
      if (!["en", "vi", "auto"].includes(language))
        throw new TranscriptError(
          "INVALID_LANGUAGE",
          "Ngôn ngữ không hợp lệ.",
          400,
        );
      if (active >= 2)
        throw new TranscriptError(
          "BUSY",
          "Máy chủ đang lấy phụ đề cho lượt khác. Vui lòng thử lại sau.",
          429,
        );
      active++;
      try {
        const result = await transcriptProvider(id, language);
        res.json(result);
      } finally {
        active--;
      }
    } catch (error) {
      res.status(error instanceof TranscriptError ? error.status : 502).json({
        code: error instanceof TranscriptError ? error.code : "UNAVAILABLE",
        error:
          error instanceof TranscriptError
            ? error.message
            : "Chưa lấy được phụ đề. Vui lòng thử lại.",
      });
    }
  });
}
