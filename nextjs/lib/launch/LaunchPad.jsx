"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { buttons } from "./buttons.js";

// /launch, the Hello World: a grid of buttons, each a cue from lib/launch/buttons.js. Click one, or press its key;
// Space is Go (fires the next one in order).
export default function LaunchPad() {
  const [next, setNext] = useState(0);
  const [hit, setHit] = useState(null);
  const [log, setLog] = useState([]);
  const nextRef = useRef(0);

  const fire = useCallback((index, how) => {
    const b = buttons[index];
    if (!b) return;
    const { key, color, ...cue } = b;
    fireCue(cue);
    setHit(index);
    setTimeout(() => setHit((h) => (h === index ? null : h)), 150);
    nextRef.current = (index + 1) % buttons.length;
    setNext(nextRef.current);
    setLog((l) => [{ t: new Date().toLocaleTimeString(), label: b.label, kind: b.kind, how }, ...l].slice(0, 40));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") { e.preventDefault(); fire(nextRef.current, "Space (Go)"); return; }
      const i = buttons.findIndex((b) => String(b.key).toLowerCase() === e.key.toLowerCase());
      if (i >= 0) { e.preventDefault(); fire(i, `key ${e.key}`); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  return (
    <div className="ctl-grid">
      <div>
        <div className="pad-grid">
          {buttons.map((b, i) => (
            <button key={b.id || i} className={`pad${hit === i ? " hit" : ""}${next === i ? " next" : ""}`} onClick={() => fire(i, "click")}
              style={b.color ? { background: b.color } : undefined}>
              <span className="pad-key">{b.key}</span>
              <span className="pad-kind">{b.kind}</span>
              <strong>{b.label}</strong>
            </button>
          ))}
        </div>
        <p className="ctl-note">Keys <code>1</code>–<code>9</code> fire the buttons; <code>Space</code> is Go (the dashed one is next). Change the buttons in <code>nextjs/lib/launch/buttons.js</code>.</p>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
          <p className="ctl-note">The preview is silent; sound plays in the stage window.</p>
        </div>
        <div className="ctl-panel">
          <h2>Fired</h2>
          <ul className="ctl-log">
            {log.map((l, i) => <li key={i}>{l.t} <b>{l.label}</b> ({l.kind}) by {l.how}</li>)}
            {!log.length && <li>Nothing yet. Press 1.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
