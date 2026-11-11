"use client";

// /draw-a-box: point a camera down at a big sheet of paper, draw a box in marker, and a video plays inside it.
// A spoken word (or a button, or a number key) picks the video. The words and clips are in ./clips.js.
// OpenCV.js finds the box (lib/cv/opencv.js); a CSS 3D transform warps the clip onto its four corners.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../lib/cv/useCamera.js";
import { findBox, freeMats, loadOpenCV, makeStabilizer, orderCorners, quadTransform } from "../../lib/cv/opencv.js";
import { boxFromMarkers, findMarkers } from "../../lib/cv/aruco.js";
import { speechSupported, startListening, triggerWatcher } from "../../lib/voice/speech.js";
import { CameraBar, Readout, Status } from "../../lib/cv/ui.jsx";
import { clearWord, clips } from "./clips.js";

const WORK_WIDTH = 640; // OpenCV looks at a 640-pixel-wide copy of each frame: fast enough, sharp enough.
const MARKER_WIDTH = 1280; // printed markers are small from up high, so they get a sharper copy.

export default function DrawABox() {
  const camera = useCamera({ storageKey: "cv-camera-box" });
  const boxRef = useRef(null);
  const overlayRef = useRef(null);
  const clipRef = useRef(null);
  const workRef = useRef(null);
  const debugRef = useRef(null);
  const settingsRef = useRef({});
  const [cvState, setCvState] = useState({ tone: "muted", text: "Loading OpenCV.js (about 11 MB, first time only)…" });
  const [source, setSource] = useState("drawn"); // "drawn": a box in marker; "markers": four printed ArUco markers
  const [mirror, setMirror] = useState(false);
  const [outline, setOutline] = useState(true);
  const [cameraHidden, setCameraHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [offset, setOffset] = useState(12);
  const [minArea, setMinArea] = useState(3);
  const [clip, setClip] = useState(clips[0]);
  const [rows, setRows] = useState([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceState, setVoiceState] = useState({ tone: "muted", text: "" });
  const [fullscreen, setFullscreen] = useState(false);
  settingsRef.current = { source, mirror, outline, locked, showDebug, offset, minArea };

  // Load OpenCV, then look at frames ~20 times a second.
  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let lastRun = 0;
    let lastRows = 0;
    const mats = {};
    const stabilize = makeStabilizer();
    let quad = null;
    let found = false;
    let markerNote = "";
    let cvRef = null;

    const tick = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const video = camera.videoRef.current;
      const box = boxRef.current;
      if (!cvRef || !video || video.readyState < 2 || !video.videoWidth || !box) return;
      const s = settingsRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const k = Math.min(1, (s.source === "markers" ? MARKER_WIDTH : WORK_WIDTH) / vw);
      const pw = Math.round(vw * k);
      const ph = Math.round(vh * k);

      if (now - lastRun > 50 && !s.locked) {
        lastRun = now;
        const work = workRef.current ??= document.createElement("canvas");
        if (work.width !== pw || work.height !== ph) { work.width = pw; work.height = ph; }
        work.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, pw, ph);
        try {
          let result;
          if (s.source === "markers") {
            const markers = findMarkers(cvRef, work, mats);
            result = boxFromMarkers(markers);
            const ids = markers.map((m) => m.id).sort((a, b) => a - b);
            markerNote = `${ids.length ? ids.join(", ") : "none"}${result?.guessed ? ` (guessing ${result.guessed})` : ""}`;
          } else {
            result = findBox(cvRef, work, mats, { offset: s.offset, minArea: s.minArea / 100 });
          }
          found = !!result;
          quad = stabilize(result?.quad || null, pw);
          if (s.showDebug && debugRef.current) cvRef.imshow(debugRef.current, s.source === "markers" ? mats.markerGray : mats.bin);
        } catch (error) {
          setCvState({ tone: "error", text: `OpenCV error: ${error.message || error}` });
        }
      }

      // Map the box from the 640-wide work frame to the screen (the camera is shown "contain" in the box element).
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      const scale = Math.min(cw / vw, ch / vh);
      const ox = (cw - vw * scale) / 2;
      const oy = (ch - vh * scale) / 2;
      const toScreen = (p) => ({ x: ox + (s.mirror ? pw - p.x : p.x) * (scale / k), y: oy + p.y * (scale / k) });
      const screenQuad = quad ? orderCorners(quad.map(toScreen)) : null;

      const clipEl = clipRef.current;
      if (clipEl) {
        if (screenQuad) {
          const w = clipEl.videoWidth || 640;
          const h = clipEl.videoHeight || 360;
          clipEl.style.width = `${w}px`;
          clipEl.style.height = `${h}px`;
          clipEl.style.transform = quadTransform(w, h, screenQuad);
          clipEl.style.opacity = "1";
        } else {
          clipEl.style.opacity = "0";
        }
      }

      const overlay = overlayRef.current;
      if (overlay) {
        if (overlay.width !== cw || overlay.height !== ch) { overlay.width = cw; overlay.height = ch; }
        const ctx = overlay.getContext("2d");
        ctx.clearRect(0, 0, cw, ch);
        if (screenQuad && s.outline) {
          ctx.strokeStyle = s.locked ? "#7fb3ff" : "#7fc787";
          ctx.lineWidth = 3;
          ctx.beginPath();
          screenQuad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          screenQuad.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); });
        }
      }

      if (now - lastRows > 200) {
        lastRows = now;
        setRows([
          ["box found this frame", found ? "yes" : "no", found],
          ...(s.source === "markers" ? [["markers seen (need 3 of 0–3)", markerNote || "none"]] : []),
          ["box on screen", quad ? (s.locked ? "locked" : "yes") : "no", !!quad],
          ...(quad ? quad.map((p, i) => [["top-left", "top-right", "bottom-right", "bottom-left"][i], `${Math.round(p.x)}, ${Math.round(p.y)}`]) : []),
          ["work frame", `${pw}×${ph}`],
        ]);
      }
    };

    loadOpenCV().then((cv) => {
      if (stopped) return;
      cvRef = cv;
      setCvState({ tone: "ok", text: "OpenCV ready." });
      raf = requestAnimationFrame(tick);
    }).catch((error) => setCvState({ tone: "error", text: `Couldn't load OpenCV.js: ${error.message}. Check the Wi-Fi.` }));

    return () => { stopped = true; cancelAnimationFrame(raf); freeMats(mats); };
  }, [camera.videoRef]);

  // Play the chosen clip.
  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    if (!clip) { el.removeAttribute("src"); el.load(); return; }
    el.src = clip.src;
    el.play().catch(() => {});
  }, [clip]);

  // The spoken word picks the clip (TR's lib/voice/speech.js: Chrome's Web Speech API).
  const stopRef = useRef(null);
  const toggleListening = useCallback(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; setListening(false); setVoiceState({ tone: "muted", text: "Stopped listening." }); return; }
    if (!speechSupported()) { setVoiceState({ tone: "error", text: "No speech recognition in this browser: use Chrome." }); return; }
    const watch = triggerWatcher(
      () => [...clips.map((c) => ({ say: c.word, clip: c })), { say: clearWord, clip: null }],
      (t) => { setClip(t.clip); setHeard((h) => `→ ${t.say}   ${h}`.slice(0, 120)); },
      { cooldown: 1 },
    );
    stopRef.current = startListening({
      onResult: (r) => { watch(r); if (!r.final) setHeard(r.text.slice(-80)); },
      onState: (state) => setVoiceState({ tone: "ok", text: state === "listening" ? "Listening for the words." : "Listening (restarting)…" }),
      onError: (error) => setVoiceState({ tone: "error", text: error.message }),
    });
    setListening(true);
  }, []);
  useEffect(() => () => stopRef.current?.(), []);

  // Number keys pick clips; 0 clears; L locks the box; F goes full screen.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.("input, select, textarea")) return;
      if (/^[1-9]$/.test(event.key) && clips[Number(event.key) - 1]) setClip(clips[Number(event.key) - 1]);
      if (event.key === "0") setClip(null);
      if (event.key === "l" || event.key === "L") setLocked((v) => !v);
      if (event.key === "f" || event.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else boxRef.current?.requestFullscreen?.();
  }

  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Draw a box</p>
        <h1>Draw a box, say a word.</h1>
        <p className="cv-lede">Point the overhead camera at a big sheet of paper and draw a rectangle in thick dark marker. OpenCV finds the biggest four-sided shape; the clip is warped onto its corners. Say a clip&apos;s word (after <strong>Listen</strong>), click it, or press its number. Lines flaky under the lights? Set <strong>Box from</strong> to printed markers and <Link href="/draw-a-box/markers">print four markers</Link> for the corners. Change the words and clips in <code>app/draw-a-box/clips.js</code>. The finding part in one short file you can read top to bottom: <Link href="/draw-a-box/hello">/draw-a-box/hello</Link>. How-to: <Link href="/docs/draw-a-box">docs/draw-a-box</Link>.</p>
      </div>
      <CameraBar camera={camera} mirror={mirror} setMirror={setMirror}>
        <button type="button" onClick={toggleListening} className={listening ? "" : "cv-quiet"}>{listening ? "Listening… (stop)" : "Listen"}</button>
        <button type="button" className="cv-quiet" onClick={toggleFullscreen}>Full screen (F)</button>
      </CameraBar>
      <div className="cv-bar">
        <label className="cv-check"><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> Lock the box (L)</label>
        <label className="cv-check"><input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} /> Outline</label>
        <label className="cv-check"><input type="checkbox" checked={cameraHidden} onChange={(e) => setCameraHidden(e.target.checked)} /> Hide the camera</label>
        <label className="cv-check"><input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> Show what OpenCV sees</label>
        <label><span>Box from</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="drawn">lines drawn in marker</option>
            <option value="markers">printed markers (0–3)</option>
          </select>
        </label>
        {source === "markers" && <Link href="/draw-a-box/markers" target="_blank">Print the markers</Link>}
        {source === "drawn" && <><label><span>Ink sensitivity</span><input type="range" min="2" max="40" value={offset} onChange={(e) => setOffset(Number(e.target.value))} /> {offset}</label>
        <label><span>Smallest box</span><input type="range" min="1" max="30" value={minArea} onChange={(e) => setMinArea(Number(e.target.value))} /> {minArea}%</label></>}
      </div>
      <Status items={[camera.status, cvState, voiceState]} />
      <div className="cv-grid">
        <div ref={boxRef} className={`cv-stagebox box-stage ${mirror ? "is-mirrored" : ""} ${cameraHidden ? "is-camera-hidden" : ""} ${fullscreen ? "is-fullscreen" : ""}`}>
          <video ref={camera.attach} autoPlay playsInline muted />
          <video ref={clipRef} className="box-clip" autoPlay loop muted playsInline />
          <canvas ref={overlayRef} className="box-overlay" />
        </div>
        <aside className="cv-side">
          <div>
            <p className="eyebrow">Clips (say the word)</p>
            <div className="box-clips">
              {clips.map((c, i) => <button key={c.word} type="button" aria-pressed={clip?.word === c.word} onClick={() => setClip(c)}>{i + 1} · {c.word}</button>)}
              <button type="button" aria-pressed={!clip} onClick={() => setClip(null)}>0 · {clearWord}</button>
            </div>
            <p className="box-heard">{heard}</p>
          </div>
          <p className="eyebrow">What OpenCV sees</p>
          <Readout rows={rows} />
          {showDebug && <canvas ref={debugRef} className="box-debug" />}
        </aside>
      </div>
    </div>
  );
}
