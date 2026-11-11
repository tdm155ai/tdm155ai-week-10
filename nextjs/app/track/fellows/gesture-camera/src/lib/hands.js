// hands.js: reads MediaPipe's hand landmarks into pinches and hand shapes.
//
// MediaPipe finds 21 points on each hand: 0 is the wrist, 1–4 the thumb (4 is
// its tip), and each finger has a knuckle (MCP), a middle joint (PIP) and a tip.
// Distances are measured as a share of the hand's own size, so the same
// settings work near the camera or across the room. Adapted from Finger Sounds.

export const WRIST = 0;
export const THUMB_BASE = 2;
export const THUMB_TIP = 4;

// The four fingers the thumb can touch, in order.
export const FINGERS = [
  { id: "index", label: "Index", tip: 8, pip: 6, mcp: 5 },
  { id: "middle", label: "Middle", tip: 12, pip: 10, mcp: 9 },
  { id: "ring", label: "Ring", tip: 16, pip: 14, mcp: 13 },
  { id: "pinky", label: "Pinky", tip: 20, pip: 18, mcp: 17 },
];

// Which landmarks to join with lines when drawing a hand.
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// Once a pinch has started, it lasts until the gap opens past
// reach × RELEASE_FACTOR, so a held pinch doesn't flicker on and off.
export const RELEASE_FACTOR = 1.45;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

// The camera image's 0–1 coordinates, stretched to pixels so x and y measure the same.
function inPixels(points, frame) {
  return points.map((p) => ({ x: p.x * frame.width, y: p.y * frame.height, z: (p.z ?? 0) * frame.width }));
}

// 3D "world" landmarks (in meters) hold up when the hand turns toward or away
// from the camera; fall back to the flat picture if they're missing.
function solid(hand, frame) {
  return hand.world ?? inPixels(hand.points, frame);
}

// Reads a HandLandmarker result into [{ hand: "left" | "right", points, world }].
// MediaPipe labels hands from the person's point of view, given the camera's
// own (unmirrored) picture. `swap` flips the labels for a camera that already
// mirrors its picture. If both hands get the same label, they're sorted by
// where they are in the picture instead.
export function readHands(result, { swap = false } = {}) {
  const labels = result?.handedness ?? result?.handednesses ?? [];
  const hands = (result?.landmarks ?? []).map((points, i) => {
    let hand = labels[i]?.[0]?.categoryName === "Left" ? "left" : "right";
    if (swap) hand = hand === "left" ? "right" : "left";
    return { hand, points, world: result.worldLandmarks?.[i] ?? null };
  });
  if (hands.length === 2 && hands[0].hand === hands[1].hand) {
    // In the camera's own picture, the person's right hand is on the left side.
    const [onLeft, onRight] = hands[0].points[0].x < hands[1].points[0].x ? hands : [hands[1], hands[0]];
    onLeft.hand = swap ? "left" : "right";
    onRight.hand = swap ? "right" : "left";
  }
  return hands;
}

// How far each fingertip is from the thumb tip, as a share of the hand's size
// (wrist to the base of the middle finger). About 0.1–0.2 when touching, 1 or
// more when the hand is open.
export function fingerGaps(hand, frame) {
  const p = solid(hand, frame);
  const size = Math.max(distance(p[WRIST], p[9]), 1e-6);
  return FINGERS.map((f) => distance(p[THUMB_TIP], p[f.tip]) / size);
}

// 0 when the finger is far from the thumb, 1 when it's close enough to pinch.
export function closeness(gap, reach) {
  return Math.min(1, Math.max(0, (1 - gap) / (1 - reach)));
}

// true for each finger folded in: its tip nearer the wrist than its middle joint.
export function foldedFingers(hand, frame) {
  const p = solid(hand, frame);
  return FINGERS.map((f) => distance(p[f.tip], p[WRIST]) < distance(p[f.pip], p[WRIST]));
}

// A tight fist: every fingertip tucked in about as close to the wrist as its
// own knuckle. The thumb rests near the curled fingers in a fist, which would
// otherwise look like a pinch.
export function isFist(hand, frame) {
  const p = solid(hand, frame);
  return FINGERS.every((f) => distance(p[f.tip], p[WRIST]) < distance(p[f.mcp], p[WRIST]) * 1.15);
}

// "up" or "down" for a thumbs up or thumbs down: fingers folded, thumb
// stretched out, pointing up or down, its tip the highest or lowest point of
// the hand. null for anything else. Direction is judged on the flat picture.
export function thumbPointing(hand, frame) {
  if (!foldedFingers(hand, frame).every(Boolean)) return null;
  const px = inPixels(hand.points, frame);
  const size = Math.hypot(px[WRIST].x - px[9].x, px[WRIST].y - px[9].y);
  const tip = px[THUMB_TIP];
  const base = px[THUMB_BASE];
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.45 * size || Math.abs(dy) < 0.75 * length) return null;
  const rest = px.filter((_, i) => i !== 3 && i !== THUMB_TIP);
  const margin = 0.1 * size;
  if (dy > 0 && rest.every((q) => tip.y > q.y + margin)) return "down";
  if (dy < 0 && rest.every((q) => tip.y < q.y - margin)) return "up";
  return null;
}

// A peace sign: index and middle fingers out in a V, ring and pinky folded.
export function isPeace(hand, frame) {
  const p = solid(hand, frame);
  const fromWrist = (i) => distance(p[i], p[WRIST]);
  const [index, middle, ring, pinky] = FINGERS;
  const out = (f) => fromWrist(f.tip) > fromWrist(f.pip) * 1.1;
  const folded = (f) => fromWrist(f.tip) < fromWrist(f.pip);
  if (!out(index) || !out(middle) || !folded(ring) || !folded(pinky)) return false;
  return distance(p[index.tip], p[middle.tip]) > 0.3 * distance(p[WRIST], p[9]);
}

// The point halfway between the thumb tip and a fingertip, in the camera's 0–1 coordinates.
export function pinchPoint(hand, finger) {
  const a = hand.points[THUMB_TIP];
  const b = hand.points[FINGERS[finger].tip];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
