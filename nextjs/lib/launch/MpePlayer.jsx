"use client";

// /launch/mpe: play a ROLI Seaboard BLOCK (MPE) or any MIDI keyboard, hear it, and see every touch: X = pitch with
// bend, Y = slide, size and glow = pressure, and a fading trail so glides and wiggles (vibrato) show as motion.
// From the purple fellow's MIDI studies (LL week 10 experiments): their channel monitor showed that the Block puts
// each held note on its own channel; this page plays and draws those channels. Settings, sounds and colors are in
// ./mpe.js (the file to change). No hardware? Drag on the picture: one note per finger or mouse.

import { useCallback, useEffect, useRef, useState } from "react";
import { connectMidi, midiSupported, noteName } from "./midi.js";
import { BEND_RANGE, KEYBOARD_BEND_RANGE, KEYS, NOTE_NAMES, SLIDE_CCS, look, patches } from "./mpe.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
// Note names as the Seaboard and ROLI Dashboard print them (60 = C3), or the usual way (60 = C4): see mpe.js.
const name = (n) => noteName(NOTE_NAMES === "roli" ? n - 12 : n);
const freshChannel = () => ({ bend: 0, slide: 0.5, press: 0, pressSeen: false, msgs: 0, notes: new Set() });

// Sound: Tone.js, loaded on the first click (browsers only allow sound after one). Each note is its own voice.
async function makeEngine() {
  const Tone = await import("tone");
  await Tone.start();
  Tone.getContext().lookAhead = 0; // play now, not a tenth of a second from now: this is an instrument
  const limiter = new Tone.Limiter(-2).toDestination();
  const master = new Tone.Gain(0.8).connect(limiter);
  const reverb = new Tone.Freeverb({ roomSize: 0.82, dampening: 2800, wet: 1 }).connect(limiter);
  const send = new Tone.Gain(0.3).connect(reverb);
  return { Tone, master, send, dispose: () => [send, reverb, master, limiter].forEach((n) => n.dispose()) };
}

function makeVoice(E, patch, freq, cutoff, level) {
  const { Tone } = E;
  const now = Tone.now();
  const env = new Tone.Gain(0);
  env.connect(E.master);
  env.connect(E.send);
  const expr = new Tone.Gain(level).connect(env);
  const filter = new Tone.Filter({ type: "lowpass", frequency: cutoff, Q: patch.q }).connect(expr);
  const oscs = [
    new Tone.Oscillator({ type: patch.wave, frequency: freq, volume: -8 }),
    new Tone.Oscillator({ type: patch.wave2, frequency: freq, detune: patch.detune, volume: -8 }),
  ];
  const sub = patch.sub ? new Tone.Oscillator({ type: "sine", frequency: freq / 2, volume: 20 * Math.log10(patch.sub) - 4 }) : null;
  for (const o of [...oscs, sub].filter(Boolean)) o.connect(filter).start(now);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(1, now + patch.attack);
  if (patch.decay) env.gain.setTargetAtTime(patch.sustain, now + patch.attack, patch.decay / 3);
  return {
    pitch(f) { const t = Tone.now(); for (const o of oscs) o.frequency.setTargetAtTime(f, t, 0.006); sub?.frequency.setTargetAtTime(f / 2, t, 0.006); },
    level(v) { expr.gain.setTargetAtTime(v, Tone.now(), 0.012); },
    cutoff(hz) { filter.frequency.setTargetAtTime(hz, Tone.now(), 0.012); },
    release(now = false) {
      const t = Tone.now();
      env.gain.cancelAndHoldAtTime(t);
      env.gain.setTargetAtTime(0, t, now ? 0.005 : patch.release / 4);
      setTimeout(() => { for (const n of [...oscs, sub, filter, expr, env].filter(Boolean)) { try { n.stop?.(); } catch {} n.dispose(); } }, now ? 60 : patch.release * 1500 + 200);
    },
  };
}

export default function MpePlayer() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const engine = useRef(null);
  const chans = useRef(Array.from({ length: 17 }, freshChannel)); // 1 to 16
  const voices = useRef(new Map()); // "ch:note" → voice
  const trails = useRef([]); // voices that have let go, still fading on screen
  const pointers = useRef(new Map()); // pointerId → { ch, note, mode, downAt, sent }
  const range = useRef({ lo: KEYS.low - 0.5, hi: KEYS.high + 0.5 }); // the keys across the picture (see fit below)
  const view = useRef(range.current); // what's drawn this frame: the keys, stretched while a bend goes past them
  const settings = useRef({ mpeRange: BEND_RANGE, keyRange: KEYBOARD_BEND_RANGE, patch: "pad" });
  const lastMsg = useRef("");
  const total = useRef(0);
  const [mpeRange, setMpeRange] = useState(BEND_RANGE);
  const [keyRange, setKeyRange] = useState(KEYBOARD_BEND_RANGE);
  const [patch, setPatch] = useState("pad");
  const [volume, setVolume] = useState(0.8);
  const [sound, setSound] = useState("off"); // off | starting | on
  const [midi, setMidi] = useState({ state: "off", devices: [], error: "" });
  const [supported, setSupported] = useState(true);
  const [meters, setMeters] = useState([]);
  const [readout, setReadout] = useState({ total: 0, last: "" });

  useEffect(() => { setSupported(midiSupported()); }, []);
  useEffect(() => { settings.current = { mpeRange, keyRange, patch }; }, [mpeRange, keyRange, patch]);
  useEffect(() => { if (engine.current) engine.current.master.gain.value = volume; }, [volume]);
  useEffect(() => { if (engine.current) engine.current.send.gain.value = patches[patch].reverb; }, [patch]);

  const startSound = useCallback(async () => {
    if (engine.current || sound === "starting") return;
    setSound("starting");
    try {
      engine.current = await makeEngine();
      engine.current.master.gain.value = volume;
      engine.current.send.gain.value = patches[settings.current.patch].reverb;
      setSound("on");
    } catch (e) { setSound(`off (${e.message})`); }
  }, [sound, volume]);

  // What a voice should be doing right now, from its channel (MPE) or its own key pressure.
  const shape = (v) => {
    const c = chans.current[v.ch];
    const { mpeRange: mr, keyRange: kr } = settings.current;
    const bendSemis = c.bend * (v.ch === 1 ? kr : mr);
    const press = v.polyPress ?? (c.pressSeen ? c.press : null);
    return { pitch: v.note + bendSemis, bendSemis, slide: c.slide, press: press ?? v.vel * 0.6, level: press === null ? v.vel : 0.08 + 0.92 * press };
  };
  const apply = (v) => {
    if (!v.audio) return;
    const s = shape(v);
    const p = patches[v.patch];
    v.audio.pitch(mtof(s.pitch));
    v.audio.level(0.3 * s.level);
    v.audio.cutoff(Math.min(18000, p.cutoff * 2 ** (s.slide * p.slideOctaves) * (1 + 0.6 * (s.press ?? 0))));
  };

  const release = (key, now = false) => {
    const v = voices.current.get(key);
    if (!v) return;
    v.audio?.release(now);
    v.on = false;
    voices.current.delete(key);
    trails.current.push(v);
  };

  // Every MIDI message (from the Block, a keyboard, or the mouse) comes through here.
  const handle = useCallback((m) => {
    const ch = m.channel;
    const c = chans.current[ch];
    if (!c) return;
    c.msgs += 1;
    total.current += 1;
    lastMsg.current = `ch ${ch} ${m.type} ${m.type === "pitchbend" ? m.value - 8192 : m.number}${m.type === "cc" || m.type === "noteon" ? ` = ${m.value}` : ""}`;
    const onChannel = () => [...voices.current.values()].filter((v) => v.ch === ch);
    if (m.type === "noteon") {
      const key = `${ch}:${m.number}`;
      release(key, true);
      c.notes.add(m.number);
      c.pressSeen = false;
      c.press = 0;
      const p = patches[settings.current.patch];
      const v = { key, ch, note: m.number, vel: m.value / 127, on: true, patch: settings.current.patch, trail: [], audio: null, polyPress: null };
      if (engine.current) { const s = shape(v); v.audio = makeVoice(engine.current, p, mtof(s.pitch), p.cutoff * 2 ** (s.slide * p.slideOctaves), 0.3 * s.level); }
      voices.current.set(key, v);
      fit(m.number);
    } else if (m.type === "noteoff") {
      c.notes.delete(m.number);
      release(`${ch}:${m.number}`);
    } else if (m.type === "pitchbend") {
      c.bend = clamp((m.value - 8192) / 8192, -1, 1);
      onChannel().forEach(apply);
    } else if (m.type === "aftertouch") {
      c.press = m.value / 127;
      c.pressSeen = true;
      onChannel().forEach(apply);
    } else if (m.type === "polytouch") {
      const v = voices.current.get(`${ch}:${m.number}`);
      if (v) { v.polyPress = m.value / 127; apply(v); }
    } else if (m.type === "cc") {
      if (SLIDE_CCS.includes(m.number)) { c.slide = m.value / 127; onChannel().forEach(apply); }
      if (m.number === 120 || m.number === 123) for (const v of onChannel()) { c.notes.delete(v.note); release(v.key); }
    }
  }, []);

  // The picture shows the Block's keys. When a note lands outside them (the octave buttons), it moves by octaves to
  // the keys being played, and widens only if the held notes need more room.
  const fit = (n) => {
    const r = range.current;
    if (n > r.lo && n < r.hi) return;
    const held = [...[...voices.current.values()].map((v) => v.note), n];
    let lo = Math.round(r.lo + 0.5), hi = lo + (KEYS.high - KEYS.low);
    while (n > hi) { lo += 12; hi += 12; } // slide the keys an octave at a time until the new note is on them
    while (n < lo) { lo -= 12; hi -= 12; }
    while (Math.min(...held) < lo) lo -= 12; // and stretch if notes still held are now off the edge
    while (Math.max(...held) > hi) hi += 12;
    range.current = { lo: lo - 0.5, hi: hi + 0.5 };
  };

  const panic = useCallback(() => {
    for (const key of [...voices.current.keys()]) release(key, true);
    pointers.current.clear();
    chans.current = Array.from({ length: 17 }, freshChannel);
  }, []);

  const connect = async () => {
    startSound();
    setMidi((s) => ({ ...s, state: "connecting", error: "" }));
    try {
      const stop = await connectMidi({ onMessage: handle, onDevices: (devices) => setMidi((s) => ({ ...s, devices })) });
      midiStop.current = stop;
      setMidi((s) => ({ ...s, state: "on" }));
    } catch (e) { setMidi((s) => ({ ...s, state: "off", error: e.message })); }
  };
  const midiStop = useRef(null);

  // Leaving the page: stop listening and silence everything.
  useEffect(() => () => {
    midiStop.current?.();
    for (const v of voices.current.values()) v.audio?.release(true);
    voices.current.clear();
    const E = engine.current;
    engine.current = null;
    if (E) setTimeout(() => E.dispose(), 120);
  }, []);

  // ── The pointer: one note per finger. X picks the note (moving sideways bends it), Y is slide, holding presses
  // harder (a pen uses its real pressure). It sends the same messages a Seaboard would, on its own channels.
  const pitchAt = (clientX) => {
    const r = canvasRef.current.getBoundingClientRect();
    const { lo, hi } = view.current;
    return lo + ((clientX - r.left) / r.width) * (hi - lo);
  };
  const slideAt = (clientY) => {
    const r = canvasRef.current.getBoundingClientRect();
    return clamp(Math.round((1 - (clientY - r.top - r.height * 0.03) / (r.height * 0.84)) * 127), 0, 127);
  };
  const freeChannel = () => {
    const busy = new Set([...pointers.current.values()].map((p) => p.ch));
    for (let c = 2; c <= 16; c++) if (!busy.has(c) && !chans.current[c].notes.size) return c;
    return 16;
  };
  const sendPointer = (p, e) => {
    const semis = pitchAt(e.clientX) - p.note;
    handle({ type: "pitchbend", channel: p.ch, value: clamp(Math.round(8192 + (semis / settings.current.mpeRange) * 8192), 0, 16383) });
    handle({ type: "cc", channel: p.ch, number: 74, value: slideAt(e.clientY) });
    if (p.mode === "pen") handle({ type: "aftertouch", channel: p.ch, number: 0, value: Math.round(e.pressure * 127) });
  };
  const onDown = (e) => {
    e.preventDefault();
    startSound();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    const ch = freeChannel();
    const note = Math.round(pitchAt(e.clientX));
    const pen = e.pointerType === "pen" || (e.pointerType === "touch" && e.pressure > 0 && e.pressure !== 0.5);
    const p = { ch, note, mode: pen ? "pen" : "hold", downAt: performance.now(), sent: -1 };
    pointers.current.set(e.pointerId, p);
    handle({ type: "pitchbend", channel: ch, value: 8192 });
    handle({ type: "noteon", channel: ch, number: note, value: 96 });
    sendPointer(p, e);
  };
  const onMove = (e) => { const p = pointers.current.get(e.pointerId); if (p) sendPointer(p, e); };
  const onUp = (e) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    pointers.current.delete(e.pointerId);
    handle({ type: "noteoff", channel: p.ch, number: p.note, value: 0 });
  };

  // ── The picture.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const W = canvas.width, H = canvas.height, dpr = W / Math.max(1, canvas.clientWidth);
      // The keys, stretched (for this frame only) to keep a big bend in the picture.
      let { lo, hi } = range.current;
      for (const v of voices.current.values()) { const p = shape(v).pitch; lo = Math.min(lo, p - 1); hi = Math.max(hi, p + 1); }
      view.current = { lo, hi };
      const X = (pitch) => ((pitch - lo) / (hi - lo)) * W;
      const KEYS_TOP = H * 0.9; // the keyboard strip along the bottom
      const Y = (slide) => (1 - slide) * (H * 0.84) + H * 0.03;

      // Held mouse buttons press harder the longer you hold (a Seaboard key you lean into).
      for (const p of pointers.current.values()) {
        if (p.mode !== "hold") continue;
        const v = Math.round(127 * Math.min(1, 0.3 + ((now - p.downAt) / 1500) * 0.7));
        if (v !== p.sent) { p.sent = v; handle({ type: "aftertouch", channel: p.ch, number: 0, value: v }); }
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = look.background;
      ctx.fillRect(0, 0, W, H);
      // The keyboard: a faint column per key above, and a strip of keys along the bottom with their names, lit
      // where a note is held, so a bend reads as moving between keys (a wiggle around one, a glide across several).
      const held = new Map([...voices.current.values()].map((v) => [v.note, look.hue(v.ch)]));
      const keyW = W / (hi - lo);
      ctx.textAlign = "center";
      for (let n = Math.ceil(lo - 0.5); n <= Math.floor(hi + 0.5); n++) {
        const x0 = X(n - 0.5), x1 = X(n + 0.5);
        const black = BLACK_KEYS.has(((n % 12) + 12) % 12);
        ctx.fillStyle = black ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.04)";
        ctx.fillRect(x0 + dpr, 0, x1 - x0 - 2 * dpr, KEYS_TOP - 4 * dpr);
        ctx.fillStyle = held.has(n) ? `hsla(${held.get(n)}, 100%, 60%, 0.75)` : black ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)";
        ctx.fillRect(x0 + dpr, KEYS_TOP, x1 - x0 - 2 * dpr, H - KEYS_TOP);
        if (!black && keyW > 16 * dpr) {
          ctx.fillStyle = n % 12 === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)";
          ctx.font = `${n % 12 === 0 ? 700 : 400} ${Math.min(13, keyW / dpr / 2.6) * dpr}px ui-monospace, monospace`;
          ctx.fillText(n % 12 === 0 ? name(n) : name(n).replace(/-?\d+$/, ""), (x0 + x1) / 2, H - (H - KEYS_TOP) * 0.3);
        }
      }
      ctx.textAlign = "start";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${11 * dpr}px ui-monospace, monospace`;
      ctx.fillText("slide ↑", 8 * dpr, 16 * dpr);

      // Trails, then the notes themselves.
      ctx.globalCompositeOperation = "lighter";
      const life = look.trailSeconds * 1000;
      const all = [...voices.current.values(), ...trails.current];
      for (const v of all) {
        if (v.on) {
          const s = shape(v);
          v.trail.push({ pitch: s.pitch, slide: s.slide, press: s.press, t: now });
          v.now = s;
        }
        while (v.trail.length && now - v.trail[0].t > life) v.trail.shift();
        const hue = look.hue(v.ch);
        for (let i = 1; i < v.trail.length; i++) {
          const a = v.trail[i - 1], b = v.trail[i];
          const fade = 1 - (now - b.t) / life;
          ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.85 * fade})`;
          ctx.lineWidth = (2 + b.press * 16) * dpr * fade;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(X(a.pitch), Y(a.slide)); ctx.lineTo(X(b.pitch), Y(b.slide)); ctx.stroke();
        }
        if (v.on && v.now) {
          const x = X(v.now.pitch), y = Y(v.now.slide), r = (16 + v.now.press * 90) * look.glow * dpr;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `hsla(${hue}, 100%, 80%, ${0.55 + 0.45 * v.now.press})`);
          g.addColorStop(0.35, `hsla(${hue}, 100%, 60%, ${0.25 + 0.4 * v.now.press})`);
          g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath(); ctx.arc(x, y, (3 + v.now.press * 6) * dpr, 0, Math.PI * 2); ctx.fill();
          ctx.font = `${13 * dpr}px ui-monospace, monospace`;
          const bend = v.now.bendSemis;
          ctx.fillText(`${name(v.note)}${Math.abs(bend) >= 0.05 ? ` ${bend > 0 ? "+" : ""}${bend.toFixed(1)}` : ""}`, x + r * 0.35 + 6 * dpr, y - r * 0.35);
        }
      }
      trails.current = trails.current.filter((v) => v.trail.length);
      if (!all.length) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `${16 * dpr}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Play the Block, or drag here: sideways bends, up and down slides, hold to press harder", W / 2, H / 2);
        ctx.textAlign = "start";
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [handle]);

  // The meters under the picture, ten times a second.
  useEffect(() => {
    const t = setInterval(() => {
      const rows = [];
      chans.current.forEach((c, ch) => {
        if (!ch || !c.msgs) return;
        const r = ch === 1 ? settings.current.keyRange : settings.current.mpeRange;
        rows.push({ ch, notes: [...c.notes].map((n) => `${name(n)} (${n})`).join(" "), bend: c.bend, semis: c.bend * r, slide: c.slide, press: c.pressSeen ? c.press : null, held: c.notes.size > 0 });
      });
      setMeters(rows);
      setReadout({ total: total.current, last: lastMsg.current });
    }, 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea")) return;
      if (e.key === "Escape") panic();
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else stageRef.current?.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panic]);

  const channelsUsed = meters.filter((m) => m.ch > 1).length;

  return (
    <div className="mpe">
      <div className="ctl-row" style={{ marginBottom: 12 }}>
        {midi.state === "on"
          ? <span className="ctl-status ok">● MIDI on: {midi.devices.map((d) => d.name).join(", ") || "no device plugged in yet"}</span>
          : <button className="ctl-btn primary" onClick={connect} disabled={!supported || midi.state === "connecting"}>Connect MIDI (the Block)</button>}
        {sound !== "on" && <button className="ctl-btn" onClick={startSound}>🔊 Start sound</button>}
        <span className={sound === "on" ? "ctl-status ok" : "ctl-status"}>{sound === "on" ? "sound on" : sound === "starting" ? "starting sound…" : `sound ${sound}`}</span>
        <label className="ctl-note">Sound <select className="ctl-select" value={patch} onChange={(e) => setPatch(e.target.value)}>
          {Object.entries(patches).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select></label>
        <label className="ctl-note">Bend range <input className="ctl-input mpe-num" type="number" min="1" max="96" value={mpeRange} onChange={(e) => setMpeRange(clamp(Number(e.target.value) || 48, 1, 96))} /> st (MPE)</label>
        <label className="ctl-note"><input className="ctl-input mpe-num" type="number" min="1" max="24" value={keyRange} onChange={(e) => setKeyRange(clamp(Number(e.target.value) || 2, 1, 24))} /> st (channel 1)</label>
        <label className="ctl-note">Volume <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></label>
        <button className="ctl-btn" onClick={panic}>Panic (Esc)</button>
        <button className="ctl-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : stageRef.current?.requestFullscreen?.())}>Full screen (F)</button>
      </div>
      {!supported && <p className="ctl-note">No Web MIDI in this browser: use Chrome. The mouse still plays.</p>}
      {midi.error && <p className="ctl-note" style={{ color: "var(--error)" }}>{midi.error}</p>}

      <div ref={stageRef} className="mpe-stage">
        <canvas ref={canvasRef} className="mpe-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      </div>

      <div className="ctl-panel" style={{ marginTop: 16 }}>
        <h2>Channels {channelsUsed > 1 ? `· MPE: ${channelsUsed} channels in use` : ""}</h2>
        {meters.length ? (
          <table className="mpe-meters">
            <thead><tr><th>Ch</th><th>Notes (MIDI number)</th><th>Bend (glide, wiggle)</th><th>Slide (CC74)</th><th>Pressure</th></tr></thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.ch} className={m.held ? "" : "idle"}>
                  <td style={{ color: `hsl(${look.hue(m.ch)}, 100%, 65%)` }}>{m.ch}{m.ch === 1 ? " (master)" : ""}</td>
                  <td>{m.notes || "–"}</td>
                  <td><span className="mpe-bar center"><i style={{ left: `${Math.min(50, 50 + m.bend * 50)}%`, width: `${Math.abs(m.bend) * 50}%` }} /></span><span className="mpe-num-out">{m.semis >= 0 ? "+" : ""}{m.semis.toFixed(2)} st</span></td>
                  <td><span className="mpe-bar"><i style={{ width: `${m.slide * 100}%` }} /></span><span className="mpe-num-out">{Math.round(m.slide * 127)}</span></td>
                  <td><span className="mpe-bar"><i style={{ width: `${(m.press ?? 0) * 100}%` }} /></span><span className="mpe-num-out">{m.press === null ? "–" : Math.round(m.press * 127)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="ctl-note">Nothing yet. Each held note on the Block shows up here on its own channel.</p>}
        <p className="ctl-note">{readout.total} messages{readout.last ? ` · last: ${readout.last}` : ""}</p>
      </div>
    </div>
  );
}
