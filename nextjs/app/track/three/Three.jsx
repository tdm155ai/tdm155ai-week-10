"use client";

// /track/three: a Three.js scene with sliders, mouse orbit, full screen, and (optionally) your hand from the camera.
// What's in the scene, the sliders, and the hand mapping are in ./scene.js (the file to change). This file is the
// machinery: the renderer, the camera, resizing, the animation loop, and cleaning up when you leave the page.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { useDetector } from "../../../lib/cv/useDetector.js";
import { fmt } from "../../../lib/cv/ui.jsx";
import { controls, fromHand, makeScene } from "./scene.js";

const start = () => Object.fromEntries(controls.map((c) => [c.name, c.value]));

export default function Three() {
  const holderRef = useRef(null);
  const valuesRef = useRef(start());
  const handRef = useRef(null);
  const [values, setValues] = useState(start);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  const [useHand, setUseHand] = useState(false);
  const [hand, setHand] = useState(null);
  const [error, setError] = useState("");
  playingRef.current = playing;

  // Set up Three.js once; tear it all down when the page closes.
  useEffect(() => {
    const holder = holderRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { setError(`WebGL isn't available here: ${e.message}`); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
    camera.position.set(0, 12, 24);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, -1, 0);
    const update = makeScene(THREE, scene);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = holder;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(holder);
    resize();

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (playingRef.current) t += (now - last) / 1000;
      last = now;
      const h = handRef.current;
      const v = h ? fromHand(h, valuesRef.current) : valuesRef.current;
      if (playingRef.current) update(t, v, h);
      orbit.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      orbit.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); [o.material].flat().forEach((m) => m?.dispose()); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // F = full screen, Space = pause.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea")) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else holderRef.current?.requestFullscreen?.();
  }

  function set(name, value) {
    valuesRef.current = { ...valuesRef.current, [name]: value };
    setValues(valuesRef.current);
  }

  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Three.js</p>
        <h1>A world you can move.</h1>
        <p className="cv-lede">1,600 blocks in 3D, drawn by Three.js. Drag to look around, scroll to zoom, and play the sliders. Turn on <strong>Use my hand</strong> and your hand plays it: left-right spins it, up-down lifts the wave, a pinch sends a pulse out. Change the scene, the sliders, and the hand mapping in <code>app/track/three/scene.js</code>. More hands: <Link href="/track">/track</Link>.</p>
      </div>
      <div className="cv-bar">
        {controls.map((c) => (
          <label key={c.name}><span>{c.label}</span>
            <input type="range" min={c.min} max={c.max} step={c.step} value={values[c.name]} onChange={(e) => set(c.name, Number(e.target.value))} />
          </label>
        ))}
        <span className="cv-spacer" />
        <button type="button" className="cv-quiet" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause (Space)" : "Play (Space)"}</button>
        <button type="button" className="cv-quiet" onClick={() => { valuesRef.current = start(); setValues(valuesRef.current); }}>Reset</button>
        <button type="button" className="cv-quiet" onClick={toggleFullscreen}>Full screen (F)</button>
        <label className="cv-check"><input type="checkbox" checked={useHand} onChange={(e) => { setUseHand(e.target.checked); if (!e.target.checked) { handRef.current = null; setHand(null); } }} /> Use my hand</label>
      </div>
      {error && <p className="cv-status"><span className="is-error">{error}</span></p>}
      <div className={`three-grid ${useHand ? "with-hand" : ""}`}>
        <div ref={holderRef} className="three-holder" />
        {useHand && <HandInput onHand={(h) => { handRef.current = h; setHand(h); }} hand={hand} />}
      </div>
    </div>
  );
}

// The camera only opens when "Use my hand" is on. Index fingertip → x, y; thumb to index → pinch.
function HandInput({ onHand, hand }) {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const lastSent = useRef(0);
  const { state } = useDetector(camera.videoRef, "hand", (result) => {
    const p = result.landmarks?.[0];
    const now = performance.now();
    if (!p) { if (now - lastSent.current > 100) { lastSent.current = now; onHand(null); } return; }
    const pinch = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / Math.max(Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y), 1e-6) < 0.25;
    const h = { x: 1 - p[8].x, y: p[8].y, pinch }; // 1 - x: as in a mirror
    if (now - lastSent.current > 30) { lastSent.current = now; onHand(h); }
  });
  return (
    <aside className="cv-side">
      <div className="cv-stagebox is-mirrored three-cam"><video ref={camera.attach} autoPlay playsInline muted /></div>
      <p className="cv-muted">{camera.status.tone === "error" ? camera.status.text : state.text}</p>
      <p className="cv-muted">{hand ? `hand x ${fmt(hand.x)} · y ${fmt(hand.y)}${hand.pinch ? " · PINCH" : ""}` : "No hand in view: the sliders play it."}</p>
    </aside>
  );
}
