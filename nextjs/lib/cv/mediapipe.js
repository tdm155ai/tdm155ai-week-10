"use client";

// MediaPipe Tasks for the web (@mediapipe/tasks-vision): one loader for the four models /track uses.
// The WebAssembly runtime and the model files come from the official CDNs (jsDelivr for the runtime, Google's
// model bucket for the .task files), so nothing large is in the repo. Docs: https://ai.google.dev/edge/mediapipe/solutions/guide
// The library is imported only when a model is first asked for, so pages that don't track never load it.

export const VISION_VERSION = "1.2.2"; // keep in step with package.json
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;

const BUCKET = "https://storage.googleapis.com/mediapipe-models";
export const MODELS = {
  hand: { file: `${BUCKET}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, label: "Hand landmarker (21 points per hand)" },
  gesture: { file: `${BUCKET}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`, label: "Gesture recognizer (7 gestures + hand points)" },
  face: { file: `${BUCKET}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, label: "Face landmarker (478 points + 52 expressions)" },
  pose: { file: `${BUCKET}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, label: "Pose landmarker, lite (33 body points)" },
  people: { file: `${BUCKET}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`, label: "Pose landmarker, lite (up to 4 people)" },
};

let filesetPromise = null;
const cache = new Map();

// MediaPipe prints some INFO lines through console.error ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU"),
// which Next's dev overlay shows as a red "Issue". Drop just those lines (the fellows' apps do the same).
function quietInfoLines() {
  if (console.error.__quietInfo) return;
  const original = console.error.bind(console);
  const quiet = (...args) => { if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return; original(...args); };
  quiet.__quietInfo = true;
  console.error = quiet;
}

async function build(kind, delegate) {
  quietInfoLines();
  const vision = await import("@mediapipe/tasks-vision");
  filesetPromise ??= vision.FilesetResolver.forVisionTasks(WASM_URL);
  const fileset = await filesetPromise;
  const baseOptions = { modelAssetPath: MODELS[kind].file, delegate };
  const runningMode = "VIDEO";
  if (kind === "hand") return vision.HandLandmarker.createFromOptions(fileset, { baseOptions, runningMode, numHands: 2 });
  if (kind === "gesture") return vision.GestureRecognizer.createFromOptions(fileset, { baseOptions, runningMode, numHands: 2 });
  if (kind === "face") return vision.FaceLandmarker.createFromOptions(fileset, { baseOptions, runningMode, numFaces: 1, outputFaceBlendshapes: true });
  if (kind === "pose") return vision.PoseLandmarker.createFromOptions(fileset, { baseOptions, runningMode, numPoses: 1 });
  if (kind === "people") return vision.PoseLandmarker.createFromOptions(fileset, { baseOptions, runningMode, numPoses: 4 });
  throw new Error(`Unknown model "${kind}"`);
}

// Load (once) and return a model: "hand", "gesture", "face", "pose", or "people" (pose, up to four bodies). Tries the GPU, falls back to the CPU.
export function loadModel(kind) {
  if (!cache.has(kind)) {
    const promise = build(kind, "GPU").catch(() => build(kind, "CPU"));
    promise.catch(() => cache.delete(kind));
    cache.set(kind, promise);
  }
  return cache.get(kind);
}

// Run a model on the current video frame. Returns the model's result object.
let lastStamp = 0;
export function detect(kind, model, video) {
  const now = Math.max(performance.now(), lastStamp + 1); // MediaPipe wants strictly increasing timestamps
  lastStamp = now;
  return kind === "gesture" ? model.recognizeForVideo(video, now) : model.detectForVideo(video, now);
}
