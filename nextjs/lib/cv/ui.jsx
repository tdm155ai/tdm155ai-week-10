"use client";

// Small pieces the CV pages share: the camera bar (pick a camera, mirror, open the stage) and the cue log.

import { useCallback, useEffect, useState } from "react";
import { onStage, openStage, panic, pingStage } from "./stage.js";

// Is a /stage window open? The stage answers a ping with a status message.
export function useStageOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = 0;
    const stop = onStage((message) => { if (message?.type === "status") { seen = Date.now(); setOpen(true); } });
    pingStage();
    const timer = setInterval(() => { pingStage(); if (Date.now() - seen > 4000) setOpen(false); }, 2000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  return open;
}

export function CameraBar({ camera, mirror, setMirror, children }) {
  const stageOpen = useStageOpen();
  return (
    <div className="cv-bar">
      <label>
        <span>Camera</span>
        <select value={camera.cameraId} onChange={(event) => camera.chooseCamera(event.target.value)}>
          {camera.cameras.length === 0 && <option value="">(none yet)</option>}
          {camera.cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
        </select>
      </label>
      {setMirror && (
        <label className="cv-check">
          <input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} /> Mirror
        </label>
      )}
      {children}
      <span className="cv-spacer" />
      <span className={`cv-pill ${stageOpen ? "is-on" : ""}`}>{stageOpen ? "Stage open" : "No stage open"}</span>
      <button type="button" onClick={() => openStage()}>Open the stage</button>
      <button type="button" className="cv-quiet" onClick={() => panic()}>Blackout</button>
    </div>
  );
}

export function Status({ items }) {
  return (
    <p className="cv-status">
      {items.filter((item) => item?.text).map((item, index) => <span key={index} className={`is-${item.tone}`}>{item.text}</span>)}
    </p>
  );
}

// The last few cues fired from this page, newest first.
export function useCueLog(limit = 8) {
  const [log, setLog] = useState([]);
  const add = useCallback((cue, why) => {
    const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    setLog((current) => [{ key: `${Date.now()}-${Math.random()}`, at, why, label: cue.label || cue.id || cue.kind, kind: cue.kind }, ...current].slice(0, limit));
  }, [limit]);
  return [log, add];
}

export function CueLog({ log }) {
  return (
    <div className="cv-log">
      <p className="eyebrow">Cues fired</p>
      {log.length === 0 ? <p className="cv-muted">Nothing yet.</p> : (
        <ol>
          {log.map((entry) => <li key={entry.key}><strong>{entry.label}</strong> <span>{entry.kind} · {entry.why} · {entry.at}</span></li>)}
        </ol>
      )}
    </div>
  );
}

// Name/value rows: what the model sees, as numbers.
export function Readout({ rows }) {
  return (
    <dl className="cv-readout">
      {rows.map(([name, value, hot]) => (
        <div key={name} className={hot ? "is-hot" : ""}><dt>{name}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

export function fmt(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "–";
}
