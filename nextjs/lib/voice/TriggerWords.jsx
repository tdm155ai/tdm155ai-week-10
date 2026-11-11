"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { buttons } from "../launch/buttons.js";
import { startWebSpeech, useMic } from "./mic.js";
import MicPicker from "./MicPicker.jsx";
import { speechSupported, triggerWatcher } from "./speech.js";
import { triggers as fileTriggers } from "./triggers.js";

// /voice/words: your own trigger words. Each row is a word or phrase and the stage cue it fires. Edit the list on the
// page (it's saved in this browser), test each row by hand, then say the words. Literal matching, no AI model: the
// same matcher as /voice (lib/voice/speech.js triggerWatcher), whole words, as soon as Chrome writes them down.
// "Copy as code" gives you the list in the format of lib/voice/triggers.js, the file behind /voice.

const STORE = "tdm155ai-voice-words";

// The cues a row can fire: everything on /launch (lib/launch/buttons.js) and /voice (lib/voice/triggers.js), plus
// "show the word itself" as a text cue.
const PALETTE = (() => {
  const list = [];
  const seen = new Set();
  for (const { key, color, ...cue } of buttons) if (!seen.has(cue.id)) { seen.add(cue.id); list.push(cue); }
  for (const { cue } of fileTriggers) if (!seen.has(cue.id)) { seen.add(cue.id); list.push(cue); }
  return list;
})();
const SAY_IT = "__say__"; // a text cue with the trigger's own words

const DEFAULT_ROWS = [
  { say: "lights up", cue: "light", on: true },
  { say: "blackout", cue: "out", on: true },
  { say: "thunder", cue: "chord", on: true },
  { say: "full moon", cue: "moon", on: true },
  { say: "welcome", cue: SAY_IT, on: true },
];

function cueFor(row) {
  if (row.cue === SAY_IT) return { id: `say-${row.say}`, label: row.say, kind: "text", src: row.say, options: { size: "12vw" } };
  return PALETTE.find((c) => c.id === row.cue) || null;
}

export default function TriggerWords() {
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cooldown, setCooldown] = useState(1.5);
  const [finalOnly, setFinalOnly] = useState(false);
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]);
  const [last, setLast] = useState(null); // { say, label, at, final }
  const [stats, setStats] = useState({}); // say -> { count, at }
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const [supported, setSupported] = useState(true);
  const mic = useMic();
  const rowsRef = useRef(rows);
  const finalOnlyRef = useRef(finalOnly);
  const stopRef = useRef(null);
  const typedIndex = useRef(0);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { finalOnlyRef.current = finalOnly; }, [finalOnly]);
  useEffect(() => {
    setSupported(speechSupported());
    try { const saved = JSON.parse(localStorage.getItem(STORE) || "null"); if (Array.isArray(saved) && saved.length) setRows(saved); } catch {}
  }, []);
  const save = (next) => { setRows(next); try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {} };
  const update = (i, patch) => save(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const fire = useCallback((row, how) => {
    const cue = cueFor(row);
    if (!cue) return;
    fireCue(cue);
    const at = new Date().toLocaleTimeString();
    setLast({ say: row.say, label: cue.label || cue.kind, at, how });
    setStats((s) => ({ ...s, [row.say]: { count: (s[row.say]?.count || 0) + 1, at } }));
  }, []);

  // The matcher: rebuilt when the re-arm time changes; it reads the current rows every time.
  const watch = useMemo(() => triggerWatcher(
    () => rowsRef.current.filter((r) => r.on && r.say.trim()),
    (row, info) => fire(row, info.final ? "heard (final)" : "heard (while still talking)"),
    { cooldown },
  ), [cooldown, fire]);

  const onResult = useCallback((r) => {
    if (!finalOnlyRef.current || r.final) watch(r);
    const key = `${r.session}:${r.index}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      const line = { key, text: r.text, final: r.final };
      if (i >= 0) { const next = prev.slice(); next[i] = line; return next; }
      return [...prev, line].slice(-12);
    });
  }, [watch]);

  const start = async () => { setError(""); setState("starting"); stopRef.current = await startWebSpeech(mic, { onResult, onState: setState, onError: (e) => setError(e.message) }); };
  const stop = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  useEffect(() => () => stopRef.current?.(), []);
  const listening = !["off", "stopped"].includes(state);

  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    typedIndex.current += 1;
    onResult({ index: typedIndex.current, text: typed, final: true, session: "typed", at: performance.now() });
    setTyped("");
  };

  const copy = () => {
    const code = `export const triggers = [\n${rows.filter((r) => r.on && r.say.trim()).map((r) => `  { say: ${JSON.stringify(r.say.trim().toLowerCase())}, cue: ${JSON.stringify(cueFor(r))} },`).join("\n")}\n];\n`;
    navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <h2>Your trigger words</h2>
          <table className="words-table">
            <thead><tr><th>On</th><th>Say</th><th>Fires</th><th /><th>Fired</th><th /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={last?.say === r.say ? "words-hit" : ""}>
                  <td><input type="checkbox" checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} aria-label={`Use ${r.say}`} /></td>
                  <td><input className="ctl-input" value={r.say} placeholder="a word or phrase" onChange={(e) => update(i, { say: e.target.value })} /></td>
                  <td>
                    <select className="ctl-select" value={r.cue} onChange={(e) => update(i, { cue: e.target.value })}>
                      <option value={SAY_IT}>show the words (text)</option>
                      {PALETTE.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.kind})</option>)}
                    </select>
                  </td>
                  <td><button className="ctl-btn" onClick={() => fire(r, "Test button")}>Test</button></td>
                  <td className="ctl-status">{stats[r.say] ? `${stats[r.say].count}× · ${stats[r.say].at}` : "—"}</td>
                  <td><button className="ctl-btn" onClick={() => save(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.say}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ctl-row" style={{ marginTop: 10 }}>
            <button className="ctl-btn" onClick={() => save([...rows, { say: "", cue: SAY_IT, on: true }])}>+ Add a word</button>
            <button className="ctl-btn" onClick={copy}>{copied ? "Copied: paste over lib/voice/triggers.js" : "Copy as code"}</button>
            <button className="ctl-btn" onClick={() => save(DEFAULT_ROWS)}>Reset</button>
          </div>
          <p className="ctl-note">Whole words only (“rose” doesn't fire on “roses”); a phrase fires when its words come in order. Your list is saved in this browser. Copy as code to keep it in <code>nextjs/lib/voice/triggers.js</code> (the list behind <a href="/voice">/voice</a>).</p>
        </div>

        <div className="ctl-panel">
          <h2>Listen</h2>
          <div className="ctl-row">
            {!listening
              ? <button className="ctl-btn primary" onClick={start} disabled={!supported}>Start listening</button>
              : <button className="ctl-btn on" onClick={stop}>Stop listening</button>}
            <span className={listening ? "ctl-status ok" : "ctl-status"}>{state === "listening" ? "● listening" : listening ? `● ${state}` : "○ off"}</span>
          </div>
          <div style={{ marginTop: 12 }}><MicPicker mic={mic} disabled={listening} webSpeech /></div>
          <label className="slider-row" style={{ gridTemplateColumns: "150px minmax(0,1fr) 44px" }}>
            <span>Re-arm after</span>
            <input type="range" min="0.3" max="6" step="0.1" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
            <output>{cooldown.toFixed(1)}s</output>
          </label>
          <label className="ctl-note"><input type="checkbox" checked={finalOnly} onChange={(e) => setFinalOnly(e.target.checked)} /> Wait for the end of the phrase (slower, fewer false hits; off = fire while you're still talking)</label>
          {!supported && <p className="ctl-note">No speech recognition in this browser. Use Chrome, or type below.</p>}
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="transcript" aria-live="polite">
            {lines.length ? lines.map((l) => <p key={l.key} className={l.final ? "" : "interim"}>{l.text}</p>) : <p className="interim">What Chrome hears shows up here (grey while it's still guessing).</p>}
          </div>
          <form className="ctl-row" onSubmit={sendTyped} style={{ marginTop: 10 }}>
            <input className="ctl-input" style={{ flex: 1 }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="No mic? Type a line and press Enter" />
          </form>
          <p className="ctl-note">A word fires once where it was said; the same word fires again after the re-arm time.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Last match</h2>
          {last ? <p className="words-last"><b>“{last.say}”</b> → {last.label}<small>{last.at} · {last.how}</small></p> : <p className="ctl-note">Nothing yet. Press a Test button, type a line, or say one of your words.</p>}
        </div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
        </div>
      </div>
    </div>
  );
}
