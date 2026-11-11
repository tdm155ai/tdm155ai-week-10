// The trigger-word matcher behind /voice and /voice/words (lib/voice/speech.js triggerWatcher). Run from nextjs/:
//   node --test lib/voice/words.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { triggerWatcher } from "./speech.js";

const rows = [{ say: "full moon" }, { say: "blackout" }];
function setup(cooldown = 1.5) {
  const fired = [];
  const watch = triggerWatcher(() => rows, (row, info) => fired.push(`${row.say}${info.final ? "" : " (interim)"}`), { cooldown });
  return { fired, watch };
}

test("fires on an interim result, and the same spot doesn't fire again as the phrase grows or settles", () => {
  const { fired, watch } = setup();
  watch({ session: 1, index: 0, text: "and now the full", final: false });
  watch({ session: 1, index: 0, text: "and now the full moon", final: false });
  watch({ session: 1, index: 0, text: "and now the full moon rises", final: false });
  watch({ session: 1, index: 0, text: "and now the full moon rises", final: true });
  assert.deepEqual(fired, ["full moon (interim)"]);
});

test("non-hits: a word inside another word, words out of order, or only half the phrase", () => {
  const { fired, watch } = setup();
  watch({ session: 1, index: 0, text: "blackouts are rare", final: true });
  watch({ session: 1, index: 1, text: "the moon is full", final: true });
  watch({ session: 1, index: 2, text: "a full glass", final: true });
  assert.deepEqual(fired, []);
});

test("punctuation and capitals don't matter", () => {
  const { fired, watch } = setup();
  watch({ session: 1, index: 0, text: "Full Moon! Then: BLACKOUT.", final: true });
  assert.deepEqual(fired, ["full moon", "blackout"]);
});

test("re-arm: the same word again inside the cooldown is ignored; after it, it fires", async () => {
  const { fired, watch } = setup(0.2);
  watch({ session: 1, index: 0, text: "blackout", final: true });
  watch({ session: 1, index: 1, text: "blackout", final: true });
  await new Promise((r) => setTimeout(r, 250));
  watch({ session: 1, index: 2, text: "blackout", final: true });
  assert.deepEqual(fired, ["blackout", "blackout"]);
});
