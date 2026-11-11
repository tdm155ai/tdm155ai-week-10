// segmenter.js: loads MediaPipe's selfie segmenter, which finds the people in
// each camera frame: for every point of the picture, how sure it is that
// there's a person there. The page loads it only once a person effect
// (background blur, size, move, or another background) is turned on.
//
// This is the "landscape" version, made for wide 16:9 camera pictures.

import { createTask } from "./mediapipe.js";

export const SEGMENTER_MODEL_FILE = "selfie_segmenter_landscape.tflite";
const ONLINE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite";

let loading = null;

async function create() {
  const { ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const { task, delegate, offline } = await createTask(ImageSegmenter, SEGMENTER_MODEL_FILE, ONLINE_MODEL, {
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  return { segmenter: task, delegate, offline };
}

export function loadSegmenter() {
  loading ??= create().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

// Runs the segmenter on one frame and calls `use(values, width, height)` with
// the person mask: one number per point, 0 (not a person) to 1 (a person).
// The values only last until `use` returns.
export function findPerson(segmenter, video, now, use) {
  segmenter.segmentForVideo(video, now, (result) => {
    const masks = result.confidenceMasks;
    // With one mask it's the person; with two, the second is (the first is the background).
    const mask = masks?.[masks.length - 1];
    if (mask) use(mask.getAsFloat32Array(), mask.width, mask.height);
  });
}
