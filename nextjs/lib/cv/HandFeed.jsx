"use client";

// A small camera feed for the effect demos: render it only when the student asks for the camera (so the page never
// asks for camera permission before that). It reports one point, as in a mirror (x 0 = left of the screen, 1 = right;
// y 0 = top, 1 = bottom), through onPoint({ x, y, pinch }) about 30 times a second, or onPoint(null) when it's lost.
// `follow`: "hand" (index fingertip; pinch = thumb touching it) or "head" (the tip of the nose).

import { useRef } from "react";
import { useCamera } from "./useCamera.js";
import { useDetector } from "./useDetector.js";

const INDEX_TIP = 8, THUMB_TIP = 4, WRIST = 0, MIDDLE_BASE = 9, NOSE_TIP = 1;

export default function HandFeed({ follow = "hand", onPoint }) {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const lastSent = useRef(0);
  const { state } = useDetector(camera.videoRef, follow === "head" ? "face" : "hand", (result) => {
    const now = performance.now();
    if (now - lastSent.current < 30) return;
    lastSent.current = now;
    if (follow === "head") {
      const nose = result.faceLandmarks?.[0]?.[NOSE_TIP];
      onPoint(nose ? { x: 1 - nose.x, y: nose.y, pinch: false } : null);
      return;
    }
    const p = result.landmarks?.[0];
    if (!p) { onPoint(null); return; }
    const size = Math.max(Math.hypot(p[WRIST].x - p[MIDDLE_BASE].x, p[WRIST].y - p[MIDDLE_BASE].y), 1e-6);
    const pinch = Math.hypot(p[THUMB_TIP].x - p[INDEX_TIP].x, p[THUMB_TIP].y - p[INDEX_TIP].y) / size < 0.25;
    onPoint({ x: 1 - p[INDEX_TIP].x, y: p[INDEX_TIP].y, pinch });
  });
  return (
    <div className="handfeed">
      <div className="cv-stagebox is-mirrored"><video ref={camera.attach} autoPlay playsInline muted /></div>
      <p className="cv-muted">{camera.status.tone === "error" ? camera.status.text : state.text}</p>
    </div>
  );
}
