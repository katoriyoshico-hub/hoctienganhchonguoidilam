import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import {
  parseVideoId,
  parseCaptionBody,
  captionTracksFromHtml,
  fetchYoutubeTranscript,
  TranscriptError,
} from "../server/youtube.js";
import { createApp } from "../server/app.js";
const id = "abcdefghijk";
const html = (tracks) =>
  `<script>var ytInitialPlayerResponse = ${JSON.stringify({ playabilityStatus: { status: "OK" }, captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } } })};</script>`;
const track = {
  languageCode: "en",
  kind: "asr",
  baseUrl: "https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en",
};
test("YouTube URL parsing supports watch, short links and Shorts and rejects other destinations", () => {
  for (const url of [
    id,
    `https://www.youtube.com/watch?v=${id}&list=123`,
    `https://youtu.be/${id}?t=3`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/embed/${id}`,
  ])
    assert.equal(parseVideoId(url), id);
  for (const url of [
    "https://youtube.com.evil.test/watch?v=" + id,
    "http://127.0.0.1/" + id,
    "javascript:alert(1)",
    "https://user:pass@youtube.com/watch?v=" + id,
    "https://youtube.com/playlist?list=abc",
    "https://youtube.com/watch?v=short",
  ])
    assert.throws(
      () => parseVideoId(url),
      (e) => e.code === "INVALID_URL",
    );
});
test("captions parse JSON3 and XML, preserve timing and decode entities", () => {
  assert.deepEqual(
    parseCaptionBody(
      JSON.stringify({
        events: [
          {
            tStartMs: 1500,
            dDurationMs: 2000,
            segs: [{ utf8: "Hello &amp; " }, { utf8: "welcome!" }],
          },
          { segs: [{ utf8: "\n" }] },
        ],
      }),
    ),
    [{ text: "Hello & welcome!", offset: 1.5, duration: 2 }],
  );
  assert.equal(
    parseCaptionBody(
      '<transcript><text start="2.5" dur="1">It&#39;s fine &amp; clear.</text></transcript>',
    )[0].text,
    "It's fine & clear.",
  );
  assert.equal(parseCaptionBody("not captions").length, 0);
  assert.equal(captionTracksFromHtml(html([track])).length, 1);
});
test("retrieval selects captions and requests a validated timedtext URL", async () => {
  const calls = [];
  const result = await fetchYoutubeTranscript(id, "en", {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        calls.length === 1
          ? html([track])
          : JSON.stringify({
              events: [
                {
                  tStartMs: 0,
                  dDurationMs: 1500,
                  segs: [{ utf8: "Good morning!" }],
                },
              ],
            }),
      );
    },
  });
  assert.equal(result.text, "Good morning!");
  assert.equal(result.source, "youtube-auto-captions");
  assert.equal(result.language, "en");
  assert.equal(calls[0].url, "https://www.youtube.com/watch?v=" + id);
  assert.equal(new URL(calls[1].url).searchParams.get("fmt"), "json3");
  assert.equal(calls[0].options.redirect, "error");
  assert.ok(calls[0].options.signal);
});
test("no captions, unavailable languages and network errors do not return invented text", async () => {
  await assert.rejects(
    fetchYoutubeTranscript(id, "en", {
      fetchImpl: async () => new Response(html([])),
    }),
    (e) => e.code === "NO_CAPTIONS",
  );
  await assert.rejects(
    fetchYoutubeTranscript(id, "vi", {
      fetchImpl: async () => new Response(html([track])),
    }),
    (e) => e.code === "LANGUAGE_UNAVAILABLE",
  );
  await assert.rejects(
    fetchYoutubeTranscript(id, "en", {
      fetchImpl: async () => {
        throw new Error("network failure");
      },
    }),
    (e) => e.code === "NETWORK_ERROR",
  );
  const unsafe = { ...track, baseUrl: "http://127.0.0.1/private" };
  let count = 0;
  await assert.rejects(
    fetchYoutubeTranscript(id, "en", {
      fetchImpl: async () => {
        count++;
        return new Response(html([unsafe]));
      },
    }),
    (e) => e.code === "INVALID_CAPTION_SOURCE",
  );
  assert.equal(count, 1);
});
test("transcript endpoint validates before contacting provider and returns clear failure status", async () => {
  let calls = 0;
  const server = createApp(
    {},
    {
      transcriptProvider: async () => {
        calls++;
        throw new TranscriptError("NO_CAPTIONS", "Video không có phụ đề.");
      },
    },
  ).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) =>
    fetch(base + "/api/youtube/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post({ url: "https://example.com" })).status, 400);
    assert.equal(calls, 0);
    const response = await post({
      url: `https://youtu.be/${id}`,
      language: "en",
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "NO_CAPTIONS");
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
