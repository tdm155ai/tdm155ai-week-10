"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectMidi, midiSupported, noteName } from "./midi.js";
import { useMic } from "../voice/mic.js";
import MicPicker from "../voice/MicPicker.jsx";

// /launch/inputs: is the input working? One small panel per input, each showing the raw numbers the browser gets,
// before anything is mapped to a cue: keys (key, code, modifiers), MIDI (note / CC / value), the microphone (level,
// frequency bands, waveform, loudest pitch), a sound file (the same, from a file), and the pointer. No stage needed.

const BANDS = [[20, 60, "sub"], [60, 250, "bass"], [250, 500, "low mid"], [500, 2000, "mid"], [2000, 4000, "high mid"], [4000, 6000, "presence"], [6000, 12000, "brilliance"], [12000, 20000, "air"]];

// Draws what an AnalyserNode hears: level, eight frequency bands, the waveform; reports the loudest frequency.
function Scope({ analyser, label }) {
  const canvas = useRef(null);
  const [read, setRead] = useState({ level: 0, peak: 0 });
  useEffect(() => {
    if (!analyser) return undefined;
    const c = canvas.current, g = c.getContext("2d");
    const freq = new Uint8Array(analyser.frequencyBinCount), wave = new Float32Array(analyser.fftSize);
    const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
    let raf, lastText = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2);
      analyser.getByteFrequencyData(freq);
      analyser.getFloatTimeDomainData(wave);
      let sum = 0;
      for (const v of wave) sum += v * v;
      const rms = Math.sqrt(sum / wave.length);
      let peakBin = 1;
      for (let i = 2; i < freq.length; i++) if (freq[i] > freq[peakBin]) peakBin = i;
      g.clearRect(0, 0, w, h);
      // bands, bottom two thirds
      const bandH = h * 0.62, bw = w / BANDS.length;
      g.font = `${Math.round(h * 0.05)}px ui-monospace, monospace`;
      BANDS.forEach(([lo, hi, name], i) => {
        let m = 0, n = 0;
        for (let b = Math.floor(lo / hzPerBin); b <= Math.min(freq.length - 1, Math.ceil(hi / hzPerBin)); b++) { m += freq[b]; n++; }
        const v = n ? m / n / 255 : 0;
        g.fillStyle = `hsl(${12 + i * 30}, 80%, 58%)`;
        g.fillRect(i * bw + 4, h - v * bandH, bw - 8, v * bandH);
        g.fillStyle = "rgba(255,255,255,.55)";
        g.fillText(name, i * bw + 6, h - 6);
      });
      // waveform, top third
      g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < wave.length; i += 4) { const x = (i / wave.length) * w, y = h * 0.17 + wave[i] * h * 0.16; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      if (now - lastText > 120) { lastText = now; setRead({ level: rms, peak: freq[peakBin] > 40 ? peakBin * hzPerBin : 0 }); }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  const db = read.level > 0 ? 20 * Math.log10(read.level) : -Infinity;
  return (
    <div>
      <canvas ref={canvas} className="diag-scope" aria-label={label} />
      <div className="diag-row">
        <span>level <b>{Number.isFinite(db) ? `${db.toFixed(0)} dB` : "silent"}</b></span>
        <span className="mic-meter" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, Math.sqrt(read.level) * 260)}%` }} /></span>
        <span>loudest <b>{read.peak ? `${Math.round(read.peak)} Hz` : "—"}</b></span>
      </div>
    </div>
  );
}

function useAudioContext() {
  const ref = useRef(null);
  const get = useCallback(() => { ref.current ??= new AudioContext(); ref.current.resume(); return ref.current; }, []);
  useEffect(() => () => { ref.current?.close(); ref.current = null; }, []);
  return get;
}

function KeysPanel() {
  const [last, setLast] = useState(null);
  const [held, setHeld] = useState([]);
  const [log, setLog] = useState([]);
  useEffect(() => {
    const down = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      const k = { key: e.key === " " ? "Space" : e.key, code: e.code, keyCode: e.keyCode, mods: ["Shift", "Control", "Alt", "Meta"].filter((m) => e.getModifierState(m)).join("+"), repeat: e.repeat };
      setLast(k);
      setHeld((h) => (h.includes(k.code) ? h : [...h, k.code]));
      if (!e.repeat) setLog((l) => [`${new Date().toLocaleTimeString()} ${k.key} (${k.code})`, ...l].slice(0, 6));
      if (e.code === "Space") e.preventDefault();
    };
    const up = (e) => setHeld((h) => h.filter((c) => c !== e.code));
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  return (
    <div className="ctl-panel">
      <h2>Keys</h2>
      <p className="diag-big">{last ? last.key : "press any key"}</p>
      <div className="diag-row"><span>code <b>{last?.code || "—"}</b></span><span>keyCode <b>{last?.keyCode ?? "—"}</b></span><span>modifiers <b>{last?.mods || "none"}</b></span><span>{last?.repeat ? "repeating (held)" : ""}</span></div>
      <div className="diag-row"><span>held now <b>{held.join(" ") || "nothing"}</b></span></div>
      <ul className="ctl-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="ctl-note">Cue pages match on <code>key</code> (what the key types). Use <code>code</code> for the physical key whatever the layout.</p>
    </div>
  );
}

function MidiPanel() {
  const [devices, setDevices] = useState(null);
  const [last, setLast] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const stop = useRef(null);
  useEffect(() => setSupported(midiSupported()), []);
  const connect = async () => {
    setError("");
    try {
      stop.current = await connectMidi({
        onDevices: setDevices,
        onMessage: (m) => { setLast(m); setLog((l) => [`${m.device}: ${m.type} ch${m.channel} ${m.type.startsWith("note") ? `${m.number} (${noteName(m.number)})` : m.number} = ${m.value}`, ...l].slice(0, 8)); },
      });
    } catch (e) { setError(e.message); }
  };
  useEffect(() => () => stop.current?.(), []);
  const max = last?.type === "pitchbend" ? 16383 : 127;
  return (
    <div className="ctl-panel">
      <h2>MIDI</h2>
      {!devices ? <button className="ctl-btn primary" onClick={connect} disabled={!supported}>Connect MIDI</button>
        : <p className="ctl-note" style={{ marginTop: 0 }}>{devices.length ? `Inputs: ${devices.map((d) => d.name).join(", ")}` : "Connected, but no controller found: plug one in (it shows up here)."}</p>}
      {!supported && <p className="ctl-note">No Web MIDI in this browser: use Chrome.</p>}
      {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
      <p className="diag-big">{last ? (last.type.startsWith("note") ? `${last.type === "noteon" ? "note on" : "note off"} ${last.number} · ${noteName(last.number)}` : `${last.type} ${last.number}`) : "hit a pad, turn a knob"}</p>
      <div className="diag-row"><span>channel <b>{last?.channel ?? "—"}</b></span><span>value <b>{last?.value ?? "—"}</b></span><span className="mic-meter" style={{ flex: 1 }}><span style={{ width: `${last ? (last.value / max) * 100 : 0}%` }} /></span></div>
      <ul className="ctl-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="ctl-note">Pads and keys are notes (MPK mini pads 36–43), knobs are CC (70–77), velocity and knob values 0–127. Map them on <a href="/launch/midi">/launch/midi</a>.</p>
    </div>
  );
}

function MicPanel() {
  const mic = useMic();
  const audio = useAudioContext();
  const [analyser, setAnalyser] = useState(null);
  const [error, setError] = useState("");
  const src = useRef(null);
  const start = async () => {
    setError("");
    try {
      const stream = await mic.open();
      const ctx = audio();
      const a = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.6;
      src.current = ctx.createMediaStreamSource(stream); src.current.connect(a); // not to the speakers: no feedback
      setAnalyser(a);
    } catch (e) { setError(e.message); }
  };
  const stop = () => { src.current?.disconnect(); src.current = null; mic.close(); setAnalyser(null); };
  return (
    <div className="ctl-panel">
      <h2>Microphone</h2>
      <MicPicker mic={mic} disabled={!!analyser} />
      <div className="ctl-row">{!analyser ? <button className="ctl-btn primary" onClick={start}>Listen</button> : <button className="ctl-btn on" onClick={stop}>Stop</button>}<span className="ctl-note">Whistle, clap, hum low then high: watch the bands and the loudest pitch.</span></div>
      {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
      <Scope analyser={analyser} label="microphone" />
    </div>
  );
}

function FilePanel() {
  const audio = useAudioContext();
  const [files, setFiles] = useState([]);
  const [src, setSrc] = useState("/samples/loop-house.wav");
  const [analyser, setAnalyser] = useState(null);
  const [playing, setPlaying] = useState(false);
  const el = useRef(null);
  const node = useRef(null);
  useEffect(() => {
    fetch("/media").then((r) => r.json()).then((d) => setFiles((d.files || []).filter((f) => /\.(wav|mp3|m4a|aac|ogg|flac|aiff?)$/i.test(f)))).catch(() => {});
    return () => { el.current?.pause(); };
  }, []);
  const ensure = () => {
    if (!el.current) {
      el.current = new Audio();
      el.current.loop = true;
      const ctx = audio();
      const a = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.6;
      node.current = ctx.createMediaElementSource(el.current);
      node.current.connect(a); a.connect(ctx.destination);
      setAnalyser(a);
    }
    return el.current;
  };
  const play = async (url = src) => { const a = ensure(); audio(); if (a.src !== new URL(url, location.href).href) a.src = url; await a.play().catch(() => {}); setPlaying(true); };
  const pause = () => { el.current?.pause(); setPlaying(false); };
  const pick = (e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setSrc(url); play(url); };
  return (
    <div className="ctl-panel">
      <h2>A sound file</h2>
      <div className="ctl-row">
        <select className="ctl-select" value={src} onChange={(e) => { setSrc(e.target.value); if (playing) play(e.target.value); }}>
          <option value="/samples/loop-house.wav">samples/loop-house.wav (the EDM loop)</option>
          <option value="/samples/chord.mp3">samples/chord.mp3</option>
          <option value="/samples/wind.mp3">samples/wind.mp3 (noise)</option>
          <option value="/samples/beep-a.mp3">samples/beep-a.mp3 (440 Hz)</option>
          {files.map((f) => <option key={f} value={f}>{decodeURIComponent(f.replace(/^\/media\//, ""))}</option>)}
          {src.startsWith("blob:") && <option value={src}>your file</option>}
        </select>
        {!playing ? <button className="ctl-btn primary" onClick={() => play()}>Play</button> : <button className="ctl-btn on" onClick={pause}>Pause</button>}
        <label className="ctl-btn">Choose a file…<input type="file" accept="audio/*" onChange={pick} hidden /></label>
      </div>
      <p className="ctl-note">The 440 Hz beep should read about 440 Hz; the noise lights every band; the loop pulses in the bass. Files in <code>_media/</code> show up in the menu.</p>
      <Scope analyser={analyser} label="sound file" />
    </div>
  );
}

function PointerPanel() {
  const [p, setP] = useState(null);
  const on = (e) => { const r = e.currentTarget.getBoundingClientRect(); setP({ x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height, pressure: e.pressure, type: e.pointerType, down: e.buttons > 0 }); };
  return (
    <div className="ctl-panel">
      <h2>Pointer / touch</h2>
      <div className="diag-pad" onPointerMove={on} onPointerDown={on} onPointerUp={on} onPointerLeave={() => setP(null)}>
        {p && <span className="diag-dot" style={{ left: `${p.x * 100}%`, top: `${(1 - p.y) * 100}%`, transform: `translate(-50%,-50%) scale(${p.down ? 1.6 : 1})` }} />}
      </div>
      <div className="diag-row"><span>x <b>{p ? p.x.toFixed(2) : "—"}</b></span><span>y <b>{p ? p.y.toFixed(2) : "—"}</b></span><span>{p?.down ? "pressed" : "up"}</span><span>{p?.type || ""}{p && p.pressure ? ` · pressure ${p.pressure.toFixed(2)}` : ""}</span></div>
    </div>
  );
}

export default function InputDiagnostics() {
  return (
    <div className="diag-grid">
      <KeysPanel />
      <MidiPanel />
      <MicPanel />
      <FilePanel />
      <PointerPanel />
      <div className="ctl-panel">
        <h2>More inputs, each with its own check</h2>
        <ul className="ctl-log" style={{ maxHeight: "none" }}>
          <li><b>Words</b>: <a href="/voice/words">/voice/words</a> shows what Chrome hears and which word matched</li>
          <li><b>Meaning</b>: <a href="/voice/semantic">/voice/semantic</a> shows the topic the model chose and how sure it is</li>
          <li><b>Hands, face, body</b>: <a href="/track">/track</a> draws what MediaPipe sees</li>
          <li><b>A drawn box</b>: <a href="/draw-a-box">/draw-a-box</a>, “Show what OpenCV sees”</li>
        </ul>
      </div>
    </div>
  );
}
