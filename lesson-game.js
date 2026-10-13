const stopWords = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "am",
  "are",
  "i",
  "you",
  "we",
  "it",
  "and",
  "or",
  "my",
  "your",
  "me",
  "for",
  "do",
  "can",
  "could",
  "would",
  "please",
]);
export function normalizeAnswer(text) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\byou're\b/g, "you are")
    .replace(/\bwe're\b/g, "we are")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bi'll\b/g, "i will")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bcan not\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bdoesn't\b/g, "does not")
    .replace(/\bdidn't\b/g, "did not")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function shuffle(items, seed) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeLessonQuestions(lesson, round = 0) {
  const phrases = shuffle(lesson.phrases, lesson.id * 7919 + round * 101);
  return phrases.slice(0, 5).map((phrase, index) => {
    const [english, meaning] = phrase;
    if (index % 2 === 1)
      return {
        type: "rewrite",
        english,
        meaning,
        answer: english,
        words: shuffle(
          english.match(/\p{L}+(?:['’]\p{L}+)?|\d+(?:[/:.]\d+)*/gu) || [],
          lesson.id + index + round,
        ),
      };
    const words = [
      ...english.matchAll(/\p{L}+(?:['’]\p{L}+)?|\d+(?:[/:.]\d+)*/gu),
    ];
    const candidates = words.filter(
      (w) => w[0].length >= 4 && !stopWords.has(w[0].toLowerCase()),
    );
    const word = (candidates.length ? candidates : words)[
      (lesson.id + index + round) % (candidates.length || words.length)
    ];
    return {
      type: "blank",
      english,
      meaning,
      answer: word[0],
      masked:
        english.slice(0, word.index) +
        "______" +
        english.slice(word.index + word[0].length),
    };
  });
}
