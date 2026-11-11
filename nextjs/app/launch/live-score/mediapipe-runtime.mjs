// MediaPipe's Emscripten runtime binds console.error as its stderr writer.
// Drop exactly this benign INFO line; preserve all other messages and arguments.
const INFO = 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';
const KEY = Symbol.for('mk-audio-editing.mediapipe-info-filter');
export function installMediaPipeInfoFilter() {
  // Copies in the three page folders coordinate only their console lifetime.
  // Concurrent model startup must not restore another active session's filter.
  let state = globalThis[KEY];
  if (!state || console.error !== state.wrapper) {
    state = { previous: console.error, count: 0 };
    state.wrapper = function (...args) {
      if (state.count > 0 && args.length === 1 && typeof args[0] === 'string' && args[0].trim() === INFO) return;
      return state.previous.apply(this, args);
    };
    globalThis[KEY] = state;
    console.error = state.wrapper;
  }
  state.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count === 0) {
      if (console.error === state.wrapper) console.error = state.previous;
      if (globalThis[KEY] === state) delete globalThis[KEY];
    }
  };
}

// Every call needs real pixels, a fresh video frame and a strictly newer time.
export function canTrackFrame(video, previousFrame, timestamp, previousTimestamp) {
  return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 &&
    Number.isFinite(video.currentTime) && video.currentTime !== previousFrame &&
    Number.isFinite(timestamp) && timestamp > previousTimestamp);
}
