"use client";

// /draw-a-box: point a camera down at a big sheet of paper, draw a box in marker, and a video plays inside it.
// A spoken word (or a button, or a number key) picks the video. The words and clips are in ./clips.js.
// OpenCV.js finds the box (lib/cv/opencv.js); a CSS 3D transform warps the clip onto its four corners.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../lib/cv/useCamera.js";
import { boxColor, findBoxes, freeMats, loadOpenCV, nearestCard, orderCorners, quadTransform } from "../../lib/cv/opencv.js";
import { makeBoxTracker } from "../../lib/cv/boxes.js";
import { boxFromMarkers, findMarkers } from "../../lib/cv/aruco.js";
import { speechSupported, startListening, triggerWatcher } from "../../lib/voice/speech.js";
import { CameraBar, Readout, Status } from "../../lib/cv/ui.jsx";
import ZoneLinks from "../components/ZoneLinks.jsx";
import { cards, clearWord, clips } from "./clips.js";

const WORK_WIDTH = 640; // OpenCV looks at a 640-pixel-wide copy of each frame: fast enough, sharp enough.
const MARKER_WIDTH = 1280; // printed markers are small from up high, so they get a sharper copy.
const MAX_BOXES = 4; // the most boxes the page will play at once (each has its own menu)
const COLORS = ["#7fc787", "#ff6b57", "#7fb3ff", "#f2c14e", "#c88bff", "#4fd1c5"];

export default function DrawABox() {
  const camera = useCamera({ storageKey: "cv-camera-box" });
  const boxRef = useRef(null);
  const overlayRef = useRef(null);
  const slotsRef = useRef([]); // per box on screen: { video, img, src }
  const workRef = useRef(null);
  const debugRef = useRef(null);
  const settingsRef = useRef({});
  const [cvState, setCvState] = useState({ tone: "muted", text: "Loading OpenCV.js (about 11 MB, first time only)…" });
  const [pickBy, setPickBy] = useState("word"); // "word": words, buttons, keys; "color": the card's color
  const [source, setSource] = useState("drawn"); // "drawn": a box in marker; "markers": four printed ArUco markers
  const [mirror, setMirror] = useState(false);
  const [outline, setOutline] = useState(true);
  const [cameraHidden, setCameraHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [offset, setOffset] = useState(12);
  const [minArea, setMinArea] = useState(1); // % of the picture: small boxes on a big sheet are ~1–2%
  // What plays in each box (by its number on screen): a clip's src, or null. Words, buttons, and keys set the target box.
  const [library, setLibrary] = useState(clips); // clips.js, then any GIFs in _media/ (this computer)
  const [perBox, setPerBox] = useState(() => Array.from({ length: MAX_BOXES }, (_, i) => clips[i % clips.length]?.src ?? null));
  const [target, setTarget] = useState(0); // 0–3, or "all"
  const targetRef = useRef(0);
  targetRef.current = target;
  const assign = useCallback((c) => setPerBox((p) => p.map((v, i) => (targetRef.current === "all" || targetRef.current === i ? (c?.src ?? null) : v))), []);
  const labelOf = (src) => library.find((c) => c.src === src)?.label || decodeURIComponent(src?.split("/").pop() || "");
  const [maxBoxes, setMaxBoxes] = useState(4);
  const [rows, setRows] = useState([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceState, setVoiceState] = useState({ tone: "muted", text: "" });
  const [fullscreen, setFullscreen] = useState(false);
  settingsRef.current = { pickBy, perBox, labelOf, maxBoxes, source, mirror, outline, locked, showDebug, offset, minArea };

  // Load OpenCV, then look at frames ~20 times a second.
  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let lastRun = 0;
    let lastRows = 0;
    const mats = {};
    const track = makeBoxTracker({ max: MAX_BOXES });
    let boxes = [];
    let foundCount = 0;
    let markerNote = "";
    let cvRef = null;

    // Put a clip (GIF in the <img>, anything else in the <video>) into a box's slot, if it isn't there already.
    const load = (slot, src) => {
      if (slot.src === src) return;
      slot.src = src;
      if (!src || /\.gif($|\?)/i.test(src)) { slot.video.removeAttribute("src"); slot.video.load(); }
      if (src && /\.gif($|\?)/i.test(src)) { slot.img.src = src; return; }
      slot.img.removeAttribute("src");
      if (src) { slot.video.src = src; slot.video.play().catch(() => {}); }
    };

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
        const workCtx = work.getContext("2d", { willReadFrequently: true });
        workCtx.drawImage(video, 0, 0, pw, ph);
        try {
          let quads;
          if (s.source === "markers") {
            const markers = findMarkers(cvRef, work, mats);
            const result = boxFromMarkers(markers);
            const ids = markers.map((m) => m.id).sort((a, b) => a - b);
            markerNote = `${ids.length ? ids.join(", ") : "none"}${result?.guessed ? ` (guessing ${result.guessed})` : ""}`;
            quads = result ? [result.quad] : [];
          } else {
            quads = findBoxes(cvRef, work, mats, { offset: s.offset, minArea: s.minArea / 100, max: s.maxBoxes, colorful: s.pickBy === "color" }).map((b) => b.quad);
          }
          foundCount = quads.length;
          boxes = track(quads, pw, now).slice(0, s.maxBoxes);
          if (s.pickBy === "color") {
            const pixels = workCtx.getImageData(0, 0, pw, ph);
            for (const b of boxes) {
              const color = boxColor(pixels, b.raw);
              const card = nearestCard(color, cards);
              b.colorNote = color ? `${card ? card.color : "no color"} (hue ${Math.round(color.hue)}, sat ${color.saturation.toFixed(2)})` : "";
              // A card's color must hold for a few looks before its GIF changes.
              if (card === b.vote.card) b.vote.count += 1; else { b.vote.card = card; b.vote.count = 1; }
              if (b.vote.count >= 4 && card !== b.vote.shown) b.vote.shown = card;
            }
          }
          if (s.showDebug && debugRef.current) cvRef.imshow(debugRef.current, s.source === "markers" ? mats.markerGray : mats.bin);
        } catch (error) {
          setCvState({ tone: "error", text: `OpenCV error: ${error.message || error}` });
        }
      }

      // What plays in each box. Card color: each card's own color. Otherwise: that box's menu (box 1, 2, 3, 4 on screen).
      for (const b of boxes) {
        if (s.pickBy === "color") b.content = b.vote.shown || null;
        else { const src = s.perBox[b.slot]; b.content = src ? { src, label: s.labelOf(src) } : null; }
      }

      // Map each box from the work frame to the screen (the camera is shown "contain" in the box element).
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      const scale = Math.min(cw / vw, ch / vh);
      const ox = (cw - vw * scale) / 2;
      const oy = (ch - vh * scale) / 2;
      const toScreen = (p) => ({ x: ox + (s.mirror ? pw - p.x : p.x) * (scale / k), y: oy + p.y * (scale / k) });
      const onScreen = boxes.map((b) => ({ b, quad: orderCorners(b.quad.map(toScreen)) }));

      slotsRef.current.forEach((slot, i) => {
        if (!slot?.video || !slot?.img) return;
        const here = onScreen.find((o) => o.b.slot === i);
        load(slot, here?.b.content?.src || null);
        const gif = !!slot.src && /\.gif($|\?)/i.test(slot.src);
        const el = gif ? slot.img : slot.video;
        (gif ? slot.video : slot.img).style.opacity = "0";
        if (here && slot.src) {
          const w = el.videoWidth || el.naturalWidth || 640;
          const h = el.videoHeight || el.naturalHeight || 360;
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          el.style.transform = quadTransform(w, h, here.quad);
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0";
        }
      });

      const overlay = overlayRef.current;
      if (overlay) {
        if (overlay.width !== cw || overlay.height !== ch) { overlay.width = cw; overlay.height = ch; }
        const ctx = overlay.getContext("2d");
        ctx.clearRect(0, 0, cw, ch);
        if (s.outline) onScreen.forEach(({ b, quad }) => {
          ctx.strokeStyle = s.locked ? "#7fb3ff" : COLORS[b.slot % COLORS.length];
          ctx.lineWidth = 3;
          ctx.beginPath();
          quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          quad.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); });
          ctx.font = "700 18px Inter, system-ui, sans-serif";
          ctx.fillText(`box ${b.slot + 1}`, quad[0].x + 8, quad[0].y - 10);
        });
      }

      if (now - lastRows > 200) {
        lastRows = now;
        setRows([
          ["boxes found this frame", String(foundCount), foundCount > 0],
          ...(s.source === "markers" ? [["markers seen (need 3 of 0–3)", markerNote || "none"]] : []),
          ["boxes on screen", `${boxes.length}${s.locked ? " (locked)" : ""} of up to ${s.source === "markers" ? 1 : s.maxBoxes}`, boxes.length > 0],
          ...[...boxes].sort((a, b) => a.slot - b.slot).map((b) => [`box ${b.slot + 1}`, `${b.content?.label || "–"}${s.pickBy === "color" && b.colorNote ? ` · ${b.colorNote}` : ""}`, !!b.content]),
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

  // The spoken word picks the clip (TR's lib/voice/speech.js: Chrome's Web Speech API).
  const stopRef = useRef(null);
  const toggleListening = useCallback(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; setListening(false); setVoiceState({ tone: "muted", text: "Stopped listening." }); return; }
    if (!speechSupported()) { setVoiceState({ tone: "error", text: "No speech recognition in this browser: use Chrome." }); return; }
    const watch = triggerWatcher(
      () => [...clips.map((c) => ({ say: c.word, clip: c })), { say: clearWord, clip: null }],
      (t) => { assign(t.clip); setHeard((h) => `→ ${t.say}   ${h}`.slice(0, 120)); },
      { cooldown: 1 },
    );
    stopRef.current = startListening({
      onResult: (r) => { watch(r); if (!r.final) setHeard(r.text.slice(-80)); },
      onState: (state) => setVoiceState({ tone: "ok", text: state === "listening" ? "Listening for the words." : "Listening (restarting)…" }),
      onError: (error) => setVoiceState({ tone: "error", text: error.message }),
    });
    setListening(true);
  }, [assign]);
  useEffect(() => () => stopRef.current?.(), []);

  // Your GIFs: anything in the repo-root _media/ (gitignored, this computer only) joins the menus.
  useEffect(() => {
    fetch("/draw-a-box/gifs").then((r) => r.json()).then(({ files }) => {
      const pretty = (src) => decodeURIComponent(src.split("/").pop()).replace(/\.gif$/i, "").replace(/[-_]+/g, " ");
      setLibrary([...clips, ...files.filter((f) => !clips.some((c) => c.src === f)).map((src) => ({ label: pretty(src), src }))]);
    }).catch(() => {});
  }, []);

  // Number keys put a clip in the target box; 0 empties it; L locks the boxes; F goes full screen.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.("input, select, textarea")) return;
      if (/^[1-9]$/.test(event.key) && library[Number(event.key) - 1]) assign(library[Number(event.key) - 1]);
      if (event.key === "0") assign(null);
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
      <ZoneLinks group="boxes" />
      <div className="cv-head">
        <p className="eyebrow">Draw a box</p>
        <h1>Draw a box, say a word.</h1>
        <p className="cv-lede">Draw boxes on paper under the camera (or hold up colored cards); a GIF plays in each. Say a word, click, or press 1–5 to pick. File to change: <code>app/draw-a-box/clips.js</code>. Flaky lines? <Link href="/draw-a-box/markers">Print markers</Link>.</p>
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
        <label><span>Pick by</span>
          <select value={pickBy} onChange={(e) => setPickBy(e.target.value)}>
            <option value="word">word, button, or key</option>
            <option value="color">card color</option>
          </select>
        </label>
        {source === "drawn" && <label><span>Boxes</span>
          <select value={maxBoxes} onChange={(e) => setMaxBoxes(Number(e.target.value))}>
            {Array.from({ length: MAX_BOXES }, (_, i) => <option key={i} value={i + 1}>up to {i + 1}</option>)}
          </select>
        </label>}
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
          {Array.from({ length: MAX_BOXES }, (_, i) => (
            <span key={i} className="box-slot">
              <video ref={(el) => { slotsRef.current[i] = { ...slotsRef.current[i], video: el }; }} className="box-clip" autoPlay loop muted playsInline />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={(el) => { slotsRef.current[i] = { ...slotsRef.current[i], img: el }; }} className="box-clip" alt="" />
            </span>
          ))}
          <canvas ref={overlayRef} className="box-overlay" />
        </div>
        <aside className="cv-side">
          {pickBy === "word" && (
            <div>
              <p className="eyebrow">Each box plays</p>
              <div className="box-menus">
                {Array.from({ length: source === "markers" ? 1 : maxBoxes }, (_, i) => (
                  <label key={i} className={target === i ? "is-target" : ""}>
                    <button type="button" aria-pressed={target === i} onClick={() => setTarget(i)} style={{ borderColor: COLORS[i] }}>box {i + 1}</button>
                    <select value={perBox[i] ?? ""} onChange={(e) => setPerBox((p) => p.map((v, k) => (k === i ? e.target.value || null : v)))}>
                      <option value="">(nothing)</option>
                      {library.map((c) => <option key={c.src} value={c.src}>{c.label}</option>)}
                    </select>
                  </label>
                ))}
                <button type="button" className="box-all" aria-pressed={target === "all"} onClick={() => setTarget("all")}>all boxes</button>
              </div>
            </div>
          )}
          <div>
            <p className="eyebrow">{pickBy === "word" ? `Launch into ${target === "all" ? "all boxes" : `box ${target + 1}`} (say the word, click, or press the number)` : "Clips"}</p>
            <div className="box-clips">
              {library.map((c, i) => <button key={c.src} type="button" aria-pressed={pickBy === "word" && (target === "all" ? perBox.every((v) => v === c.src) : perBox[target] === c.src)} onClick={() => assign(c)}>{i < 9 ? `${i + 1} · ` : ""}{c.word || c.label}</button>)}
              <button type="button" onClick={() => assign(null)}>0 · {clearWord}</button>
            </div>
            <p className="box-heard">{heard}</p>
            {pickBy === "color" && <p className="cv-muted">Cards: {cards.map((c) => `${c.color} → ${c.label.replace(/^.*?: /, "")}`).join(" · ")}</p>}
          </div>
          <p className="eyebrow">What OpenCV sees</p>
          <Readout rows={rows} />
          {showDebug && <canvas ref={debugRef} className="box-debug" />}
        </aside>
      </div>
    </div>
  );
}
