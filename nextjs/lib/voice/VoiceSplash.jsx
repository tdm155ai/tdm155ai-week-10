"use client";

// /voice/shaders: three spoken commands run a little show. "hit it" starts the dance loop, "splash" throws a fluid
// burst over the camera, "stop" stops the music at once, clears the splash, puts STOP on your forehead, then goes black.
// The words are in ./splash-words.js (the file to change). This file is the machinery: listening (the same matcher as
// /voice/words), the music, the burst, and full screen. The fluid is React Bits' SplashCursor (lib/cv/react-bits/),
// drawn see-through over the camera: a burst is a click it already understands plus jets it follows as "trackers", the
// way /track/effects/splash follows a hand. The camera with "Dance!!" and "STOP" on your forehead is CV's
// lib/cv/DanceCamera.jsx. Nothing needs a stage window: this page is the show.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SplashCursor from "../cv/react-bits/SplashCursor.jsx";
import DanceCamera from "../cv/DanceCamera.jsx";
import { startWebSpeech, useMic } from "./mic.js";
import MicPicker from "./MicPicker.jsx";
import { speechSupported, triggerWatcher } from "./speech.js";
import { BUTTON, MUSIC, REARM_SECONDS, RESET_SECONDS, effects, words } from "./splash-words.js";

const BLACK = { r: 0, g: 0, b: 0 };
const QUALITY = { SIM_RESOLUTION: 64, DYE_RESOLUTION: 512, PRESSURE_ITERATIONS: 10 }; // one light simulation
const RESTING = { radius: 0.25, rainbow: true, color: "#ffffff" };
const FRAMES = 14; // how many frames a burst's jets keep pushing
const STOP_MS = 4000; // how long STOP stays on the camera (3 s hold + 1 s fade) before the screen goes black

const hue = (h) => {
  const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

function place(at) {
  if (Array.isArray(at)) return at;
  if (at === "random") return [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
  return [0.5, 0.5];
}

// The loop: decoded once, played as a looping buffer so it starts and stops on the spot.
function useLoop(src) {
  const ctx = useRef(null);
  const buffer = useRef(null);
  const source = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("sound off: press Start");

  // Call from a click: browsers only let a page make sound after one.
  const unlock = useCallback(async () => {
    if (!ctx.current) ctx.current = new AudioContext();
    await ctx.current.resume();
    if (!buffer.current) {
      setStatus("loading the loop…");
      try { buffer.current = await ctx.current.decodeAudioData(await (await fetch(src)).arrayBuffer()); setStatus("sound ready: say “hit it”"); }
      catch (e) { setStatus(`couldn't load ${src}: ${e.message}`); }
    }
  }, [src]);

  const play = useCallback(async () => {
    await unlock();
    if (!buffer.current || source.current) return;
    const s = ctx.current.createBufferSource();
    s.buffer = buffer.current;
    s.loop = true;
    s.connect(ctx.current.destination);
    s.start();
    source.current = s;
    setPlaying(true);
    setStatus("▶ playing (looping)");
  }, [unlock]);

  const stop = useCallback(() => {
    try { source.current?.stop(); } catch {}
    source.current?.disconnect();
    source.current = null;
    setPlaying(false);
    if (buffer.current) setStatus("■ stopped");
  }, []);

  useEffect(() => () => { try { source.current?.stop(); } catch {} ctx.current?.close(); }, []);
  return { playing, status, unlock, play, stop };
}

export default function VoiceSplash() {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const trackers = useRef(null);
  const timers = useRef(new Set());
  const blackTimer = useRef(null);
  const [look, setLook] = useState(RESTING);
  const [generation, setGeneration] = useState(0);
  const [mouse, setMouse] = useState(false);
  const [camera, setCamera] = useState(false);
  const [camStatus, setCamStatus] = useState("");
  const [black, setBlack] = useState(false);
  const [stops, setStops] = useState(0);
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [heard, setHeard] = useState(""); // the latest thing Chrome wrote down
  const [last, setLast] = useState(null); // { say, label, how, at }
  const [count, setCount] = useState(0);
  const [typed, setTyped] = useState("");
  const mic = useMic();
  const loop = useLoop(MUSIC);
  const stopRef = useRef(null);
  const typedIndex = useRef(0);
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  useEffect(() => { setSupported(speechSupported()); }, []);

  // Start fresh every RESET_SECONDS; Reset starts fresh at once (and restarts the timer).
  const reset = useCallback(() => setGeneration((g) => g + 1), []);
  useEffect(() => {
    const timer = setInterval(reset, RESET_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [generation, reset]);

  const later = (fn, ms) => { const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms); timers.current.add(t); };
  const nextFrames = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn)); // after the new look reaches the simulation
  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(blackTimer.current); trackers.current = null; }, []);

  const reveal = useCallback(() => { clearTimeout(blackTimer.current); setBlack(false); }, []);

  // One splash at x, y (0 to 1): a bright drop where it lands, then jets thrown outward for FRAMES frames.
  const splashAt = useCallback((fx, x, y) => {
    const host = layerRef.current?.firstElementChild; // SplashCursor listens for clicks on this element
    if (!host) return;
    const r = host.getBoundingClientRect();
    const squash = r.height / r.width; // keeps the burst round on a wide screen
    const palette = (i, n) => (fx.colors === "rainbow" ? hue((i / n + Math.random() * 0.1) % 1) : fx.colors[i % fx.colors.length]);
    for (let i = 0; i < fx.drops; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * fx.spread * 0.25;
      host.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + (x + Math.cos(a) * d * squash) * r.width, clientY: r.top + (y + Math.sin(a) * d) * r.height }));
    }
    const spin = Math.random() * Math.PI * 2;
    const jets = Array.from({ length: fx.streams }, (_, i) => ({ a: spin + (i / fx.streams) * Math.PI * 2 + (Math.random() - 0.5) * 0.3, x, y, active: true, color: palette(i, fx.streams) }));
    // Tracker 0 stays idle: it's the simulation's mouse pointer, which the clicks above just moved.
    const list = [{ x: 0, y: 0, active: false }, ...jets];
    trackers.current = list;
    let frame = 0;
    const tick = () => {
      if (trackers.current !== list) return; // a newer splash took over
      frame += 1;
      const reach = fx.spread * (1 - (1 - frame / FRAMES) ** 2); // fast at first, then easing off
      for (const j of jets) { j.x = x + Math.cos(j.a) * reach * squash; j.y = y + Math.sin(j.a) * reach; }
      if (frame < FRAMES) requestAnimationFrame(tick);
      else { for (const j of jets) j.active = false; requestAnimationFrame(() => { if (trackers.current === list) trackers.current = null; }); }
    };
    requestAnimationFrame(tick);
  }, []);

  const burst = useCallback((name, at) => {
    const fx = effects[name];
    if (!fx) return;
    reveal();
    setLook({ radius: fx.radius, rainbow: fx.colors === "rainbow", color: fx.colors === "rainbow" ? RESTING.color : fx.colors[0] });
    const times = fx.repeat || 1;
    nextFrames(() => {
      for (let i = 0; i < times; i++) later(() => { const [x, y] = at && i === 0 ? at : place(fx.at); splashAt(fx, x, y); }, i * (fx.gap || 250));
      later(() => setLook(RESTING), times * (fx.gap || 250) + 600);
    });
  }, [splashAt, reveal]);

  const play = useCallback(() => { reveal(); loop.play(); }, [loop, reveal]);

  // Stop: the music stops at once and the splash is wiped. With the camera on, STOP shows on your forehead, then black.
  const stopShow = useCallback(() => {
    loop.stop();
    trackers.current = null;
    setGeneration((g) => g + 1);
    setStops((n) => n + 1);
    clearTimeout(blackTimer.current);
    if (cameraRef.current) blackTimer.current = setTimeout(() => setBlack(true), STOP_MS);
    else setBlack(true);
  }, [loop]);

  const run = useCallback((t, how) => {
    if (t.command === "play") play();
    else if (t.command === "stop") stopShow();
    else burst(t.effect || t.command);
    setCount((c) => c + 1);
    const label = t.command === "play" ? "music on" : t.command === "stop" ? "stop" : effects[t.effect || t.command]?.label || t.effect;
    setLast({ say: t.say, label, how, at: new Date().toLocaleTimeString() });
  }, [play, stopShow, burst]);
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);

  // The matcher from /voice: whole words, as soon as Chrome writes them down, once per place they were said.
  const watch = useMemo(() => triggerWatcher(
    () => words,
    (t, info) => runRef.current(t, info.final ? "heard" : "heard (while still talking)"),
    { cooldown: REARM_SECONDS },
  ), []);

  const onResult = useCallback((r) => { watch(r); setHeard(r.text); }, [watch]);

  // Start: one click unlocks the sound, turns on the camera, and starts listening.
  const start = async () => {
    setError(""); setState("starting"); setCamera(true);
    loop.unlock();
    stopRef.current = await startWebSpeech(mic, { onResult, onState: setState, onError: (e) => setError(e.message) });
  };
  const stopListening = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  useEffect(() => () => stopRef.current?.(), []);
  const listening = !["off", "stopped"].includes(state);

  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    loop.unlock();
    typedIndex.current += 1;
    onResult({ index: typedIndex.current, text: typed, final: true, session: "typed", at: performance.now() });
    setTyped("");
  };

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea, button")) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "r" || e.key === "R") reset();
      if (e.key === " ") { e.preventDefault(); run({ say: BUTTON, effect: BUTTON }, "Space bar"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // A click on the stage splashes where you clicked (unless "Mouse stirs" hands the mouse to the simulation).
  const onStageDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    burst(BUTTON, [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
    setCount((c) => c + 1);
    setLast({ say: "(click)", label: effects[BUTTON]?.label, how: "click", at: new Date().toLocaleTimeString() });
  };

  const say = (command) => words.find((w) => w.command === command)?.say || command;

  return (
    <div className="vsplash">
      <div className="ctl-row vsplash-bar">
        {!listening
          ? <button className="ctl-btn primary vsplash-big" onClick={start} disabled={!supported}>🎙 Start (mic, camera, sound)</button>
          : <button className="ctl-btn on vsplash-big" onClick={stopListening}>■ Stop listening</button>}
        <button className="ctl-btn vsplash-big" onClick={() => { loop.unlock(); run({ say: say("play"), command: "play" }, "button"); }}>▶ {say("play")}</button>
        <button className="ctl-btn vsplash-big" onClick={() => run({ say: BUTTON, effect: BUTTON }, "button")}>💦 {BUTTON}</button>
        <button className="ctl-btn vsplash-big" onClick={() => run({ say: say("stop"), command: "stop" }, "button")}>■ {say("stop")}</button>
      </div>
      <div className="ctl-row vsplash-bar">
        <span className={listening ? "ctl-status ok" : "ctl-status"}>{state === "listening" ? "● listening" : listening ? `● ${state}` : "○ not listening"}</span>
        <span className={loop.playing ? "ctl-status ok" : "ctl-status"}>{loop.status}</span>
        {camera && camStatus && <span className="ctl-status">camera: {camStatus}</span>}
        <span className="ctl-spacer" />
        <label className="ctl-note"><input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} /> Camera</label>
        <label className="ctl-note"><input type="checkbox" checked={mouse} onChange={(e) => setMouse(e.target.checked)} /> Mouse stirs</label>
        <button className="ctl-btn" onClick={reset}>Reset (R)</button>
        <button className="ctl-btn" onClick={toggleFullscreen}>Full screen (F)</button>
      </div>

      <div ref={stageRef} className="vsplash-stage">
        <DanceCamera active={camera} playing={loop.playing} stopToken={stops} showStatus={false} onStatus={setCamStatus} />
        <div ref={layerRef} className="vsplash-layer" key={`layer-${generation}`}>
          <SplashCursor trackers={trackers} {...QUALITY} CURL={4} DENSITY_DISSIPATION={1.8} VELOCITY_DISSIPATION={1.6} SPLAT_FORCE={3500}
            SPLAT_RADIUS={look.radius} RAINBOW_MODE={look.rainbow} COLOR={look.color} BACK_COLOR={BLACK} TRANSPARENT />
        </div>
        {black && <div className="vsplash-black" />}
        {!mouse && <div className="vsplash-catch" onPointerDown={onStageDown} />}
        {last && <p className="vsplash-word" key={`word-${count}`}>{last.say}</p>}
        <p className="vsplash-hint">{listening ? `say: ${words.map((w) => w.say).join(" · ")}` : "press Start, or use the buttons"} · matches: {count}</p>
      </div>

      <div className="ctl-grid" style={{ marginTop: 18 }}>
        <div className="ctl-panel">
          <h2>Listen</h2>
          <MicPicker mic={mic} disabled={listening} webSpeech />
          {!supported && <p className="ctl-note">No speech recognition in this browser. Use Chrome, or type below.</p>}
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="transcript" aria-live="polite"><p className={heard ? "" : "interim"}>{heard || "What Chrome hears shows up here."}</p></div>
          <form className="ctl-row" onSubmit={sendTyped} style={{ marginTop: 10 }}>
            <input className="ctl-input" style={{ flex: 1 }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="No mic? Type “hit it”, “splash” or “stop” and press Enter" />
          </form>
        </div>
        <div className="ctl-panel">
          <h2>Last match</h2>
          {last ? <p className="words-last"><b>“{last.say}”</b> → {last.label}<small>{last.at} · {last.how} · {count} so far</small></p> : <p className="ctl-note">Nothing yet.</p>}
          <table className="words-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Say</th><th>Does</th><th /></tr></thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.say} className={last?.say === w.say ? "words-hit" : ""}>
                  <td>{w.say}</td><td>{w.command === "play" ? "start the music (loops)" : w.command === "stop" ? "stop the music, STOP, then black" : effects[w.effect]?.label || w.effect}</td>
                  <td><button className="ctl-btn" onClick={() => { loop.unlock(); run(w, "Test button"); }}>Test</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ctl-note">Change the words, the music and the splashes in <code>nextjs/lib/voice/splash-words.js</code>. The splash starts fresh every {RESET_SECONDS} seconds.</p>
        </div>
      </div>
    </div>
  );
}
