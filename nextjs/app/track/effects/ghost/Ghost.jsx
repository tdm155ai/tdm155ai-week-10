"use client";

// /track/effects/ghost: React Bits' GhostCursor on its own. The mouse leads it; with the camera on, your head (or
// hand) does. What it looks like is in ./settings.js (the file to change). This file is the machinery.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import GhostCursor from "../../../../lib/cv/react-bits/GhostCursor.jsx";
import HandFeed from "../../../../lib/cv/HandFeed.jsx";
import { fmt } from "../../../../lib/cv/ui.jsx";
import { color as startColor, follow as startFollow, maxDevicePixelRatio, sliders } from "./settings.js";

const start = () => Object.fromEntries(sliders.map((s) => [s.prop, s.value]));

export default function Ghost() {
  const stageRef = useRef(null);
  const tracker = useRef(null); // { x, y, active } while the camera leads it; null = the mouse does
  const [values, setValues] = useState(start); // what the sliders show
  const [applied, setApplied] = useState(start); // what the effect gets
  const [color, setColor] = useState(startColor);
  const [follow, setFollow] = useState(startFollow);
  const [camera, setCamera] = useState(false);
  const [point, setPoint] = useState(null);

  // A slider marked `restarts` (Trail) rebuilds the whole effect, so apply it once the slider settles, not on every
  // step: dragging it used to create ~30 WebGL contexts a second, which could stall the tab (and its navbar).
  useEffect(() => {
    const timer = setTimeout(() => setApplied(values), 400);
    const live = Object.fromEntries(sliders.filter((s) => !s.restarts).map((s) => [s.prop, values[s.prop]]));
    setApplied((a) => ({ ...a, ...live }));
    return () => clearTimeout(timer);
  }, [values]);

  const onPoint = useCallback((p) => {
    setPoint(p);
    tracker.current = p ? { x: p.x, y: p.y, active: true } : (tracker.current ? { ...tracker.current, active: false } : null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea")) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
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
        <p className="eyebrow">Track · Effects · Ghost</p>
        <h1>Leave a ghost behind.</h1>
        <p className="cv-lede">A glowing cloud that trails whatever leads it. Move the mouse over it; turn on the camera and your head (or your hand) leads it instead. Change the look, the sliders, and what it follows in <code>app/track/effects/ghost/settings.js</code>. The fluid version: <Link href="/track/effects/splash">/track/effects/splash</Link>.</p>
      </div>
      <div className="cv-bar">
        {sliders.map((s) => (
          <label key={s.prop}><span>{s.label}</span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={values[s.prop]} onChange={(e) => setValues((v) => ({ ...v, [s.prop]: Number(e.target.value) }))} />
          </label>
        ))}
        <label><span>Color</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <span className="cv-spacer" />
        <button type="button" className="cv-quiet" onClick={toggleFullscreen}>Full screen (F)</button>
        <label className="cv-check"><input type="checkbox" checked={camera} onChange={(e) => { setCamera(e.target.checked); if (!e.target.checked) { tracker.current = null; setPoint(null); } }} /> Use the camera</label>
        {camera && (
          <label><span>Follow</span>
            <select value={follow} onChange={(e) => setFollow(e.target.value)}>
              <option value="head">my head</option>
              <option value="hand">my hand</option>
            </select>
          </label>
        )}
      </div>
      <div className={`fx-grid ${camera ? "with-camera" : ""}`}>
        <div ref={stageRef} className="fx-stage">
          <div className="fx-layer">
            {/* The camera's tracker is attached only while the camera is on: with the mouse, the effect stops its loop when idle. */}
            <GhostCursor key={camera ? "camera" : "mouse"} tracker={camera ? tracker : undefined} color={color} {...applied} maxDevicePixelRatio={maxDevicePixelRatio} mixBlendMode="normal" zIndex={0} />
          </div>
          <p className="fx-hint">{point ? `${follow} x ${fmt(point.x)} · y ${fmt(point.y)}` : camera ? `looking for your ${follow}…` : "move the mouse here"}</p>
        </div>
        {camera && <HandFeed key={follow} follow={follow} onPoint={onPoint} />}
      </div>
    </div>
  );
}
