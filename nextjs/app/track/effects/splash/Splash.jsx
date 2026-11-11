"use client";

// /track/effects/splash: React Bits' SplashCursor on its own. The mouse stirs it (click for a burst); with "Use my
// hand", your index fingertip stirs it and a pinch makes a burst. What it looks like is in ./settings.js (the file to
// change). This file is the machinery: the stage, the sliders, the reset timer, full screen, and the camera.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SplashCursor from "../../../../lib/cv/react-bits/SplashCursor.jsx";
import HandFeed from "../../../../lib/cv/HandFeed.jsx";
import { fmt } from "../../../../lib/cv/ui.jsx";
import { RESET_SECONDS, color, pinchBurst, quality, rainbow, sliders } from "./settings.js";

const BLACK = { r: 0, g: 0, b: 0 };
const start = () => Object.fromEntries(sliders.map((s) => [s.prop, s.value]));

export default function Splash() {
  const stageRef = useRef(null);
  const trackers = useRef(null); // [{ x, y, active }] while a hand drives it; null = the mouse does
  const wasPinched = useRef(false);
  const [values, setValues] = useState(start);
  const [isRainbow, setRainbow] = useState(rainbow);
  const [generation, setGeneration] = useState(0);
  const [camera, setCamera] = useState(false);
  const [point, setPoint] = useState(null);

  // Start fresh every RESET_SECONDS; the Reset button starts fresh at once (and restarts the timer).
  const reset = useCallback(() => setGeneration((g) => g + 1), []);
  useEffect(() => {
    const timer = setInterval(reset, RESET_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [generation, reset]);

  // The hand drives the splash; a pinch sends a burst at the fingertip (a click on the stage does the same).
  const onPoint = useCallback((p) => {
    setPoint(p);
    trackers.current = p ? [{ x: p.x, y: p.y, active: true }] : null;
    const stage = stageRef.current;
    if (pinchBurst && p?.pinch && !wasPinched.current && stage) {
      const r = stage.getBoundingClientRect();
      stage.querySelector(".fx-layer > div")?.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + p.x * r.width, clientY: r.top + p.y * r.height, bubbles: true }));
    }
    wasPinched.current = !!p?.pinch;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea")) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "r" || e.key === "R") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  }

  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Effects · Splash</p>
        <h1>Stir the light.</h1>
        <p className="cv-lede">A fluid simulation running on the graphics card. Move the mouse over it to stir, click for a burst. Turn on <strong>Use my hand</strong> and your fingertip stirs it; pinch for a burst. It starts fresh every {RESET_SECONDS} seconds (or press <strong>R</strong>). Change the colors, sliders, and quality in <code>app/track/effects/splash/settings.js</code>. The cloud version: <Link href="/track/effects/ghost">/track/effects/ghost</Link>.</p>
      </div>
      <div className="cv-bar">
        {sliders.map((s) => (
          <label key={s.prop}><span>{s.label}</span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={values[s.prop]} onChange={(e) => setValues((v) => ({ ...v, [s.prop]: Number(e.target.value) }))} />
          </label>
        ))}
        <label className="cv-check"><input type="checkbox" checked={isRainbow} onChange={(e) => setRainbow(e.target.checked)} /> Rainbow</label>
        <span className="cv-spacer" />
        <button type="button" className="cv-quiet" onClick={reset}>Reset (R)</button>
        <button type="button" className="cv-quiet" onClick={toggleFullscreen}>Full screen (F)</button>
        <label className="cv-check"><input type="checkbox" checked={camera} onChange={(e) => { setCamera(e.target.checked); if (!e.target.checked) onPoint(null); }} /> Use my hand</label>
      </div>
      <div className={`fx-grid ${camera ? "with-camera" : ""}`}>
        <div ref={stageRef} className="fx-stage">
          <div className="fx-layer" key={generation}>
            <SplashCursor trackers={trackers} {...quality} {...values} COLOR={color} RAINBOW_MODE={isRainbow} BACK_COLOR={BLACK} TRANSPARENT={false} VELOCITY_DISSIPATION={1.5} />
          </div>
          <p className="fx-hint">{point ? `hand x ${fmt(point.x)} · y ${fmt(point.y)}${point.pinch ? " · PINCH" : ""}` : "move the mouse here · click for a burst"} · fresh starts: {generation}</p>
        </div>
        {camera && <HandFeed follow="hand" onPoint={onPoint} />}
      </div>
    </div>
  );
}
