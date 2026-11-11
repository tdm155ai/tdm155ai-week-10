"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onStage, setParam } from "../stage/stage.js";
import { createFx, describeFilter, FX_PARAMS } from "../stage/fx.js";
import { LABELS, PARTS, PATTERN, renderLoop } from "./loop.js";
import { connectMidi } from "./midi.js";
import HandPad from "./HandPad.jsx";
import { bend as bendParam, dials } from "./midi-map.js";

// /launch/xy: a Kaoss-pad-style XY pad over an EDM loop made in the browser (lib/launch/loop.js) or a file of yours
// (_media/). The loop plays as stems that stay locked together, so parts switch on and off in time. The pad moves
// the filter and echo by sending setParam("filter" | "resonance" | "echo" | "echoTime") on the stage bus, so a MIDI
// knob or a hand on /track does the same thing, and the stage window's own sounds are filtered too.

const MODES = {
  filter: { label: "Filter", x: "filter", y: "resonance", hint: "← low-pass · middle = off · high-pass →, up = more resonance" },
  echo: { label: "Echo", x: "echoTime", y: "echo", hint: "← short · long →, up = more echo" },
  both: { label: "Filter + echo", x: "filter", y: "echo", hint: "← low-pass · high-pass →, up = more echo" },
};
const REST = { filter: 0.5, resonance: 0, echo: 0, echoTime: 0.4 };
const SWEEPS = [
  { label: "Build: low-pass opens (4 bars)", from: 0.06, to: 0.5, bars: 4, q: 0.45 },
  { label: "Close down (2 bars)", from: 0.5, to: 0.1, bars: 2, q: 0.35 },
  { label: "Riser: high-pass climbs, then drops (4 bars)", from: 0.5, to: 0.93, bars: 4, q: 0.55, snap: true },
];

export default function XYPad({ control: initialControl = "mouse" }) {
  const [control, setControl] = useState(initialControl); // "mouse" (the on-screen pad) or "camera" (hands)
  const [mode, setMode] = useState("filter");
  const [hold, setHold] = useState(false);
  const [fx, setFx] = useState(REST); // what the effects are set to now (from the bus)
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState("loop");
  const [files, setFiles] = useState([]);
  const [on, setOn] = useState(() => Object.fromEntries(PARTS.map((p) => [p, true])));
  const [dryKick, setDryKick] = useState(true);
  const [stepNow, setStepNow] = useState(-1);
  const [sweeping, setSweeping] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [sink, setSink] = useState("");
  const [touching, setTouching] = useState(false);
  const [midi, setMidi] = useState("");
  const midiStop = useRef(null);
  const audio = useRef(null); // { ctx, fx, master, gains, sources, el, t0, loop }
  const onRef = useRef(on);
  const sweepRef = useRef(0);

  // The effects' values. The sound changes at once (apply); the words and the dot on screen catch up a few times a
  // second, so React isn't redrawing the page for every pixel the pad moves.
  const values = useRef({ ...REST });
  const dotRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const readoutTimer = useRef(null);
  const apply = useCallback((name, value) => {
    values.current[name] = value;
    audio.current?.fx.set(name, value);
    const m = MODES[modeRef.current];
    if (dotRef.current) { dotRef.current.style.left = `${values.current[m.x] * 100}%`; dotRef.current.style.top = `${(1 - values.current[m.y]) * 100}%`; }
    if (!readoutTimer.current) readoutTimer.current = setTimeout(() => { readoutTimer.current = null; setFx({ ...values.current }); }, 90);
  }, []);
  // Changes from anywhere else (a MIDI knob, a hand on /track, another tab) arrive on the stage bus.
  useEffect(() => onStage((m) => { if (m.type === "param" && FX_PARAMS.includes(m.name)) apply(m.name, m.value); }), [apply]);
  // From this page: change the sound here right away, and tell the stage (and anything listening).
  const send = useCallback((name, value) => { apply(name, value); setParam(name, value); }, [apply]);

  useEffect(() => {
    fetch("/media").then((r) => r.json()).then((d) => setFiles(d.files || [])).catch(() => {});
    navigator.mediaDevices?.enumerateDevices?.().then((list) => setOutputs(list.filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default"))).catch(() => {});
  }, []);

  // Web Audio, made on the first click: the effects, then a compressor so nothing clips.
  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const ctx = new AudioContext();
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -6; master.ratio.value = 4;
    master.connect(ctx.destination);
    const effects = createFx(ctx, master);
    for (const [k, v] of Object.entries(values.current)) effects.set(k, v);
    if (sink && ctx.setSinkId) ctx.setSinkId(sink).catch(() => {});
    audio.current = { ctx, fx: effects, master, gains: {}, sources: [], el: null };
    return audio.current;
  };

  const stop = () => {
    const a = audio.current;
    if (!a) return;
    a.sources.forEach((s) => { try { s.stop(); } catch {} });
    a.sources = [];
    if (a.el) { a.el.pause(); a.el = null; }
    setPlaying(false); setStepNow(-1);
  };

  const play = async () => {
    const a = ensureAudio();
    await a.ctx.resume();
    stop();
    if (source === "loop") {
      const loop = renderLoop({ rate: a.ctx.sampleRate }); // about a tenth of a second
      a.loop = loop;
      a.t0 = a.ctx.currentTime + 0.08;
      for (const part of PARTS) {
        const buffer = a.ctx.createBuffer(1, loop.length, loop.rate);
        buffer.copyToChannel(loop.tracks[part], 0);
        const src = a.ctx.createBufferSource();
        src.buffer = buffer; src.loop = true;
        const gain = a.ctx.createGain();
        gain.gain.value = onRef.current[part] ? loop.scale : 0;
        src.connect(gain).connect(part === "kick" && dryKick ? a.master : a.fx.input);
        src.start(a.t0);
        a.gains[part] = gain; a.sources.push(src);
      }
    } else {
      const el = new Audio(source);
      el.loop = true;
      a.ctx.createMediaElementSource(el).connect(a.fx.input);
      a.el = el; a.loop = null;
      await el.play();
    }
    setPlaying(true);
  };

  // Switching a part on or off: a quick fade, in time with everything else.
  const toggle = (part) => {
    const next = { ...onRef.current, [part]: !onRef.current[part] };
    onRef.current = next; setOn(next);
    const a = audio.current;
    if (a?.gains[part] && a.loop) a.gains[part].gain.setTargetAtTime(next[part] ? a.loop.scale : 0, a.ctx.currentTime, 0.01);
  };

  // The playhead, for the step grid.
  useEffect(() => {
    if (!playing || source !== "loop") return;
    let raf;
    const tick = () => {
      const a = audio.current;
      if (a?.loop) setStepNow(Math.floor(((a.ctx.currentTime - a.t0) / a.loop.barSeconds) * 16) % 16);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, source]);

  // The pad: where you touch sets the two effects of the mode; letting go springs back unless Hold is on.
  const padRef = useRef(null);
  const fromPointer = (e) => {
    const r = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    const m = MODES[mode];
    send(m.x, x); send(m.y, y);
  };
  const down = (e) => { cancelSweep(); padRef.current.setPointerCapture(e.pointerId); setTouching(true); fromPointer(e); };
  const move = (e) => { if (touching) fromPointer(e); };
  const up = () => {
    setTouching(false);
    if (hold) return;
    const m = MODES[mode];
    send(m.x, REST[m.x]); send(m.y, REST[m.y]);
  };

  // Automatic sweeps, timed in bars of the loop.
  const cancelSweep = () => { sweepRef.current += 1; setSweeping(null); };
  const sweep = (s) => {
    cancelSweep();
    const id = sweepRef.current;
    const barSeconds = audio.current?.loop?.barSeconds || (60 / 124) * 4;
    const ms = s.bars * barSeconds * 1000;
    const start = performance.now();
    setSweeping(s.label);
    send("resonance", s.q);
    const tick = () => {
      if (sweepRef.current !== id) return;
      const t = Math.min(1, (performance.now() - start) / ms);
      send("filter", s.from + (s.to - s.from) * t);
      if (t < 1) setTimeout(tick, 33);
      else { setSweeping(null); if (s.snap) { send("filter", 0.5); send("resonance", 0); } }
    };
    tick();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); playing ? stop() : play(); }
      const n = Number(e.key);
      if (n >= 1 && n <= PARTS.length) toggle(PARTS[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // A MIDI controller on this page: the knobs and joystick from lib/launch/midi-map.js (MPK mini: joystick = filter).
  const connect = async () => {
    try {
      midiStop.current = await connectMidi({
        onDevices: (list) => setMidi(list.length ? list.map((d) => d.name).join(", ") : "no controller found: plug one in"),
        onMessage: (m) => {
          if (m.type === "pitchbend" && FX_PARAMS.includes(bendParam)) send(bendParam, m.value / 16383);
          if (m.type === "cc" && FX_PARAMS.includes(dials[m.number])) send(dials[m.number], m.value / 127);
          if (m.type === "noteon" && m.number >= 36 && m.number < 36 + PARTS.length) toggle(PARTS[m.number - 36]); // pads 1–6 switch parts
        },
      });
    } catch (e) { setMidi(e.message); }
  };
  useEffect(() => () => { sweepRef.current += 1; stop(); midiStop.current?.(); audio.current?.ctx.close(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m = MODES[mode];
  const dot = { left: `${fx[m.x] * 100}%`, top: `${(1 - fx[m.y]) * 100}%` };
  const sources = useMemo(() => [["loop", "The EDM loop (lib/launch/loop.js)"], ["/samples/loop-house.wav", "The same loop, as a file"], ...files.map((f) => [f, decodeURIComponent(f)])], [files]);

  return (
    <div className="ctl-grid">
      <div>
        <div className="xy-modes ctl-row">
          <button className={control === "mouse" ? "ctl-btn on" : "ctl-btn"} onClick={() => setControl("mouse")}>Mouse / touch</button>
          <button className={control === "camera" ? "ctl-btn on" : "ctl-btn"} onClick={() => setControl("camera")}>Hands (camera)</button>
          <span className="ctl-note">·</span>
          {Object.entries(MODES).map(([k, v]) => <button key={k} className={k === mode ? "ctl-btn on" : "ctl-btn"} onClick={() => setMode(k)}>{v.label}</button>)}
          <label className="ctl-note"><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> Hold (don't spring back)</label>
        </div>
        {control === "camera" ? <HandPad modes={MODES} mode={mode} send={send} rest={REST} hold={hold} /> : (
          <div ref={padRef} className={touching ? "xy-pad touching" : "xy-pad"} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div className="xy-center" />
            <div ref={dotRef} className="xy-dot" style={dot} />
            <span className="xy-label">{m.hint}</span>
          </div>
        )}
        <p className="ctl-note">Filter: <b style={{ color: "var(--ink)" }}>{describeFilter(fx.filter)}</b> · resonance {Math.round(fx.resonance * 100)}% · echo {Math.round(fx.echo * 100)}%{sweeping ? ` · sweeping: ${sweeping}` : ""}</p>
        <div className="ctl-row">
          {SWEEPS.map((s) => <button key={s.label} className={sweeping === s.label ? "ctl-btn on" : "ctl-btn"} onClick={() => sweep(s)}>{s.label}</button>)}
          <button className="ctl-btn" onClick={() => { cancelSweep(); Object.entries(REST).forEach(([k, v]) => send(k, v)); }}>Reset effects</button>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Play</h2>
          <div className="ctl-row">
            {!playing ? <button className="ctl-btn primary" onClick={play}>Play (Space)</button> : <button className="ctl-btn on" onClick={stop}>Stop (Space)</button>}
            <select className="ctl-select" value={source} onChange={(e) => { stop(); setSource(e.target.value); }}>
              {sources.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <label className="ctl-note">Sound out{" "}
            <select className="ctl-select" value={sink} onChange={(e) => { setSink(e.target.value); audio.current?.ctx.setSinkId?.(e.target.value).catch(() => {}); }}>
              <option value="">The Mac's default output</option>
              {outputs.map((o, i) => <option key={o.deviceId} value={o.deviceId}>{o.label || `Output ${i + 1}`}</option>)}
            </select>
          </label>
          <div className="ctl-row" style={{ marginTop: 8 }}>
            <button className="ctl-btn" onClick={connect} disabled={!!midiStop.current}>Connect MIDI</button>
            <span className="ctl-note">{midi || "MPK mini: joystick left/right = filter, up = resonance, pads 1–6 = parts, knobs 7–8 = echo"}</span>
          </div>
          <p className="ctl-note">Your own track: put it in the repo-root <code>_media/</code> folder and reload; it shows up in the menu.</p>
        </div>
        <div className="ctl-panel">
          <h2>Parts (keys 1–{PARTS.length})</h2>
          {source !== "loop" && <p className="ctl-note">Parts switch on and off on the EDM loop (choose it above).</p>}
          <div className="xy-parts">
            {PARTS.map((part, i) => (
              <div key={part} className="xy-part">
                <button className={on[part] ? "ctl-btn on" : "ctl-btn"} onClick={() => toggle(part)}><span className="pad-key">{i + 1}</span> {LABELS[part] || part}</button>
                <span className="xy-steps">{[...PATTERN[part]].map((c, s) => <i key={s} className={`${c === "x" ? "hit" : ""}${s === stepNow ? " now" : ""}${on[part] ? "" : " muted"}`} />)}</span>
              </div>
            ))}
          </div>
          <label className="ctl-note"><input type="checkbox" checked={dryKick} onChange={(e) => { setDryKick(e.target.checked); if (playing) setTimeout(play, 0); }} /> Keep the kick out of the filter (what DJs and producers often do)</label>
          <p className="ctl-note">Change the beat in <code>nextjs/lib/launch/loop.js</code>: tempo, chords, and a 16-step pattern per part.</p>
        </div>
      </div>
    </div>
  );
}
