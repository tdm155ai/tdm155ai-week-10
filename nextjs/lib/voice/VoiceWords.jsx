"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { startWebSpeech, useMic } from "./mic.js";
import MicPicker from "./MicPicker.jsx";
import { speechSupported, triggerWatcher } from "./speech.js";
import { triggers } from "./triggers.js";

// /voice, the Hello World: say a word from lib/voice/triggers.js and its cue fires. Shows the live transcript (grey
// while Chrome is still guessing) and which word fired what, and whether it fired from an interim (fast) or final result.
export default function VoiceWords() {
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]); // [{ key, text, final }]
  const [log, setLog] = useState([]);
  const [typed, setTyped] = useState("");
  const [supported, setSupported] = useState(true);
  const stopRef = useRef(null);
  const typedIndex = useRef(0);
  const mic = useMic();

  useEffect(() => setSupported(speechSupported()), []);

  const fire = useCallback((t, info) => {
    fireCue(t.cue);
    setLog((l) => [{ t: new Date().toLocaleTimeString(), say: t.say, label: t.cue.label || t.cue.kind, final: info.final }, ...l].slice(0, 40));
  }, []);
  const watch = useMemo(() => triggerWatcher(() => triggers, fire), [fire]);

  const onResult = useCallback((r) => {
    watch(r);
    const key = `${r.session}:${r.index}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      const line = { key, text: r.text, final: r.final };
      if (i >= 0) { const next = prev.slice(); next[i] = line; return next; }
      return [...prev, line].slice(-30);
    });
  }, [watch]);

  const start = async () => {
    setError("");
    setState("starting");
    stopRef.current = await startWebSpeech(mic, { onResult, onState: setState, onError: (e) => setError(e.message) });
  };
  const stop = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  useEffect(() => () => stopRef.current?.(), []);

  // No microphone? Type a line and it goes through the same matcher as speech.
  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    typedIndex.current += 1;
    onResult({ index: typedIndex.current, text: typed, final: true, session: "typed", at: performance.now() });
    setTyped("");
  };

  const listening = !["off", "stopped"].includes(state);
  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <h2>Listen</h2>
          <div className="ctl-row">
            {!listening
              ? <button className="ctl-btn primary" onClick={start} disabled={!supported}>Start listening</button>
              : <button className="ctl-btn on" onClick={stop}>Stop listening</button>}
            <span className={listening ? "ctl-status ok" : "ctl-status"}>{state === "listening" ? "● listening" : listening ? `● ${state}` : "○ off"}</span>
          </div>
          <div style={{ marginTop: 12 }}><MicPicker mic={mic} disabled={listening} webSpeech /></div>
          {!supported && <p className="ctl-note">No speech recognition in this browser. Use Chrome.</p>}
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="transcript" aria-live="polite">
            {lines.length ? lines.map((l) => <p key={l.key} className={l.final ? "" : "interim"}>{l.text}</p>) : <p className="interim">Say something. Try “hello world”, then “moon”.</p>}
          </div>
          <form className="ctl-row" onSubmit={sendTyped} style={{ marginTop: 10 }}>
            <input className="ctl-input" style={{ flex: 1 }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="No mic? Type a line here and press Enter" />
          </form>
        </div>
        <div className="ctl-panel">
          <h2>Trigger words</h2>
          <div className="ctl-row">
            {triggers.map((t) => <span key={t.say} className="chip"><b>{t.say}</b> → {t.cue.label || t.cue.kind}</span>)}
          </div>
          <p className="ctl-note">Change them in <code>nextjs/lib/voice/triggers.js</code>.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
        </div>
        <div className="ctl-panel">
          <h2>Fired</h2>
          <ul className="ctl-log">
            {log.map((l, i) => <li key={i}>{l.t} heard <b>{l.say}</b> → {l.label}{l.final ? " (final)" : " (interim: fired while you were still talking)"}</li>)}
            {!log.length && <li>Nothing yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
