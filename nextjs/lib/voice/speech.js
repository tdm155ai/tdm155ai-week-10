// Live speech-to-text in Chrome with the Web Speech API: no key, no install, words arrive while you're still talking
// (interim results). Chrome sends the audio to Google's recognizer, so it needs the internet. Browser-only.
//
//   const stop = startListening({ onResult: ({ index, text, final, session }) => ..., onState: (s) => ... });
//
// Each phrase you say becomes one result with an index; its text grows and changes while you speak (final: false)
// and settles once you pause (final: true). Chrome ends recognition after a silence; this restarts it automatically,
// and `session` goes up by one each time (result indexes start over).

export function speechSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startListening({ lang = "en-US", onResult, onState, onError } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { onError?.(new Error("This browser has no speech recognition: use Chrome.")); return () => {}; }
  let wanted = true;
  let session = 0;
  let rec = null;

  const begin = () => {
    rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    session += 1;
    const mine = session;
    rec.onstart = () => onState?.("listening");
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        onResult?.({ index: i, text: r[0].transcript, final: r.isFinal, confidence: r[0].confidence, session: mine, at: performance.now() });
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") wanted = false;
      onError?.(new Error(`speech: ${e.error}${e.message ? ` (${e.message})` : ""}`));
    };
    rec.onend = () => {
      if (wanted) { onState?.("restarting"); setTimeout(() => wanted && begin(), 100); }
      else onState?.("stopped");
    };
    try { rec.start(); } catch (err) { onError?.(err); }
  };

  begin();
  return () => { wanted = false; try { rec?.stop(); } catch {} };
}

// Lowercase words without punctuation (apostrophes kept): "Shall I compare thee, to a SUMMER'S day?" →
// ["shall", "i", "compare", "thee", "to", "a", "summer's", "day"].
export function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]+/gu, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

// Where a trigger phrase (one or more words) appears in a list of words: the start positions.
export function findPhrase(list, phrase) {
  const p = words(phrase);
  const hits = [];
  if (!p.length) return hits;
  for (let i = 0; i + p.length <= list.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (list[i + j] !== p[j]) { ok = false; break; }
    if (ok) hits.push(i);
  }
  return hits;
}

// Watches the result stream and calls fire(trigger, info) the first time each trigger phrase appears in each spot,
// as soon as it shows up in an interim result (fastest), never twice for the same spot, and not again within
// `cooldown` seconds (Chrome revises interim text, which can shift words around).
export function triggerWatcher(getTriggers, fire, { cooldown = 1.5 } = {}) {
  const fired = new Set();
  const lastAt = new Map();
  return ({ index, text, session, final, at }) => {
    const list = words(text);
    const hits = [];
    for (const t of getTriggers()) for (const pos of findPhrase(list, t.say)) hits.push({ t, pos });
    hits.sort((a, b) => a.pos - b.pos); // in the order they were said
    for (const { t, pos } of hits) {
      const key = `${session}:${index}:${pos}:${t.say}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const now = performance.now();
      if (now - (lastAt.get(t.say) || -1e9) < cooldown * 1000) continue;
      lastAt.set(t.say, now);
      fire(t, { text, final, heardAt: at });
    }
  };
}
