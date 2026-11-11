"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHANNEL } from "./stage.js";

// The stage player: listens on the stage channel and plays cues. /stage shows it full screen; /launch embeds a small,
// muted copy as a preview (preview: true), so the sound comes only from the real stage window.

const clamp = (v) => Math.max(0, Math.min(1, v));

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
  const sounds = useRef(new Map()); // id -> { el, volume }
  const masterRef = useRef(1);
  const busRef = useRef(null);
  const rootRef = useRef(null);

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
    if (preview) return; // the preview stays silent
    const el = new Audio(cue.src);
    el.loop = !!o.loop;
    const volume = clamp(o.volume ?? 1);
    el.volume = o.fadeIn ? 0 : volume * masterRef.current;
    const entry = { el, volume };
    sounds.current.set(cue.id, entry);
    el.play().then(() => {
      if (o.fadeIn) fadeVolume(el, volume * masterRef.current, o.fadeIn);
    }).catch((err) => console.warn("[stage] sound blocked:", err.message));
    if (o.fadeOut && !o.loop) {
      el.addEventListener("loadedmetadata", () => {
        const at = Math.max(0, (el.duration - o.fadeOut) * 1000);
        setTimeout(() => sounds.current.get(cue.id) === entry && fadeVolume(el, 0, o.fadeOut), at);
      });
    }
    el.addEventListener("ended", () => { if (sounds.current.get(cue.id) === entry) sounds.current.delete(cue.id); });
  }, [preview]);

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
      if (data.type === "param") {
        setParams((p) => ({ ...p, [data.name]: data.value }));
        if (data.name === "master") {
          masterRef.current = data.value;
          for (const s of sounds.current.values()) if (!s.el._fade) s.el.volume = clamp(s.volume * data.value);
        }
      }
      if (data.type === "ping" && !preview) bus.postMessage({ type: "status", open: true, started, at: Date.now() });
    };
    if (!preview) bus.postMessage({ type: "status", open: true, started, at: Date.now() });
    return () => bus.close();
  }, [play, preview, started]);

  useEffect(() => {
    if (preview) return;
    const onKey = (e) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else rootRef.current?.requestFullscreen?.();
      }
      if (e.key === "Escape") play({ id: "panic", kind: "blackout", options: { fadeOut: 0.5 } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, preview]);

  const start = () => {
    setStarted(true);
    // A click here gives this window permission to play sound; full screen too.
    rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const filter = `brightness(${params.brightness}) hue-rotate(${Math.round(params.hue * 360)}deg)`;

  return (
    <div ref={rootRef} className={preview ? "stage stage-preview" : "stage"} onDoubleClick={() => !preview && rootRef.current?.requestFullscreen?.()}>
      <div className="stage-picture" style={{ opacity: params.opacity, filter }}>
        {layers.map(({ key, cue, fade, visible }) => (
          <div key={key} className="stage-layer" style={{ opacity: visible ? 1 : 0, transition: `opacity ${fade}s linear` }}>
            <Picture cue={cue} preview={preview} master={params.master} />
          </div>
        ))}
      </div>
      {!started && (
        <button className="stage-start" onClick={start}>
          <strong>Click to start the stage</strong>
          <span>Turns on sound and goes full screen. F toggles full screen, Esc blacks out. Fire cues from /launch, /voice, /track in another tab.</span>
        </button>
      )}
      {preview && <span className="stage-preview-label">{last ? `${last.kind}: ${last.label}` : "stage preview"}</span>}
    </div>
  );
}

function Picture({ cue, preview, master }) {
  const o = cue.options || {};
  const fit = o.fit || "cover";
  if (cue.kind === "color") return <div className="stage-fill" style={{ background: cue.src || "#000" }} />;
  if (cue.kind === "image") return <img className="stage-fill" src={cue.src} alt={cue.label || ""} style={{ objectFit: fit }} />;
  if (cue.kind === "video") {
    const muted = preview || o.muted !== false;
    return (
      <video className="stage-fill" src={cue.src} autoPlay playsInline loop={!!o.loop} muted={muted} style={{ objectFit: fit }}
        ref={(el) => { if (el && !muted) el.volume = clamp((o.volume ?? 1) * master); }} />
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
