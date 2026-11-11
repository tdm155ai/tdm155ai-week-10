"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { buttons } from "../launch/buttons.js";
import { align, parseScript } from "./follow.js";
import { cues as scriptCues, text as scriptText, title as scriptTitle } from "./script.js";
import { startOpenAILive } from "./openai-live.js";
import { speechSupported, startListening, words } from "./speech.js";

// /voice/script: read a text aloud; the page follows along (like surtitles) and fires each cue as you reach its
// word. The text and cues are in lib/voice/script.js; you can paste another text on the page.

const STORE = "tdm155ai-voice-script";

function lookupCue(name) {
  if (scriptCues[name]) return { id: name, ...scriptCues[name] };
  const b = buttons.find((x) => x.id === name);
  if (b) { const { key, color, ...cue } = b; return cue; }
  return null;
}

export default function ScriptFollower() {
  const [source, setSource] = useState(scriptText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState(0);
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [log, setLog] = useState([]);
  const [surtitles, setSurtitles] = useState(false);
  const [supported, setSupported] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const script = useMemo(() => parseScript(source), [source]);
  const scriptRef = useRef(script);
  const committed = useRef(0); // the place: the next word expected
  const bases = useRef(new Map()); // each phrase the recognizer sends is matched from where the place was when it began
  const [engine, setEngine] = useState("webspeech");
  const liveRef = useRef(null);
  const fired = useRef(new Set());
  const stopRef = useRef(null);
  const simRef = useRef(null);
  const lineRef = useRef(-1);
  const surRef = useRef(false);

  useEffect(() => { scriptRef.current = script; }, [script]);
  useEffect(() => { surRef.current = surtitles; }, [surtitles]);
  useEffect(() => {
    setSupported(speechSupported());
    try { const saved = localStorage.getItem(STORE); if (saved) setSource(saved); } catch {}
  }, []);

  // Fire every cue on a word the reader has now passed (each once).
  const advance = useCallback((next, how) => {
    const { list } = scriptRef.current;
    for (let i = 0; i < next; i++) {
      const w = list[i];
      if (!w?.cues || fired.current.has(i)) continue;
      fired.current.add(i);
      for (const name of w.cues) {
        const cue = lookupCue(name);
        if (cue) fireCue(cue);
        setLog((l) => [{ t: new Date().toLocaleTimeString(), word: w.text, name, label: cue ? cue.label || cue.kind : "no cue by that name", how }, ...l].slice(0, 40));
      }
    }
    setPos(next);
    const lineIndex = scriptRef.current.lines.findIndex((line) => line.some((w) => w.index === Math.max(0, next - 1)));
    if (surRef.current && lineIndex !== lineRef.current && lineIndex >= 0) {
      fireCue({ id: "surtitle", label: "Surtitle", kind: "text", src: scriptRef.current.lines[lineIndex].map((w) => w.text).join(" "), options: { size: "4.5vw", fadeIn: 0.2 } });
    }
    lineRef.current = lineIndex;
  }, []);

  const onResult = useCallback((r) => {
    setHeard(r.text);
    const key = `${r.session}:${r.index}`;
    if (!bases.current.has(key)) bases.current.set(key, committed.current);
    const next = align(scriptRef.current.list, bases.current.get(key), words(r.text));
    committed.current = Math.max(committed.current, next); // the place only moves forward (click a word to go back)
    advance(committed.current, r.final ? "final" : "interim");
  }, [advance]);

  // Jump to a word by hand (click it): cues before it count as done, so nothing fires in a burst.
  const jump = (index) => {
    fired.current = new Set(scriptRef.current.list.filter((w) => w.cues && w.index < index).map((w) => w.index));
    committed.current = index;
    bases.current = new Map();
    lineRef.current = -1;
    setPos(index);
  };

  // The operator's backup: fire the next cue now, and move the place to its word.
  const goNext = useCallback(() => {
    const w = scriptRef.current.list.find((x) => x.cues && !fired.current.has(x.index));
    if (!w) return;
    committed.current = w.index + 1;
    bases.current = new Map();
    advance(w.index + 1, "Go (by hand)");
  }, [advance]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext]);

  const start = async () => {
    setError("");
    bases.current = new Map();
    if (engine === "webspeech") { stopRef.current = startListening({ onResult, onState: setState, onError: (e) => setError(e.message) }); return; }
    try {
      setState("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const cueWords = scriptRef.current.list.filter((w) => w.cues).map((w) => w.text.replace(/[^\p{L}'-]+/gu, ""));
      const live = await startOpenAILive({
        stream, delay: "minimal", keywords: cueWords,
        prompt: `Someone reading this text aloud: ${scriptRef.current.list.map((w) => w.text).join(" ").slice(0, 900)}`,
        onResult, onState: (s) => setState(s === "closed" || s === "stopped" ? "off" : s), onError: (e) => setError(e.message),
      });
      liveRef.current = live;
      stopRef.current = () => { live.stop(); stream.getTracks().forEach((t) => t.stop()); liveRef.current = null; };
    } catch (e) { setError(e.message); setState("off"); }
  };
  const stop = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  const stopSim = () => { clearInterval(simRef.current); simRef.current = null; setSimulating(false); };
  useEffect(() => () => { stopRef.current?.(); clearInterval(simRef.current); }, []);

  // No microphone (or a demo): read the script aloud in the browser's head, word by word, with some mistakes.
  const simulate = () => {
    if (simRef.current) return stopSim();
    const lines = scriptRef.current.lines.map((line) => line.map((w) => w.text));
    let li = Math.max(0, scriptRef.current.lines.findIndex((line) => line.some((w) => w.index >= committed.current)));
    let wi = 0;
    let said = [];
    let index = 0;
    setSimulating(true);
    simRef.current = setInterval(() => {
      const line = lines[li];
      if (!line) return stopSim();
      const word = line[wi];
      const r = Math.random();
      if (r < 0.08) said.push(word.slice(0, -1) + "e"); // misheard
      else if (r > 0.95) {} // dropped
      else said.push(word);
      wi += 1;
      const final = wi >= line.length;
      onResult({ index, text: said.join(" "), final, session: "sim" });
      if (final) { li += 1; wi = 0; said = []; index += 1; }
    }, 380);
  };

  const reset = () => { stopSim(); jump(0); setLog([]); setHeard(""); };
  const saveDraft = () => { setSource(draft); setEditing(false); try { localStorage.setItem(STORE, draft); } catch {} reset(); };
  const backToFile = () => { setSource(scriptText); try { localStorage.removeItem(STORE); } catch {} reset(); };

  const listening = ["listening", "restarting", "connecting", "getting a token"].includes(state);
  const at = Math.max(0, pos - 1);
  const lineIndex = Math.max(0, script.lines.findIndex((line) => line.some((w) => w.index === at)));
  const current = script.lines[lineIndex] || [];
  const nextLine = script.lines[lineIndex + 1] || [];

  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <div className="ctl-row">
            {!listening
              ? <button className="ctl-btn primary" onClick={start} disabled={engine === "webspeech" && !supported}>Start listening</button>
              : <button className="ctl-btn on" onClick={stop}>Stop listening ({state})</button>}
            <select className="ctl-select" value={engine} onChange={(e) => setEngine(e.target.value)} disabled={listening} title="Which engine listens">
              <option value="webspeech">with Web Speech (free)</option>
              <option value="openai">with OpenAI (key, cue words as hints)</option>
            </select>
            <button className={simulating ? "ctl-btn on" : "ctl-btn"} onClick={simulate}>{simulating ? "Stop the simulation" : "No mic? Simulate a reader"}</button>
            <button className="ctl-btn" onClick={goNext} title="Space">Go: next cue by hand</button>
            <button className="ctl-btn" onClick={reset}>Back to the top</button>
          </div>
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="surtitle">
            <p className="sur-now">{current.map((w) => <span key={w.index} className={w.index < pos ? "read" : ""}>{w.text} </span>)}</p>
            <p className="sur-next">{nextLine.map((w) => w.text).join(" ")}</p>
          </div>
          <p className="ctl-note">Heard: <span style={{ color: "var(--ink)" }}>{heard || "…"}</span></p>
          <label className="ctl-note ctl-row"><input type="checkbox" checked={surtitles} onChange={(e) => setSurtitles(e.target.checked)} /> Also show each line on the stage, as surtitles (replaces the picture)</label>
        </div>

        <div className="ctl-panel">
          <div className="ctl-row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{source === scriptText ? scriptTitle : "Your text"} · click a word to jump there</h2>
            {!editing && <button className="ctl-btn" onClick={() => { setDraft(source); setEditing(true); }}>Paste or edit the text</button>}
          </div>
          {editing ? (
            <>
              <p className="ctl-note">Mark a cue with <code>[[name]]</code> after its word. Names come from <code>cues</code> in <code>lib/voice/script.js</code> or the button ids in <code>lib/launch/buttons.js</code> (title, ping, dawn, chord, fractal, red, wind, moon, out).</p>
              <textarea className="ctl-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
              <div className="ctl-row"><button className="ctl-btn primary" onClick={saveDraft}>Use this text</button><button className="ctl-btn" onClick={() => setEditing(false)}>Cancel</button>{source !== scriptText && <button className="ctl-btn" onClick={backToFile}>Back to the sonnet</button>}</div>
            </>
          ) : (
            <div className="script-text">
              {script.lines.map((line, i) => (
                <p key={i}>
                  {line.map((w) => (
                    <span key={w.index} onClick={() => jump(w.index)} className={`${w.index < pos ? "read" : ""}${w.index === pos ? " here" : ""}`}>
                      {w.text}{w.cues && w.cues.map((c) => <sup key={c} className={fired.current.has(w.index) ? "cue-mark fired" : "cue-mark"}>{c}</sup>)}{" "}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}
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
            {log.map((l, i) => <li key={i}>{l.t} at <b>{l.word}</b> → {l.name} ({l.label}) · {l.how}</li>)}
            {!log.length && <li>Nothing yet. Start listening and read from the top.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
