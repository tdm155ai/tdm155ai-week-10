// hand-tracker.js: loads MediaPipe's HandLandmarker once for the whole page.

import { createTask } from "./mediapipe.js";

export const HAND_MODEL_FILE = "hand_landmarker.task";
const ONLINE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let loading = null;

async function create() {
  const { HandLandmarker } = await import("@mediapipe/tasks-vision");
  const { task, delegate, offline } = await createTask(HandLandmarker, HAND_MODEL_FILE, ONLINE_MODEL, {
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return { landmarker: task, delegate, offline };
}

export function loadHandTracker() {
  loading ??= create().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
