// hand-tracker.js: loads MediaPipe's HandLandmarker once for the whole page.
//
// It uses the copies in public/mediapipe/ that `pnpm dev` sets up, and falls
// back to the internet if they're missing. It asks for the GPU first, which is
// fastest, and uses the CPU if the GPU isn't available.

const MEDIAPIPE_VERSION = "1.2.2"; // keep in step with package.json
const LOCAL = "/mediapipe";
const ONLINE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const ONLINE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let loading = null;

async function exists(url) {
  try {
    return (await fetch(url, { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

async function create() {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const [localWasm, localModel] = await Promise.all([
    exists(`${LOCAL}/wasm/vision_wasm_internal.wasm`),
    exists(`${LOCAL}/hand_landmarker.task`),
  ]);
  const files = await FilesetResolver.forVisionTasks(localWasm ? `${LOCAL}/wasm` : ONLINE_WASM);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: localModel ? `${LOCAL}/hand_landmarker.task` : ONLINE_MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let landmarker;
  let delegate = "GPU";
  try {
    landmarker = await HandLandmarker.createFromOptions(files, options("GPU"));
  } catch {
    delegate = "CPU";
    landmarker = await HandLandmarker.createFromOptions(files, options("CPU"));
  }
  return { landmarker, delegate, offline: localWasm && localModel };
}

export function loadHandTracker() {
  loading ??= create().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
