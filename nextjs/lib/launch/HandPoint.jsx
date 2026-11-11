"use client";

import { useRef } from "react";
import { useCamera } from "../cv/useCamera.js";
import { useDetector } from "../cv/useDetector.js";

// One hand as a pointer for the shader pages: where the palm is (0–1 across and up, as in a mirror), and whether
// thumb and index finger are pinched. A small mirrored camera picture sits in the corner so you can see yourself.
// Uses CV's camera and MediaPipe helpers (lib/cv/useCamera.js, lib/cv/useDetector.js); the camera closes when this
// is switched off or you leave the page.

const PALM = [0, 5, 9, 13, 17];
const EDGE = 0.1;
const clamp = (v) => Math.max(0, Math.min(1, v));

export default function HandPoint({ onHand }) {
  const camera = useCamera({ storageKey: "shader-camera", width: 640, height: 360 });
  const smooth = useRef(null);
  const { state, fps } = useDetector(camera.videoRef, "hand", (result) => {
    const points = result.landmarks?.[0];
    if (!points) { smooth.current = null; onHand({ present: false }); return; }
    const sx = PALM.reduce((s, i) => s + (1 - points[i].x), 0) / PALM.length;
    const sy = PALM.reduce((s, i) => s + points[i].y, 0) / PALM.length;
    const target = { x: clamp((sx - EDGE) / (1 - 2 * EDGE)), y: 1 - clamp((sy - EDGE) / (1 - 2 * EDGE)) };
    const prev = smooth.current || target;
    smooth.current = { x: prev.x + (target.x - prev.x) * 0.5, y: prev.y + (target.y - prev.y) * 0.5 };
    const size = Math.hypot(points[0].x - points[9].x, points[0].y - points[9].y) || 0.1;
    const pinch = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) / size < 0.35;
    onHand({ present: true, ...smooth.current, pinch });
  });
  return (
    <div className="shader-hand">
      <video ref={camera.attach} autoPlay playsInline muted />
      <span>{camera.status.tone === "error" ? camera.status.text : state.text ? `${fps ? `${fps} fps` : "loading the hand model…"}` : camera.status.text}</span>
    </div>
  );
}
