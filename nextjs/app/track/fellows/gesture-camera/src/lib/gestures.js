// gestures.js: turns the hands, frame by frame, into camera actions.
//
//   👍  thumbs up, held                start recording
//   👎  thumbs down, held              stop recording
//   🤏  pinch, then move up or down    brighter or darker
//   🤏🤏 pinch with both hands:
//         pull apart or push together  make yourself bigger or smaller
//         move both sideways           move yourself left or right
//   ✌️  peace sign, held               background blur on or off
//
// A pinch is the thumb tip touching the index fingertip. Either hand works
// for everything. updateGestures() is pure: it reads the hands and the state
// from the last frame, and returns events for the page to act on plus what to
// draw on the stage.

import { RELEASE_FACTOR, THUMB_TIP, FINGERS, isFist, isPeace, pinchPoint, thumbPointing } from "./hands.js";
import { LOOK_CONTROLS, clampLook } from "./look.js";

// For the page and the guide on the stage.
export const GESTURES = [
  { id: "record", icon: "👍", name: "Thumbs up, hold", does: "Start recording" },
  { id: "stop", icon: "👎", name: "Thumbs down, hold", does: "Stop recording" },
  { id: "bright", icon: "🤏", name: "Pinch, move up or down", does: "Brighter or darker" },
  { id: "size", icon: "🤏🤏", name: "Pinch both hands, pull apart", does: "Bigger or smaller" },
  { id: "move", icon: "🤏🤏", name: "Pinch both hands, move sideways", does: "Move left or right" },
  { id: "blur", icon: "✌️", name: "Peace sign, hold", does: "Background blur on or off" },
];

// How long to hold a peace sign (thumbs use the page's Hold setting).
export const PEACE_HOLD_MS = 800;

// How far one hand moves up or down, as a share of the picture's height, to
// go from darkest to brightest.
export const BRIGHTNESS_TRAVEL = 0.35;

// How far you move for each bit both hands move sideways.
export const MOVE_GAIN = 1.5;

// Smooths hand positions so sliders don't shiver (0–1, higher follows faster).
const SMOOTHING = 0.35;

const INDEX = 0; // the index finger, in FINGERS and in hand.gaps

function handState() {
  return { pinched: false, pos: null, grab: null, pose: null, poseSince: 0, poseFired: false, firedAction: null };
}

export function createGestureState() {
  return {
    hands: { left: handState(), right: handState() },
    two: null, // while both hands pinch: where they started, and the size and place you had
    waitForRelease: false, // after a two-hand grab, one hand doesn't change brightness until both let go
  };
}

function poseAction(pose, recording) {
  if (pose === "up") return recording ? null : "start";
  if (pose === "down") return recording ? "stop" : null;
  if (pose === "peace") return "blur";
  return null;
}

// hands: from readHands(), each with `gaps` from fingerGaps().
// options: { now, frame, reach, holdMs, look, mirror, recording }
// Returns { events, ui } and marks each hand's `pinched`:
//   events: [{ type: "record", on } | { type: "blur" } | { type: "look", control, value }]
//   ui: [{ kind: "slide" | "two" | "pose", … }] to draw.
export function updateGestures(state, hands, { now, frame, reach, holdMs, look, mirror = false, recording = false }) {
  const events = [];
  const ui = [];
  const screenX = (x) => (mirror ? 1 - x : x);

  // Who's pinching. A tight fist doesn't count, because the thumb rests against the curled fingers.
  for (const side of ["left", "right"]) {
    const hand = hands.find((h) => h.hand === side);
    if (!hand) {
      state.hands[side] = handState();
      continue;
    }
    const hs = state.hands[side];
    const gap = hand.gaps[INDEX];
    if (hs.pinched && gap > reach * RELEASE_FACTOR) {
      hs.pinched = false;
      hs.grab = null;
      hs.pos = null;
    }
    if (!hs.pinched && gap < reach && !isFist(hand, frame)) {
      hs.pinched = true;
      hs.grab = null;
      hs.pos = null;
    }
    hand.pinched = hs.pinched;
    hand.at = pinchPoint(hand, INDEX);
  }
  const pinched = hands.filter((h) => h.pinched);

  if (pinched.length === 2) {
    // Both hands: grab yourself. The gap between the hands sets your size, like
    // stretching a photo on a phone; where they are together sets your place.
    const [a, b] = pinched;
    const ax = screenX(a.at.x) * frame.width;
    const bx = screenX(b.at.x) * frame.width;
    const apart = Math.hypot(ax - bx, (a.at.y - b.at.y) * frame.height) / frame.width;
    const middle = (ax + bx) / 2 / frame.width;
    if (!state.two) {
      // If one hand started changing brightness before the other joined, undo that.
      for (const h of pinched) {
        const grab = state.hands[h.hand].grab;
        if (grab) events.push({ type: "look", control: "exposure", value: grab.start });
        state.hands[h.hand].grab = null;
      }
      state.two = { apart0: Math.max(apart, 0.02), middle0: middle, size0: look.size, move0: look.move, apart, middle };
    }
    const t = state.two;
    t.apart += (apart - t.apart) * SMOOTHING;
    t.middle += (middle - t.middle) * SMOOTHING;
    const size = clampLook("size", (t.size0 * t.apart) / t.apart0);
    const move = clampLook("move", t.move0 + (t.middle - t.middle0) * MOVE_GAIN);
    events.push({ type: "look", control: "size", value: size }, { type: "look", control: "move", value: move });
    state.waitForRelease = true;
    ui.push({ kind: "two", a: a.at, b: b.at, size, move });
  } else {
    state.two = null;
    if (pinched.length === 0) state.waitForRelease = false;
    if (pinched.length === 1 && !state.waitForRelease) {
      // One hand: an invisible slider. Up the picture (smaller y) is brighter.
      const h = pinched[0];
      const hs = state.hands[h.hand];
      hs.pos = hs.pos === null ? h.at.y : hs.pos + (h.at.y - hs.pos) * SMOOTHING;
      hs.grab ??= { start: look.exposure, pos: hs.pos };
      const c = LOOK_CONTROLS.exposure;
      const value = clampLook("exposure", hs.grab.start + ((hs.grab.pos - hs.pos) / BRIGHTNESS_TRAVEL) * (c.max - c.min));
      events.push({ type: "look", control: "exposure", value });
      ui.push({ kind: "slide", action: "exposure", axis: "y", at: h.at, value, share: (value - c.min) / (c.max - c.min) });
    }
  }

  // Held hand shapes, for hands that aren't pinching.
  for (const hand of hands) {
    const hs = state.hands[hand.hand];
    let pose = null;
    if (!hand.pinched) {
      const thumb = thumbPointing(hand, frame);
      pose = thumb ?? (isPeace(hand, frame) ? "peace" : null);
    }
    if (pose !== hs.pose) {
      hs.pose = pose;
      hs.poseSince = now;
      hs.poseFired = false;
      hs.firedAction = null;
    }
    if (!pose) continue;
    // Once it has fired, keep showing what it did until the hand changes shape.
    const action = hs.poseFired ? hs.firedAction : poseAction(pose, recording);
    const progress = Math.min(1, (now - hs.poseSince) / (pose === "peace" ? PEACE_HOLD_MS : holdMs));
    if (!hs.poseFired && action && progress >= 1) {
      hs.poseFired = true;
      hs.firedAction = action;
      events.push(action === "blur" ? { type: "blur" } : { type: "record", on: action === "start" });
    }
    const p = hand.points;
    const [i, m] = [p[FINGERS[0].tip], p[FINGERS[1].tip]];
    const at = pose === "peace" ? { x: (i.x + m.x) / 2, y: (i.y + m.y) / 2 } : p[THUMB_TIP];
    ui.push({ kind: "pose", pose, action, at, progress, fired: hs.poseFired });
  }

  return { events, ui };
}
