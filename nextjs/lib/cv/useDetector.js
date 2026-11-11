"use client";

// Run a MediaPipe model on every new video frame and hand the result to `onFrame(result, video)`.
// `kind` is "hand", "gesture", "face", or "pose" (see mediapipe.js); pass null to stop.

import { useEffect, useRef, useState } from "react";
import { detect, loadModel, MODELS } from "./mediapipe.js";

export function useDetector(videoRef, kind, onFrame) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [state, setState] = useState({ tone: "muted", text: "" });
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!kind) return undefined;
    let stopped = false;
    let raf = 0;
    let lastTime = -1;
    let frames = 0;
    let fpsAt = performance.now();
    setState({ tone: "muted", text: `Loading ${MODELS[kind].label}… (first time takes a few seconds)` });

    loadModel(kind).then((model) => {
      if (stopped) return;
      setState({ tone: "ok", text: `${MODELS[kind].label}: running.` });
      const tick = () => {
        if (stopped) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth && video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          try {
            onFrameRef.current(detect(kind, model, video), video);
          } catch (error) {
            setState({ tone: "error", text: `Tracking error: ${error.message}` });
          }
          frames += 1;
          const now = performance.now();
          if (now - fpsAt > 1000) { setFps(Math.round((frames * 1000) / (now - fpsAt))); frames = 0; fpsAt = now; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch((error) => {
      if (!stopped) setState({ tone: "error", text: `Couldn't load the model: ${error.message}. Check the internet connection (the model comes from Google's CDN).` });
    });

    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [kind, videoRef]);

  return { state, fps };
}
