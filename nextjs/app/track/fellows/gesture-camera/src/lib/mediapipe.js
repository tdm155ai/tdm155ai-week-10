// mediapipe.js: what the hand tracker and the person finder share. MediaPipe
// runs in the browser as WebAssembly with a small trained model per task.
//
// It uses the copies in public/mediapipe/ that `pnpm dev` sets up, and falls
// back to the internet for anything missing. It asks for the GPU first, which
// is fastest, and uses the CPU if the GPU isn't available.

const MEDIAPIPE_VERSION = "1.2.2"; // keep in step with package.json
const LOCAL = "/mediapipe";
const ONLINE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

// In the class app there are no copies in public/mediapipe/, so everything comes from the internet. Checking first
// only printed red 404s in the console, so this answers "no" without asking.
async function exists() {
  return false;
}

let files = null;

// The WebAssembly files, loaded once for the whole page.
function visionFiles() {
  files ??= (async () => {
    const { FilesetResolver } = await import("@mediapipe/tasks-vision");
    const local = await exists(`${LOCAL}/wasm/vision_wasm_internal.wasm`);
    return { fileset: await FilesetResolver.forVisionTasks(local ? `${LOCAL}/wasm` : ONLINE_WASM), local };
  })().catch((error) => {
    files = null;
    throw error;
  });
  return files;
}

// Creates a MediaPipe task (HandLandmarker, ImageSegmenter…) from its model
// file in public/mediapipe/, or from `onlineModel` if that file is missing.
export async function createTask(Task, modelFile, onlineModel, options) {
  const [{ fileset, local }, localModel] = await Promise.all([visionFiles(), exists(`${LOCAL}/${modelFile}`)]);
  const make = (delegate) =>
    Task.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: localModel ? `${LOCAL}/${modelFile}` : onlineModel, delegate },
    });
  let task;
  let delegate = "GPU";
  try {
    task = await make("GPU");
  } catch {
    delegate = "CPU";
    task = await make("CPU");
  }
  return { task, delegate, offline: local && localModel };
}
