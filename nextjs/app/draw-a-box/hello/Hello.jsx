"use client";

// /draw-a-box/hello: the whole thing in one file. Read it top to bottom, then change the settings below.
// 1. Open the camera.  2. Load OpenCV.js.  3. Several times a second: turn the frame into black and white,
// find the outlines of shapes, keep the biggest one with four corners.  4. When a box appears, fire a cue (once,
// until the box goes away).

import { useEffect, useRef, useState } from "react";
import { fireCue } from "../../../lib/stage/stage.js";

// ── Change these ──────────────────────────────────────────────────────────────
const SMALLEST = 0.03; // the smallest box that counts, as a fraction of the picture (0.03 = 3%)
const CUE = { id: "box", label: "A box!", kind: "video", src: "/cv/bars.mp4", options: { loop: true } };
const COLOR = "#7fc787"; // the outline
// ──────────────────────────────────────────────────────────────────────────────

const OPENCV = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js"; // about 11 MB

export default function Hello() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [message, setMessage] = useState("Starting the camera and OpenCV (11 MB, a few seconds)…");

  useEffect(() => {
    let stopped = false;
    let stream;
    let timer;
    let seen = false; // is there a box on the paper?
    let missing = 0; // how many looks in a row without a box (a hand passing over shouldn't count as rubbing it out)

    (async () => {
      // 1. The camera (Chrome asks permission the first time). Pick the overhead camera in Chrome's camera menu.
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // 2. OpenCV.js: a <script> tag, then wait until it has finished starting (cv.Mat exists).
      if (!window.cv?.Mat) {
        await new Promise((resolve, reject) => {
          const script = Object.assign(document.createElement("script"), { src: OPENCV, onload: resolve, onerror: reject });
          document.head.appendChild(script);
        });
        const started = Date.now();
        while (!window.cv?.Mat) {
          if (Date.now() - started > 60000) throw new Error("OpenCV.js took too long to start. Check the Wi-Fi and reload.");
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      const cv = window.cv;
      // OpenCV's cv has a then() that calls back with cv itself: if any page later awaits cv, it loops forever. Remove it.
      if (typeof cv.then === "function") { try { delete cv.then; } catch {} if (typeof cv.then === "function") cv.then = undefined; }
      setMessage("Draw a box in thick dark marker.");

      // 3. Ten times a second.
      const look = () => {
        if (stopped) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frame = cv.imread(canvas);
        const gray = new cv.Mat();
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
        cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 25, 12); // ink → white, paper → black
        const shapes = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(gray, shapes, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let best = null; // the biggest shape with four corners
        for (let i = 0; i < shapes.size(); i++) {
          const shape = shapes.get(i);
          const area = cv.contourArea(shape);
          const corners = new cv.Mat();
          cv.approxPolyDP(shape, corners, 0.03 * cv.arcLength(shape, true), true); // simplify the outline to a few corners
          if (corners.rows === 4 && area > SMALLEST * canvas.width * canvas.height && (!best || area > best.area)) {
            best = { area, points: [0, 1, 2, 3].map((k) => [corners.data32S[k * 2], corners.data32S[k * 2 + 1]]) };
          }
          corners.delete();
          shape.delete();
        }
        frame.delete(); gray.delete(); shapes.delete(); hierarchy.delete(); // OpenCV.js needs you to free its images

        if (best) {
          ctx.strokeStyle = COLOR;
          ctx.lineWidth = 6;
          ctx.beginPath();
          best.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.stroke();
        }
        // 4. Fire once when a box appears; it counts as gone after half a second without it.
        missing = best ? 0 : missing + 1;
        if (best && !seen) { seen = true; fireCue(CUE); setMessage(`Found a box: fired "${CUE.label}". Rub it out (or cover it) to fire again.`); }
        if (seen && missing >= 5) { seen = false; setMessage("Draw a box in thick dark marker."); }
        timer = setTimeout(look, 100);
      };
      look();
    })().catch((error) => setMessage(`Something went wrong: ${error.message || error.type || error}`));

    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  return (
    <div className="cv-page">
      <p className="eyebrow">Draw a box · the whole thing in one file</p>
      <h1 className="hello-title">{message}</h1>
      <p className="cv-lede">This page is one file: <code>app/draw-a-box/hello/Hello.jsx</code>. Open it next to the <a href="/stage" target="_blank">stage</a>. The full version, which plays the clip inside the box and picks clips by voice, is <a href="/draw-a-box">/draw-a-box</a>.</p>
      {/* What OpenCV looked at, with the box it found drawn on top. The live camera is hidden underneath. */}
      <div className="cv-stagebox hello-box">
        <video ref={videoRef} playsInline muted style={{ opacity: 0 }} />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
