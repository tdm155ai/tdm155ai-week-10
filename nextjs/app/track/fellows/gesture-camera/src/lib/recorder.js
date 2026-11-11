// recorder.js: records the stage canvas (and the microphone, if it's on) into
// a video file in the browser's memory, with the browser's MediaRecorder.
// Nothing is uploaded; a take only leaves the browser when you download it.

// The first format this browser can record wins. MP4 plays nearly everywhere
// (Chrome and Edge record it since 2024, Safari always has); WebM is the fallback.
const FORMATS = [
  { type: "video/mp4;codecs=avc1.42E01F,mp4a.40.2", ext: "mp4" },
  { type: "video/mp4", ext: "mp4" },
  { type: "video/webm;codecs=vp9,opus", ext: "webm" },
  { type: "video/webm;codecs=vp8,opus", ext: "webm" },
  { type: "video/webm", ext: "webm" },
];

export function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.type)) ?? { type: "", ext: "webm" };
}

export class TakeRecorder {
  constructor() {
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
    this.format = null;
  }

  get recording() {
    return this.recorder !== null;
  }

  // canvas: the stage picture. audioTracks: microphone tracks to add, or [].
  start(canvas, audioTracks = [], fps = 30) {
    if (this.recorder) return;
    const format = pickFormat();
    if (!format) throw new Error("This browser can't record video.");
    const stream = canvas.captureStream(fps);
    for (const track of audioTracks) stream.addTrack(track);
    const recorder = new MediaRecorder(stream, {
      ...(format.type ? { mimeType: format.type } : {}),
      videoBitsPerSecond: 8_000_000,
    });
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) this.chunks.push(event.data);
    };
    recorder.start(1000);
    this.recorder = recorder;
    this.stream = stream;
    this.format = format;
    this.startedAt = performance.now();
  }

  // Resolves to { blob, ext, ms } once the file is finished, or null if nothing was recording.
  stop() {
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve(null);
    const { stream, format, startedAt } = this;
    this.recorder = null;
    this.stream = null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        // Stop only the canvas's own track; the microphone stays on for the next take.
        stream.getVideoTracks().forEach((track) => track.stop());
        const type = (recorder.mimeType || format.type || "video/webm").split(";")[0];
        resolve({ blob: new Blob(this.chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm", ms: performance.now() - startedAt });
        this.chunks = [];
      };
      recorder.stop();
    });
  }
}
