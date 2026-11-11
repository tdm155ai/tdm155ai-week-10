import test from "node:test";
import assert from "node:assert/strict";
import { defaults, midiMessages, stepGate, validMappings } from "./gestures.mjs";

test("hold once; tolerate flicker; sustained release rearms", () => {
  let gate, fired = [];
  for (const [now, matches] of [[0,true],[100,true],[250,true],[500,true],[600,false],[650,true],[1000,true],[1100,false],[1400,false],[1500,true],[1750,true]]) {
    const result = stepGate(gate, matches, now, 250, 300);
    gate = result.gate;
    if (result.fire) fired.push(now);
  }
  assert.deepEqual(fired, [250, 1750]);
});
test("short or low-confidence candidates never satisfy the hold", () => {
  let gate;
  for (const [now, matches] of [[0,true],[100,false],[200,true],[300,true],[350,false]]) {
    const result = stepGate(gate, matches, now, 250, 300);
    gate = result.gate;
    assert.equal(result.fire, false);
  }
});
test("MIDI uses one-based channels, sends note-off and clamps data bytes", () => {
  assert.deepEqual(midiMessages({ action: "note", channel: 16, number: 60, value: 96, duration: 300 }, 100), [{ bytes: [159,60,96], at: 100 }, { bytes: [143,60,0], at: 400 }]);
  assert.deepEqual(midiMessages({ action: "cc", channel: -10, number: 999, value: -1 }), [{ bytes: [176,127,0], at: 0 }]);
});
test("stored mappings reject unknown actions and duplicate ids", () => {
  assert.equal(validMappings(defaults()), true);
  assert.equal(validMappings([{ ...defaults()[0], action: "bad" }]), false);
  assert.equal(validMappings([defaults()[0], defaults()[0]]), false);
});
