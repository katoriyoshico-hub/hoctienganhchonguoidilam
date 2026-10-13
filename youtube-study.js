// Format actual captions; never invent dialogue or speaker identities.
export function studyParagraphs(segments) {
  const paragraphs = [];
  let current = [];
  for (const segment of segments) {
    const previous = current.at(-1);
    const long = current.map(s => s.text).join(' ').length >= 450;
    const gap = previous && segment.offset != null && previous.offset != null && segment.offset - previous.offset - (previous.duration || 0) > 7;
    if (current.length && (gap || long)) {
      paragraphs.push({text: current.map(s => s.text).join(' '), offset: current[0].offset});
      current = [];
    }
    current.push(segment);
  }
  if (current.length) paragraphs.push({text: current.map(s => s.text).join(' '), offset: current[0].offset});
  return paragraphs;
}
export function studyTurns(segments) {
  return segments.map((segment, i) => {
    const named = /^([\p{L}][\p{L}\p{N} .'-]{0,35}):\s+(.+)$/u.exec(segment.text);
    return {...segment, speaker: named ? named[1] : `Đoạn nói ${i+1}`, text: named ? named[2] : segment.text, identified: Boolean(named)};
  });
}
export function pastedCaptions(text) {
  if (text.length > 100000) throw new Error('Văn bản quá dài. Vui lòng dán tối đa 100.000 ký tự.');
  const lines = text.split(/\r?\n/).map(l=>l.trim());
  const segments = [];
  let offset = null;
  for (const line of lines) {
    if (!line || line === 'WEBVTT' || /^\d+$/.test(line)) continue;
    const stamp = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?(?:\s+-->.*)?$/.exec(line);
    if (stamp) { offset=Number(stamp[1]||0)*3600+Number(stamp[2])*60+Number(stamp[3]); continue; }
    segments.push({text:line,offset,duration:0});
    offset=null;
  }
  if (!segments.length) throw new Error('Vui lòng dán nội dung bản chép lời.');
  return segments;
}
