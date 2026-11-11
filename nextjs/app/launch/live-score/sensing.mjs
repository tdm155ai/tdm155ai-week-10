// What the camera tells the score: where people are (MediaPipe Pose Landmarker, up to four people) and how much the
// frame is moving (plain frame differencing, which works even when the pose model can't see anyone, e.g. overhead).
// This tracking code is this page's own copy; /hand-launch and /theremin keep theirs.

import { WASM_URL as WASM } from '../../../lib/cv/mediapipe.js'; // this app's MediaPipe version (1.2.2), from the CDN
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export async function createPose() {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks(WASM);
  return PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 4, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
}

// One point per person, in mirrored frame coordinates (0–1, as the preview shows them), plus shoulder width as a
// rough "how close to the camera" measure.
export function readPeople(result) {
  return (result?.landmarks ?? []).map(points => {
    const seen = [11, 12, 23, 24].map(n => points[n]).filter(p => (p.visibility ?? 1) > 0.4);
    const body = seen.length ? seen : [points[0]];
    const x = body.reduce((s, p) => s + p.x, 0) / body.length;
    const y = body.reduce((s, p) => s + p.y, 0) / body.length;
    const size = Math.hypot(points[11].x - points[12].x, points[11].y - points[12].y);
    // Wrists (15, 16) with the shoulder on the same side (11, 12), for "hand raised" and "reaching into a zone".
    const hands = [[15, 11], [16, 12]].map(([w, s]) => ({ x: 1 - points[w].x, y: points[w].y, shoulderY: points[s].y, shoulderX: 1 - points[s].x, visible: (points[w].visibility ?? 1) > 0.5 }));
    return { x: 1 - x, y, size, hands, points };
  });
}

// Frame differencing on a 64×36 copy of the frame: the share of changed pixels in each zone column, overall, and where.
export function createMotion(zones) {
  const W = 64, H = 36;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let previous = null;
  return function measure(video) {
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -W, 0, W, H); ctx.restore();
    const { data } = ctx.getImageData(0, 0, W, H);
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
    const out = { zones: new Array(zones).fill(0), total: 0, x: 0.5, y: 0.5, cells: null };
    if (previous) {
      const cells = new Uint8Array(W * H);
      let n = 0, sx = 0, sy = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (Math.abs(gray[i] - previous[i]) > 18) { cells[i] = 1; n++; sx += x; sy += y; out.zones[Math.min(zones - 1, Math.floor((x / W) * zones))]++; }
      }
      out.zones = out.zones.map(c => c / ((W / zones) * H));
      out.total = n / (W * H);
      if (n) { out.x = sx / n / W; out.y = sy / n / H; }
      out.cells = cells;
    }
    previous = gray;
    return out;
  };
}
export const MOTION_GRID = { W: 64, H: 36 };
