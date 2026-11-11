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

// From script position `from` (the next word expected), walk the heard words and return the new position.
// window: how far ahead a heard word may jump (skipped words). Short words can only match close by.
export function align(list, from, heard, { window = 6, threshold = 0.72 } = {}) {
  let pos = from;
  for (const raw of heard) {
    const h = raw.replace(/'/g, "");
    const reach = h.length <= 3 ? 2 : window;
    let best = -1, bestScore = 0;
    for (let j = pos; j < Math.min(list.length, pos + reach); j++) {
      const s = similar(h, list[j].norm) - (j - pos) * 0.02; // prefer the nearest
      if (s > bestScore) { bestScore = s; best = j; }
    }
    if (best >= 0 && bestScore >= threshold) pos = best + 1;
  }
  return pos;
}
