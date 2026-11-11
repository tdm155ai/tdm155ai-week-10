"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fireCue, setParam, PARAMS } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { buttons } from "./buttons.js";
import { connectMidi, midiSupported, noteName } from "./midi.js";
import * as fileMap from "./midi-map.js";

// /launch/midi: a MIDI controller as a cheap lighting board. Every message shows in the monitor; pads/keys fire the
// cues in lib/launch/buttons.js (mapped in lib/launch/midi-map.js, or learned on the page); dials move the stage's
// continuous controls. On-screen pads and knobs stand in when nothing is plugged in.

const STORE = "tdm155ai-midi-map";
const PAD_NOTES = Array.from({ length: 16 }, (_, i) => 36 + i);
const KNOB_CCS = Array.from({ length: 8 }, (_, i) => 70 + i);
const PARAM_LABEL = { master: "Volume (all sounds)", opacity: "Picture opacity", brightness: "Brightness", hue: "Hue (color shift)", scrub: "Video position (scrub)", speed: "Video speed (middle = normal)", play: "Video play / pause" };

function loadMap() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved?.notes && saved?.dials) return saved;
  } catch {}
  return { notes: { ...fileMap.notes }, dials: { ...fileMap.dials } };
}

function cueFor(target) {
  if (!target) return null;
  if (typeof target === "object") return target;
  const b = buttons.find((x) => x.id === target);
  if (!b) return null;
  const { key, color, ...cue } = b;
  return cue;
}

function describe(m) {
  if (m.type === "noteon" || m.type === "noteoff") return `${m.type === "noteon" ? "note on " : "note off"}  note ${m.number} (${noteName(m.number)})  velocity ${m.value}`;
  if (m.type === "cc") return `CC (dial) ${m.number}  value ${m.value}`;
  if (m.type === "pitchbend") return `pitch bend  ${m.value}`;
  return `${m.type}  ${m.data?.join(" ")}`;
}

export default function MidiBoard() {
  const [map, setMap] = useState({ notes: fileMap.notes, dials: fileMap.dials });
  const [learning, setLearning] = useState(null); // { kind: "note", id } | { kind: "dial", param }
  const [monitor, setMonitor] = useState([]);
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [values, setValues] = useState({ master: 1, opacity: 1, brightness: 1, hue: 0 });
  const [lit, setLit] = useState({});
  const [copied, setCopied] = useState(false);
  const mapRef = useRef(map);
  const learnRef = useRef(null);
  const stopRef = useRef(null);

  const [hasMidi, setHasMidi] = useState(true);
  useEffect(() => { const m = loadMap(); setMap(m); mapRef.current = m; setHasMidi(midiSupported()); }, []);
  const saveMap = (m) => { mapRef.current = m; setMap(m); try { localStorage.setItem(STORE, JSON.stringify(m)); } catch {} };
  const learn = (l) => { learnRef.current = l; setLearning(l); };

  const handle = useCallback((m) => {
    setMonitor((list) => [{ ...m, t: new Date().toLocaleTimeString() }, ...list].slice(0, 60));
    const l = learnRef.current;
    if (l?.kind === "note" && m.type === "noteon") {
      const notes = Object.fromEntries(Object.entries(mapRef.current.notes).filter(([, v]) => v !== l.id));
      notes[m.number] = l.id;
      saveMap({ ...mapRef.current, notes });
      learn(null);
      return;
    }
    if (l?.kind === "dial" && m.type === "cc") {
      const dials = Object.fromEntries(Object.entries(mapRef.current.dials).filter(([, v]) => v !== l.param));
      dials[m.number] = l.param;
      saveMap({ ...mapRef.current, dials });
      learn(null);
      return;
    }
    if (m.type === "noteon") {
      const cue = cueFor(mapRef.current.notes[m.number]);
      setLit((x) => ({ ...x, [m.number]: true }));
      setTimeout(() => setLit((x) => ({ ...x, [m.number]: false })), 160);
      if (!cue) return;
      const options = { ...(cue.options || {}) };
      if (cue.kind === "sound" && fileMap.velocity) options.volume = (options.volume ?? 1) * Math.max(0.15, m.value / 127);
      fireCue({ ...cue, options });
    }
    if (m.type === "cc") {
      const param = mapRef.current.dials[m.number];
      if (!param) return;
      const v = m.value / 127;
      setParam(param, v);
      setValues((x) => ({ ...x, [param]: v }));
    }
  }, []);

  const connect = async () => {
    setError("");
    try {
      stopRef.current = await connectMidi({ onMessage: handle, onDevices: setDevices });
      setStatus("on");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => () => stopRef.current?.(), []);

  const virtual = (type, number, value) => handle({ type, channel: 10, number, value, device: "on-screen" });

  const code = `export const notes = ${JSON.stringify(map.notes, null, 2)};\n\nexport const dials = ${JSON.stringify(map.dials, null, 2)};`;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const reset = () => { try { localStorage.removeItem(STORE); } catch {} const m = { notes: { ...fileMap.notes }, dials: { ...fileMap.dials } }; mapRef.current = m; setMap(m); };

  const noteOf = (id) => Object.entries(map.notes).find(([, v]) => v === id)?.[0];
  const ccOf = (param) => Object.entries(map.dials).find(([, v]) => v === param)?.[0];

  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <h2>1 · Connect</h2>
          <div className="ctl-row">
            <button className={status === "on" ? "ctl-btn on" : "ctl-btn primary"} onClick={connect} disabled={status === "on"}>{status === "on" ? "MIDI on" : "Connect MIDI"}</button>
            <span className="ctl-status">{devices.length ? devices.map((d) => `● ${d.name}`).join("   ") : status === "on" ? "no devices yet: plug one in (it shows up here)" : hasMidi ? "Chrome will ask permission" : "No Web MIDI here: use Chrome or Edge"}</span>
          </div>
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          {learning && <p className="ctl-note" style={{ color: "var(--accent)" }}>Learning: {learning.kind === "note" ? "hit a pad or key" : "turn a dial"} for <b>{learning.id || PARAM_LABEL[learning.param]}</b>… <button className="ctl-btn" onClick={() => learn(null)}>cancel</button></p>}
        </div>

        <div className="ctl-panel">
          <h2>2 · Monitor: what your device sends</h2>
          <ul className="ctl-log">
            {monitor.map((m, i) => <li key={i}>{m.t} <b>{describe(m)}</b>  ch {m.channel} · {m.device}</li>)}
            {!monitor.length && <li>Hit a pad, press a key, turn a dial. (Or use the on-screen pads below.)</li>}
          </ul>
        </div>

        <div className="ctl-panel">
          <h2>No controller? On-screen pads (notes 36–51) and knobs (CC 70–77)</h2>
          <div className="midi-pads">
            {PAD_NOTES.map((n) => {
              const cue = cueFor(map.notes[n]);
              return (
                <button key={n} className={`midi-pad${lit[n] ? " lit" : ""}`} onPointerDown={() => virtual("noteon", n, 100)} onPointerUp={() => virtual("noteoff", n, 0)}>
                  <span>{n}</span><b>{cue ? cue.label : "—"}</b>
                </button>
              );
            })}
          </div>
          <div className="midi-knobs">
            {KNOB_CCS.map((cc) => (
              <label key={cc}>
                <span>CC {cc}{map.dials[cc] ? ` · ${map.dials[cc]}` : ""}</span>
                <input type="range" min="0" max="127" defaultValue={map.dials[cc] === "hue" ? 0 : 127} onChange={(e) => virtual("cc", cc, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
        </div>

        <div className="ctl-panel">
          <h2>3 · Pads → cues (learn)</h2>
          <table className="midi-table">
            <tbody>
              {buttons.map((b) => {
                const n = noteOf(b.id);
                return (
                  <tr key={b.id}>
                    <td>{b.label}</td>
                    <td className="ctl-status">{n ? `note ${n}` : "—"}</td>
                    <td><button className={learning?.id === b.id ? "ctl-btn on" : "ctl-btn"} onClick={() => learn({ kind: "note", id: b.id })}>Learn</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="ctl-panel">
          <h2>4 · Dials → stage controls (learn)</h2>
          {PARAMS.map((p) => (
            <div key={p} className="slider-row" style={{ gridTemplateColumns: "1fr 70px 64px 40px" }}>
              <span>{PARAM_LABEL[p]}</span>
              <span className="ctl-status">{ccOf(p) ? `CC ${ccOf(p)}` : "—"}</span>
              <button className={learning?.param === p ? "ctl-btn on" : "ctl-btn"} onClick={() => learn({ kind: "dial", param: p })}>Learn</button>
              <output>{Math.round((values[p] ?? 0) * 100)}%</output>
            </div>
          ))}
        </div>

        <div className="ctl-panel">
          <h2>5 · Keep your mapping</h2>
          <p className="ctl-note">What you learn is saved in this browser. To keep it in the code, copy it and paste it over <code>notes</code> and <code>dials</code> in <code>nextjs/lib/launch/midi-map.js</code>.</p>
          <div className="ctl-row">
            <button className="ctl-btn" onClick={copy}>{copied ? "Copied" : "Copy as code"}</button>
            <button className="ctl-btn" onClick={reset}>Reset to the file</button>
          </div>
        </div>
      </div>
    </div>
  );
}
