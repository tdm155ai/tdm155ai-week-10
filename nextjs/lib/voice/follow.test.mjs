// Run: node --test lib/voice/follow.test.mjs (from nextjs/). Script following (lib/voice/follow.js): the reader's place survives misheard words, a skipped word, a dropped
// stretch, and a skipped line, and a jump reports which words (and so which cues) were skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { follow, parseScript } from "./follow.js";
import { words } from "./speech.js";
import { text } from "./script.js";

const { list } = parseScript(text);
const at = (word, after = 0) => list.findIndex((w, i) => i >= after && w.norm === word);
const run = (from, said) => follow(list, from, words(said));

test("reads straight through, with mishearings", () => {
  const { pos, jumps } = run(0, "shall i compare the to a summers day thou art more lovely and more temperate rough wins do shake");
  assert.equal(pos, at("shake") + 1);
  assert.equal(jumps.length, 0);
});

test("a missed word or two is absorbed without a jump", () => {
  const { pos, jumps } = run(0, "shall i compare thee to a day thou art lovely and more temperate");
  assert.equal(pos, at("temperate") + 1);
  assert.equal(jumps.length, 0);
});

test("a dropped stretch (more than the step window) re-anchors on a later phrase", () => {
  // Line 3 heard only as far as "rough winds", then the recognizer loses ~10 words and picks up at "hath all too short".
  const start = at("rough");
  const { pos, jumps } = run(start, "rough winds hath all too short a date");
  assert.equal(pos, at("date") + 1);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].from, at("winds") + 1);
  assert.equal(jumps[0].to, at("hath"));
});

test("a whole skipped line re-anchors, and the skipped cue is reported as skipped", () => {
  // From the start of line 5 ("Sometime too hot the eye of heaven [[sun]] shines"), the reader skips to line 6.
  const start = at("sometime");
  const { pos, jumps } = run(start, "and often is his gold complexion dimmd");
  assert.equal(pos, at("dimmd") + 1);
  assert.equal(jumps.length, 1);
  const heaven = list[at("heaven")];
  assert.ok(heaven.cues?.includes("sun"));
  assert.ok(heaven.index >= jumps[0].from && heaven.index < jumps[0].to, "the sun cue sits in the skipped stretch");
});

test("a later, larger phrase several lines ahead (within the lookahead) re-anchors", () => {
  const { pos, jumps } = run(0, "shall i compare thee but thy eternal summer shall not fade");
  assert.equal(pos, at("fade") + 1);
  assert.equal(jumps.length, 1);
});

test("short function-word runs never cause a jump", () => {
  const start = at("rough");
  const { pos, jumps } = run(start, "and in the and of the");
  assert.equal(jumps.length, 0);
  assert.ok(pos <= start + 2);
});

test("nothing beyond the lookahead is reached", () => {
  // The last line is more than 60 words past the start: no jump from the top.
  const { jumps } = run(0, "so long lives this and this gives life to thee");
  assert.equal(jumps.length, 0);
});
