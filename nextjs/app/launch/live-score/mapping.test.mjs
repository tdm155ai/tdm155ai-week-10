import test from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchTracker, launchScore, stickyZone } from './mapping.mjs';

const person = (x, hands = []) => ({ x, y: 0.5, size: 0.2, hands });
const hand = (x, up) => ({ x, y: up ? 0.2 : 0.6, shoulderY: 0.35, visible: true });

test('entering a zone fires its stinger once and makes it the loudest', () => {
  const step = createLaunchTracker();
  let r = step([person(0.5)], 0);
  assert.deepEqual(r.events.map(e => [e.zone, e.why]), [[2, 'enter']]);
  r = step([person(0.51)], 0.1);
  assert.equal(r.events.length, 0);
  r = step([person(0.75)], 1);
  assert.deepEqual(r.events.map(e => [e.zone, e.why]), [[3, 'enter']]);
  const out = launchScore({ room: r, people: [person(0.75)] });
  assert.equal(out.levels.indexOf(Math.max(...out.levels)), 3);
  assert.deepEqual(out.levels, [0, 0, 0, 0.9, 0]);
});

test('standing on a line does not flicker between zones', () => {
  const step = createLaunchTracker();
  step([person(0.39)], 0);
  let fired = 0;
  for (let i = 1; i < 40; i++) fired += step([person(0.4 + (i % 2 ? 0.02 : -0.02))], i * 0.05).events.length;
  assert.equal(fired, 0);
  assert.equal(stickyZone(0.45, 1, 5), 2);
});

test('a raised hand fires once and re-arms only after it drops; reaching sounds the next zone; both up swells', () => {
  const step = createLaunchTracker();
  step([person(0.5, [hand(0.5, false), hand(0.5, false)])], 0);
  let r = step([person(0.5, [hand(0.5, true), hand(0.5, false)])], 1);
  assert.deepEqual(r.events.map(e => [e.zone, e.why]), [[2, 'hand']]);
  r = step([person(0.5, [hand(0.5, true), hand(0.5, false)])], 1.5);
  assert.equal(r.events.length, 0);
  step([person(0.5, [hand(0.5, false), hand(0.5, false)])], 2);
  r = step([person(0.5, [hand(0.5, true), hand(0.5, false)])], 2.5);
  assert.equal(r.events.length, 1);
  r = step([person(0.5, [hand(0.5, false), hand(0.7, false)])], 3);
  assert.deepEqual(r.events.map(e => [e.zone, e.why]), [[3, 'reach']]);
  assert.deepEqual(r.occupied, [0, 0, 1, 0.7, 0]);
  r = step([person(0.5, [hand(0.45, true), hand(0.55, true)])], 4);
  assert.equal(r.swell, 1);
});
