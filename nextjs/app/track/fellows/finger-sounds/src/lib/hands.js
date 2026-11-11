// hands.js: turns MediaPipe's hand landmarks into pinches.
//
// MediaPipe finds 21 points on each hand (0 is the wrist, 4 the thumb tip,
// 8/12/16/20 the four fingertips). A "pinch" is the thumb tip coming close to a
// fingertip. Distances are measured as a share of the hand's own size, so the
// same setting works near the camera or across the room, for big or small hands.

export const THUMB_TIP = 4;

// The four fingers the thumb can touch, in order. `color` is used for the
// finger's dot on the stage and its pads below.
export const FINGERS = [
  { id: "index", label: "Index", tip: 8, color: "#ffb000" },
  { id: "middle", label: "Middle", tip: 12, color: "#2ad1c9" },
  { id: "ring", label: "Ring", tip: 16, color: "#ff5c9e" },
  { id: "pinky", label: "Pinky", tip: 20, color: "#93e04a" },
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

// true: measure with MediaPipe's 3D "world" landmarks (in meters), which hold
// up when the hand turns toward or away from the camera. false: measure on the
// flat camera image instead.
export const USE_WORLD_LANDMARKS = true;

// Once a pinch has played, the same finger can't play again until the gap
// opens past reach × RELEASE_FACTOR. This stops one pinch from stuttering.
export const RELEASE_FACTOR = 1.45;

// The shortest time between two hits from the same hand, in milliseconds.
export const MIN_MS_BETWEEN_HITS = 80;

function distance(a, b, sx, sy, sz) {
  return Math.hypot((a.x - b.x) * sx, (a.y - b.y) * sy, (a.z - b.z) * sz);
}

// Reads a HandLandmarker result into [{ hand: "left" | "right", points, world }].
//
// MediaPipe labels each hand Left or Right from the person's point of view,
// given the camera's own (unmirrored) image. `swap` flips the labels for a
// camera that already mirrors its picture. If both hands get the same label,
// they're sorted by where they are in the picture instead.
export function readHands(result, { swap = false } = {}) {
  const labels = result?.handedness ?? result?.handednesses ?? [];
  const hands = (result?.landmarks ?? []).map((points, i) => {
    const name = labels[i]?.[0]?.categoryName;
    let hand = name === "Left" ? "left" : "right";
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
// more when the hand is open. `frame` is the video's pixel size, needed only
// when measuring on the flat image.
export function fingerGaps(hand, frame = { width: 1, height: 1 }) {
  const useWorld = USE_WORLD_LANDMARKS && hand.world;
  const p = useWorld ? hand.world : hand.points;
  const [sx, sy, sz] = useWorld ? [1, 1, 1] : [frame.width, frame.height, frame.width];
  const size = Math.max(distance(p[0], p[9], sx, sy, sz), 1e-6);
  return FINGERS.map((f) => distance(p[THUMB_TIP], p[f.tip], sx, sy, sz) / size);
}

// 0 when the finger is far from the thumb, 1 when it's close enough to play.
export function closeness(gap, reach) {
  const far = 1;
  return Math.min(1, Math.max(0, (far - gap) / (far - reach)));
}

export function createPinchState() {
  return { finger: null, lastHitAt: -Infinity };
}

// Call once per video frame for one hand. Returns the finger index (0–3) that
// just pinched, or null. The closest finger wins, so a middle-finger pinch
// doesn't also play the index finger next to it.
export function updatePinch(state, gaps, now, reach) {
  if (state.finger !== null) {
    if (gaps[state.finger] > reach * RELEASE_FACTOR) state.finger = null;
    else return null;
  }
  let closest = 0;
  for (let i = 1; i < gaps.length; i++) if (gaps[i] < gaps[closest]) closest = i;
  if (gaps[closest] < reach && now - state.lastHitAt >= MIN_MS_BETWEEN_HITS) {
    state.finger = closest;
    state.lastHitAt = now;
    return closest;
  }
  return null;
}
