"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHANNEL } from "./stage.js";
import { createFx, FX_PARAMS } from "./fx.js";

// The stage player: listens on the stage channel and plays cues. /stage shows it full screen; /launch embeds a small,
// muted copy as a preview (preview: true), so the sound comes only from the real stage window.

const clamp = (v) => Math.max(0, Math.min(1, v));
const OUTPUT_STORE = "tdm155ai-stage-output";
const HERE_STORE = "tdm155ai-sound-here"; // "off" = the preview on control pages never plays sound
const VIDEO_PARAMS = ["scrub", "speed", "play"];

// Send an <audio> or <video> element's sound to a chosen output (the PA, the projector's HDMI) instead of the Mac's
// default. "" = the default. Chrome only (setSinkId); elsewhere it plays on the default.
function routeTo(el, sinkId) {
  const want = sinkId || "";
  if (!el?.setSinkId || (el._sink ?? el.sinkId ?? "") === want) return;
  el._sink = want; // a call is on its way: don't repeat it on every render
  el.setSinkId(want).catch((err) => { el._sink = undefined; console.warn("[stage] couldn't use that output:", err.message); });
}

// Fade an <audio> or <video> element's volume to `to` over `seconds`, then call done.
function fadeVolume(el, to, seconds, done) {
  if (el._fade) cancelAnimationFrame(el._fade);
  const from = el.volume;
  const start = performance.now();
  const ms = Math.max(0, seconds * 1000);
  const step = (now) => {
    const t = ms ? Math.min(1, (now - start) / ms) : 1;
    el.volume = clamp(from + (to - from) * t);
    if (t < 1) el._fade = requestAnimationFrame(step);
    else { el._fade = null; done?.(); }
  };
  el._fade = requestAnimationFrame(step);
}

export default function Stage({ preview = false }) {
  const [layers, setLayers] = useState([]); // pictures: the newest is on top, older ones fade out underneath
  const [params, setParams] = useState({ master: 1, opacity: 1, brightness: 1, hue: 0 });
  const [started, setStarted] = useState(preview);
  const [last, setLast] = useState(null);
  // The preview on a control page plays the sound itself while no started stage window is answering, so you hear
  // something without opening /stage; once a stage window is running, the preview goes quiet (no doubled sound).
  const [here, setHere] = useState("auto"); // "auto" | "off"
  const [stageRunning, setStageRunning] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const hereRef = useRef(false);
  const lastStatus = useRef({ at: 0, started: false });
  useEffect(() => { try { setHere(localStorage.getItem(HERE_STORE) === "off" ? "off" : "auto"); } catch {} }, []);
  useEffect(() => { hereRef.current = preview && here === "auto" && !stageRunning; }, [preview, here, stageRunning]);
  const sounds = useRef(new Map()); // id -> { el, volume }
  const masterRef = useRef(1);
  const busRef = useRef(null);
  const rootRef = useRef(null);
  const [sink, setSink] = useState("");
  const [showOutputs, setShowOutputs] = useState(false);
  const sinkRef = useRef("");
  const ctxRef = useRef(null); // Web Audio, made on the first click; the effects are built the first time they're used
  const fxRef = useRef(null);

  // Send an element's sound through the effects (filter, echo). Only files from this site (/samples, /media, a file
  // you picked): the browser won't let Web Audio touch other sites' audio.
  const throughFx = useCallback((el) => {
    const ctx = ctxRef.current, fx = fxRef.current;
    if (!ctx || !fx || !el || el._fxSource) return;
    let url;
    try { url = new URL(el.currentSrc || el.src, location.href); } catch { return; }
    if (url.origin !== location.origin && url.protocol !== "blob:") return;
    el._fxSource = ctx.createMediaElementSource(el);
    el._fxSource.connect(fx.input);
  }, []);
  const ensureFx = useCallback(() => {
    if (preview) return null;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (!fxRef.current) {
      fxRef.current = createFx(ctx);
      if (sinkRef.current && ctx.setSinkId) ctx.setSinkId(sinkRef.current).catch(() => {});
      for (const s of sounds.current.values()) throughFx(s.el);
      rootRef.current?.querySelectorAll("video").forEach((v) => { if (!v.muted) throughFx(v); });
    }
    return fxRef.current;
  }, [preview, throughFx]);
  useEffect(() => {
    if (preview) return;
    try { const id = localStorage.getItem(OUTPUT_STORE) || ""; sinkRef.current = id; setSink(id); } catch {}
  }, [preview]);
  const chooseOutput = useCallback((id) => {
    sinkRef.current = id; setSink(id);
    try { id ? localStorage.setItem(OUTPUT_STORE, id) : localStorage.removeItem(OUTPUT_STORE); } catch {}
    for (const s of sounds.current.values()) routeTo(s.el, id);
    if (fxRef.current && ctxRef.current?.setSinkId) ctxRef.current.setSinkId(id || "").catch(() => {}); // effects play out of Web Audio
    rootRef.current?.querySelectorAll("video").forEach((v) => routeTo(v, id));
  }, []);

  const stopSounds = useCallback((fadeOut = 1, target) => {
    for (const [id, s] of sounds.current) {
      if (target && id !== target) continue;
      fadeVolume(s.el, 0, fadeOut, () => { s.el.pause(); s.el.src = ""; });
      sounds.current.delete(id);
    }
  }, []);

  const playSound = useCallback((cue) => {
    const o = cue.options || {};
    const old = sounds.current.get(cue.id);
    if (old) { old.el.pause(); old.el.src = ""; }
    if (preview && !hereRef.current) return; // a running stage window plays it (or sound here is off)
    const el = new Audio(cue.src);
    routeTo(el, sinkRef.current);
    throughFx(el);
    el.loop = !!o.loop;
    const volume = clamp(o.volume ?? 1);
    el.volume = o.fadeIn ? 0 : volume * masterRef.current;
    const entry = { el, volume };
    sounds.current.set(cue.id, entry);
    el.play().then(() => {
      if (o.fadeIn) fadeVolume(el, volume * masterRef.current, o.fadeIn);
    }).catch((err) => { if (err.name === "NotAllowedError") setBlocked(true); else console.warn("[stage] sound:", err.message); });
    if (o.fadeOut && !o.loop) {
      el.addEventListener("loadedmetadata", () => {
        const at = Math.max(0, (el.duration - o.fadeOut) * 1000);
        setTimeout(() => sounds.current.get(cue.id) === entry && fadeVolume(el, 0, o.fadeOut), at);
      });
    }
    el.addEventListener("ended", () => { if (sounds.current.get(cue.id) === entry) sounds.current.delete(cue.id); });
  }, [preview, throughFx]);

  const showPicture = useCallback((cue) => {
    const key = `${cue.id}-${Date.now()}`;
    const fade = cue.options?.fadeIn ?? 0.3;
    setLayers((prev) => [...prev.slice(-2), { key, cue, fade, visible: false }]);
    // Next frame: fade the new one in; after the fade, drop the ones underneath.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, visible: true } : l)));
    }));
    setTimeout(() => setLayers((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      return i > 0 ? prev.slice(i) : prev;
    }), fade * 1000 + 100);
  }, []);

  const play = useCallback((cue) => {
    setLast(cue);
    const o = cue.options || {};
    switch (cue.kind) {
      case "sound": playSound(cue); break;
      case "stop": stopSounds(o.fadeOut ?? 1, o.target); break;
      case "blackout":
        stopSounds(o.fadeOut ?? 1);
        if (cue.id === "panic" && fxRef.current) for (const [k, v] of Object.entries({ filter: 0.5, resonance: 0, echo: 0 })) fxRef.current.set(k, v); // panic: effects back to neutral
        showPicture({ ...cue, kind: "color", src: "#000", options: { fadeIn: o.fadeOut ?? 1 } });
        break;
      case "video": case "image": case "text": case "color": showPicture(cue); break;
      default: console.warn("[stage] unknown cue kind:", cue.kind);
    }
  }, [playSound, stopSounds, showPicture]);

  useEffect(() => {
    const bus = new BroadcastChannel(CHANNEL);
    busRef.current = bus;
    bus.onmessage = ({ data }) => {
      if (!data) return;
      if (data.type === "cue") play(data.cue);
      if (data.type === "param" && FX_PARAMS.includes(data.name)) { ensureFx()?.set(data.name, data.value); return; }
      if (data.type === "param" && VIDEO_PARAMS.includes(data.name)) {
        // The video on top: scrub (position 0–1, holds the frame), speed (0.5 = normal), play (on/off at 0.5).
        const videos = rootRef.current?.querySelectorAll("video");
        const v = videos?.[videos.length - 1];
        if (!v) return;
        if (data.name === "scrub" && v.duration) { v.pause(); v.currentTime = data.value * v.duration * 0.999; }
        if (data.name === "speed") { v.playbackRate = 0.25 * 16 ** data.value; v.play().catch(() => {}); }
        if (data.name === "play") { if (data.value >= 0.5) v.play().catch(() => {}); else v.pause(); }
        return;
      }
      if (data.type === "param") {
        setParams((p) => ({ ...p, [data.name]: data.value }));
        if (data.name === "master") {
          masterRef.current = data.value;
          for (const s of sounds.current.values()) if (!s.el._fade) s.el.volume = clamp(s.volume * data.value);
        }
      }
      if (data.type === "status" && preview) lastStatus.current = { at: Date.now(), started: !!data.started };
      if (data.type === "ping" && !preview) bus.postMessage({ type: "status", open: true, started, fx: fxRef.current ? { ...fxRef.current.state } : null, sink: !!sinkRef.current, at: Date.now() });
    };
    if (!preview) bus.postMessage({ type: "status", open: true, started, fx: fxRef.current ? { ...fxRef.current.state } : null, sink: !!sinkRef.current, at: Date.now() });
    return () => bus.close();
  }, [play, preview, started, ensureFx]);

  useEffect(() => {
    if (!preview) return undefined;
    const bus = new BroadcastChannel(CHANNEL);
    const check = () => {
      bus.postMessage({ type: "ping", at: Date.now() });
      setStageRunning(Date.now() - lastStatus.current.at < 5000 && lastStatus.current.started);
    };
    check();
    const timer = setInterval(check, 2000);
    return () => { clearInterval(timer); bus.close(); };
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    const onKey = (e) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else rootRef.current?.requestFullscreen?.();
      }
      if (e.key === "Escape") play({ id: "panic", kind: "blackout", options: { fadeOut: 0.5 } });
      if ((e.key === "o" || e.key === "O") && !e.target.closest?.("select")) setShowOutputs((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, preview]);

  const start = () => {
    setStarted(true);
    if (!ctxRef.current) ctxRef.current = new AudioContext(); // made inside the click, so the browser lets it play
    // A click here gives this window permission to play sound; full screen too.
    rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const filter = `brightness(${params.brightness}) hue-rotate(${Math.round(params.hue * 360)}deg)`;

  return (
    <div ref={rootRef} className={preview ? "stage stage-preview" : "stage"} onDoubleClick={() => !preview && rootRef.current?.requestFullscreen?.()}>
      <div className="stage-picture" style={{ opacity: params.opacity, filter }}>
        {layers.map(({ key, cue, fade, visible }) => (
          <div key={key} className="stage-layer" style={{ opacity: visible ? 1 : 0, transition: `opacity ${fade}s linear` }}>
            <Picture cue={cue} preview={preview} master={params.master} sink={sink} fx={throughFx} />
          </div>
        ))}
      </div>
      {!started && (
        <button className="stage-start" onClick={start}>
          <strong>Click to start the stage</strong>
          <span>Turns on sound and goes full screen. F toggles full screen, Esc blacks out, O picks the sound output. Fire cues from /launch, /voice, /track in another tab.</span>
        </button>
      )}
      {!preview && (!started || showOutputs) && <OutputMenu sink={sink} onChange={chooseOutput} onClose={started ? () => setShowOutputs(false) : null} />}
      {preview && <span className="stage-preview-label">{last ? `${last.kind}: ${last.label}` : "stage preview"}</span>}
      {preview && (
        <button className={`stage-here${blocked ? " blocked" : ""}`} title="Where the sound plays"
          onClick={() => { if (blocked) { setBlocked(false); return; } const next = here === "off" ? "auto" : "off"; setHere(next); try { localStorage.setItem(HERE_STORE, next); } catch {} }}>
          {blocked ? "🔇 click to hear sound" : stageRunning ? "🔈 sound: stage window" : here === "off" ? "🔇 sound off here" : "🔊 sound: this page"}
        </button>
      )}
    </div>
  );
}

// Where the stage's sound goes. Device names appear once this site has had microphone permission (any /voice page),
// or after "Show names".
function OutputMenu({ sink, onChange, onClose }) {
  const [outputs, setOutputs] = useState([]);
  const [supported, setSupported] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setOutputs(devices.filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default").map((d) => ({ id: d.deviceId, label: d.label })));
    } catch {}
  }, []);
  useEffect(() => {
    setSupported("setSinkId" in HTMLMediaElement.prototype);
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);
  const unnamed = outputs.some((o) => !o.label);
  const showNames = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch {}
    refresh();
  };
  const test = () => { const a = new Audio("/samples/ping.mp3"); routeTo(a, sink); a.play().catch(() => {}); };
  return (
    <div className="stage-outputs" onClick={(e) => e.stopPropagation()}>
      <label>Sound out{" "}
        <select value={sink} onChange={(e) => onChange(e.target.value)} disabled={!supported}>
          <option value="">The Mac's default output</option>
          {outputs.map((o, i) => <option key={o.id} value={o.id}>{o.label || `Output ${i + 1}`}</option>)}
        </select>
      </label>
      {unnamed && <button onClick={showNames}>Show names</button>}
      <button onClick={test}>Test (ping)</button>
      {onClose && <button onClick={onClose}>Done (O)</button>}
      {!supported && <span>This browser can't choose an output: use Chrome, or set the Mac's output in System Settings › Sound.</span>}
    </div>
  );
}

function Picture({ cue, preview, master, sink, fx }) {
  const o = cue.options || {};
  const fit = o.fit || "cover";
  if (cue.kind === "color") return <div className="stage-fill" style={{ background: cue.src || "#000" }} />;
  if (cue.kind === "image") return <img className="stage-fill" src={cue.src} alt={cue.label || ""} style={{ objectFit: fit }} />;
  if (cue.kind === "video") {
    const muted = preview || o.muted !== false;
    return (
      <video className="stage-fill" src={cue.src} autoPlay playsInline loop={!!o.loop} muted={muted} style={{ objectFit: fit }}
        ref={(el) => { if (el && !muted) { el.volume = clamp((o.volume ?? 1) * master); routeTo(el, sink); fx?.(el); } }} />
    );
  }
  if (cue.kind === "text") {
    return (
      <div className="stage-fill stage-text" style={{ background: o.background || "#000", color: o.color || "#fff", fontSize: o.size || "9vw", fontFamily: o.font || undefined }}>
        <span>{o.text ?? cue.src}</span>
      </div>
    );
  }
  return null;
}
