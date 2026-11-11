// Script following: where in a known text is the reader now? The recognizer mishears words, skips them, or adds
// some; this keeps the place by matching each heard word to the next few words of the script, fuzzily (so "thee"
// for "the" or "summers" for "summer's" still count), and ignores words it can't place.

import { words } from "./speech.js";

// "...day? [[title]]\nThou art..." → { lines: [[{ text, norm, index, cue? }...]...], list: [every word, in order] }
export function parseScript(source) {
  const lines = [];
  const list = [];
  for (const raw of String(source || "").split(/\r?\n/)) {
    const line = [];
    const tokens = raw.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const marker = token.match(/^\[\[([^\]]+)\]\]([^\s]*)$/);
      if (marker) {
        const last = line[line.length - 1] || list[list.length - 1];
        if (last) last.cues = [...(last.cues || []), marker[1].trim()];
        continue;
      }
      const [w] = words(token);
      if (!w) { if (line.length) line[line.length - 1].text += ` ${token}`; continue; }
      const word = { text: token, norm: w.replace(/'/g, ""), index: list.length };
      line.push(word);
      list.push(word);
    }
    if (line.length) lines.push(line);
  }
  return { lines, list };
}

function distance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// 0–1: how alike two words are (1 = the same).
export function similar(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

// From script position `from` (the next word expected), walk the heard words and return where the reader is now.
//
// Two ways to move forward:
// 1. Step: a heard word matches one of the next few script words (`window`; short words only very close by).
//    Misheard words and a word or two skipped are absorbed here.
// 2. Re-anchor: when the step fails (the reader skipped more, or the recognizer dropped a stretch), look further
//    ahead, up to `lookahead` words, for the last 3–4 heard words in a row matching script words in a row. The
//    nearest such run wins, and the place jumps to the end of it. A run of short words ("and in the") isn't enough:
//    it has to contain real content (at least `minChars` letters and two words of 4+ letters), so "of the" can't
//    send the place flying.
//
// Returns { pos, jumps }: each jump is { from, to, end }: words from..to-1 were skipped (their cues should not
// fire), words to..end-1 are the run that was recognized.
export function follow(list, from, heard, { window = 6, threshold = 0.72, lookahead = 60, minChars = 10 } = {}) {
  let pos = from;
  const jumps = [];
  const norm = heard.map((w) => w.replace(/'/g, ""));
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    const reach = h.length <= 3 ? 2 : window;
    let best = -1, bestScore = 0;
    for (let j = pos; j < Math.min(list.length, pos + reach); j++) {
      const s = similar(h, list[j].norm) - (j - pos) * 0.02; // prefer the nearest
      if (s > bestScore) { bestScore = s; best = j; }
    }
    if (best >= 0 && bestScore >= threshold) { pos = best + 1; continue; }
    const anchor = reanchor(list, pos, norm.slice(Math.max(0, i - 3), i + 1), { threshold, lookahead, minChars });
    if (anchor) { jumps.push({ from: pos, to: anchor.start, end: anchor.end }); pos = anchor.end; }
  }
  return { pos, jumps };
}

// The nearest place in list[pos .. pos+lookahead) where the tail of `recent` (3 or 4 words, ending with the newest)
// matches consecutive script words, or null.
function reanchor(list, pos, recent, { threshold, lookahead, minChars }) {
  for (const k of [4, 3]) {
    if (recent.length < k) continue;
    const run = recent.slice(-k);
    const need = k === 4 ? 3 : 3; // 3 of 4, or 3 of 3
    for (let j = pos; j + k <= Math.min(list.length, pos + lookahead); j++) {
      let hits = 0, chars = 0, long = 0;
      for (let m = 0; m < k; m++) {
        if (similar(run[m], list[j + m].norm) >= threshold) { hits++; chars += list[j + m].norm.length; if (list[j + m].norm.length >= 4) long++; }
      }
      const lastOk = similar(run[k - 1], list[j + k - 1].norm) >= threshold;
      if (hits >= need && lastOk && chars >= minChars && long >= 2) return { start: j, end: j + k };
    }
  }
  return null;
}

// The old interface: just the new position.
export function align(list, from, heard, options) {
  return follow(list, from, heard, options).pos;
}
