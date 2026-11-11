"use client";

// /track/hello: the whole thing in one file. Read it top to bottom, then change the three settings below.
// 1. Open the camera.  2. Load MediaPipe's hand model.  3. Every frame: find the index fingertip.
// 4. If the fingertip goes above the line, fire a cue on the stage (once, until the hand comes back down).

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { fireCue } from "../../../lib/stage/stage.js";

// ── Change these ──────────────────────────────────────────────────────────────
const LINE = 0.3; // where the line is: 0 = top of the picture, 1 = bottom
const CUE = { id: "hello", label: "Hello, world", kind: "text", src: "Hello, world", options: { size: "12vw" } };
const COLOR = "#ff5a36"; // the line and the fingertip dot
// ──────────────────────────────────────────────────────────────────────────────

const INDEX_FINGERTIP = 8; // MediaPipe numbers 21 points on a hand; 8 is the tip of the index finger

export default function Hello() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [message, setMessage] = useState("Starting the camera and the hand model…");

  useEffect(() => {
    let stopped = false;
    let stream;
    let above = false; // was the fingertip above the line last frame?

    (async () => {
      // 1. The camera (Chrome asks permission the first time).
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // 2. The hand model: its runtime and model file come from the internet the first time.
      const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
      const hands = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      setMessage("Raise your index finger above the line.");

      // 3. Every frame.
      const frame = () => {
        if (stopped) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = ctx.strokeStyle = COLOR;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, LINE * canvas.height); ctx.lineTo(canvas.width, LINE * canvas.height); ctx.stroke();

        const result = hands.detectForVideo(video, performance.now());
        const tip = result.landmarks[0]?.[INDEX_FINGERTIP]; // x and y go from 0 to 1 across the picture
        if (tip) {
          ctx.beginPath(); ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 16, 0, Math.PI * 2); ctx.fill();
          // 4. Fire once when the fingertip crosses above the line.
          if (tip.y < LINE && !above) { fireCue(CUE); setMessage(`Fired "${CUE.label}". Lower your hand to fire again.`); }
          above = tip.y < LINE;
        }
        requestAnimationFrame(frame);
      };
      frame();
    })().catch((error) => setMessage(`Something went wrong: ${error.message}`));

    return () => { stopped = true; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  return (
    <div className="cv-page">
      <p className="eyebrow">Track · the whole thing in one file</p>
      <h1 className="hello-title">{message}</h1>
      <p className="cv-lede">This page is one file: <code>app/track/hello/Hello.jsx</code>. Open it next to the <a href="/stage" target="_blank">stage</a>. The version with zones, a camera picker, and numbers is <a href="/track">/track</a>.</p>
      {/* The picture is flipped like a mirror, so the drawing on top is flipped the same way. */}
      <div className="cv-stagebox is-mirrored hello-box">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
