"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { buttons } from "../launch/buttons.js";
import { follow, parseScript } from "./follow.js";
import { cues as scriptCues, text as scriptText, title as scriptTitle } from "./script.js";
import { startOpenAILive } from "./openai-live.js";
import { speechSupported, words } from "./speech.js";
import { startWebSpeech, useMic } from "./mic.js";
import MicPicker from "./MicPicker.jsx";

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
  const mic = useMic();
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [log, setLog] = useState([]);
  const [surtitles, setSurtitles] = useState(false);
  const [supported, setSupported] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [skipping, setSkipping] = useState(true);
  const [recovery, setRecovery] = useState(""); // the latest re-anchor, in words
  const skipped = useRef(new Set()); // cue words passed without firing (a jump, or a catch-up)
  const skippedWords = useRef(new Set()); // words jumped over
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

  const note = (entry) => setLog((l) => [{ t: new Date().toLocaleTimeString(), ...entry }, ...l].slice(0, 40));

  // Mark a cue word as passed without firing (it was skipped over, or is stale on catch-up).
  const skip = useCallback((w, why) => {
    if (fired.current.has(w.index)) return;
    fired.current.add(w.index);
    skipped.current.add(w.index);
    for (const name of w.cues) note({ word: w.text, name, label: "not fired", how: why, skipped: true });
  }, []);

  // Fire the cues on words the reader has now passed. Never a burst: if several unfired cues were passed at once
  // (a catch-up), only the latest fires and the earlier ones are marked skipped.
  const advance = useCallback((next, how) => {
    const { list } = scriptRef.current;
    const due = [];
    for (let i = 0; i < next; i++) if (list[i]?.cues && !fired.current.has(i)) due.push(list[i]);
    due.slice(0, -1).forEach((w) => skip(w, "passed at once; only the latest fires"));
    const w = due[due.length - 1];
    if (w) {
      fired.current.add(w.index);
      for (const name of w.cues) {
        const cue = lookupCue(name);
        if (cue) fireCue(cue);
        note({ word: w.text, name, label: cue ? cue.label || cue.kind : "no cue by that name", how });
      }
    }
    setPos(next);
    const lineIndex = scriptRef.current.lines.findIndex((line) => line.some((w) => w.index === Math.max(0, next - 1)));
    if (surRef.current && lineIndex !== lineRef.current && lineIndex >= 0) {
      fireCue({ id: "surtitle", label: "Surtitle", kind: "text", src: scriptRef.current.lines[lineIndex].map((w) => w.text).join(" "), options: { size: "4.5vw", fadeIn: 0.2 } });
    }
    lineRef.current = lineIndex;
  }, [skip]);

  const onResult = useCallback((r) => {
    setHeard(r.text);
    const key = `${r.session}:${r.index}`;
    if (!bases.current.has(key)) bases.current.set(key, committed.current);
    const { list } = scriptRef.current;
    const { pos: next, jumps } = follow(list, bases.current.get(key), words(r.text));
    // A re-anchor: the words between where we were and the recognized run were skipped; their cues never fire.
    for (const j of jumps) {
      if (j.to <= committed.current) continue; // already past it (the same phrase, recomputed)
      let n = 0;
      for (let i = Math.max(j.from, committed.current); i < j.to; i++) {
        skippedWords.current.add(i); n++;
        if (list[i].cues) skip(list[i], `skipped: lost the place, found it at “${list.slice(j.to, j.end).map((w) => w.text).join(" ")}”`);
      }
      if (n) setRecovery(`Lost the place after “${list[Math.max(0, j.from - 1)]?.text || "the start"}”, found it again at “${list.slice(j.to, j.end).map((w) => w.text).join(" ")}”: skipped ${n} word${n === 1 ? "" : "s"}.`);
    }
    committed.current = Math.max(committed.current, next); // the place only moves forward (click a word to go back)
    advance(committed.current, r.final ? "final" : "interim");
  }, [advance, skip]);

  // Jump to a word by hand (click it): cues before it count as done, so nothing fires in a burst.
  const jump = (index) => {
    fired.current = new Set(scriptRef.current.list.filter((w) => w.cues && w.index < index).map((w) => w.index));
    skipped.current = new Set();
    skippedWords.current = new Set();
    setRecovery("");
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
    if (engine === "webspeech") { setState("starting"); stopRef.current = await startWebSpeech(mic, { onResult, onState: setState, onError: (e) => setError(e.message) }); return; }
    try {
      setState("connecting");
      const stream = await mic.open();
      const cueWords = scriptRef.current.list.filter((w) => w.cues).map((w) => w.text.replace(/[^\p{L}'-]+/gu, ""));
      const live = await startOpenAILive({
        stream, delay: "minimal", keywords: cueWords,
        prompt: `Someone reading this text aloud: ${scriptRef.current.list.map((w) => w.text).join(" ").slice(0, 900)}`,
        onResult, onState: (s) => setState(s === "closed" || s === "stopped" ? "off" : s), onError: (e) => setError(e.message),
      });
      liveRef.current = live;
      stopRef.current = () => { live.stop(); mic.close(); liveRef.current = null; };
    } catch (e) { setError(e.message); setState("off"); mic.close(); }
  };
  const stop = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  const stopSim = () => { clearInterval(simRef.current); simRef.current = null; setSimulating(false); };
  useEffect(() => () => { stopRef.current?.(); clearInterval(simRef.current); }, []);

  // No microphone (or a demo): read the script aloud in the browser's head, word by word, with some mistakes.
  // With "skip stretches" on, the reader (or the recognizer) also loses 9 words starting at the 3rd word of every
  // third line, from the 3rd line: longer than the step window, so the follower has to re-anchor further on.
  const simulate = () => {
    if (simRef.current) return stopSim();
    const { list, lines } = scriptRef.current;
    const lineOf = new Map();
    lines.forEach((line, li) => line.forEach((w, wi) => lineOf.set(w.index, { li, wi })));
    let k = committed.current;
    let said = [];
    let index = 0;
    const session = `sim-${Date.now()}`;
    setSimulating(true);
    simRef.current = setInterval(() => {
      const w = list[k];
      if (!w) return stopSim();
      const { li, wi } = lineOf.get(k);
      if (skipping && li % 3 === 2 && wi === 2) {
        k += 9; // a stretch nobody heard: the phrase ends here, the next starts after the gap
        if (said.length) onResult({ index, text: said.join(" "), final: true, session });
        said = []; index += 1;
        return;
      }
      const r = Math.random();
      if (r < 0.08) said.push(w.text.slice(0, -1) + "e"); // misheard
      else if (r > 0.96) {} // dropped
      else said.push(w.text);
      k += 1;
      const final = !list[k] || lineOf.get(k).li !== li;
      onResult({ index, text: said.join(" "), final, session });
      if (final) { said = []; index += 1; }
    }, 300);
  };

  const reset = () => { stopSim(); jump(0); setLog([]); setHeard(""); };
  const saveDraft = () => { setSource(draft); setEditing(false); try { localStorage.setItem(STORE, draft); } catch {} reset(); };
  const backToFile = () => { setSource(scriptText); try { localStorage.removeItem(STORE); } catch {} reset(); };

  const listening = !["off", "stopped", "closed"].includes(state);
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
            <label className="ctl-note ctl-row" title="The simulated reader loses 9 words every third line, to test recovery"><input type="checkbox" checked={skipping} onChange={(e) => setSkipping(e.target.checked)} disabled={simulating} /> skip stretches</label>
            <button className="ctl-btn" onClick={goNext} title="Space">Go: next cue by hand</button>
            <button className="ctl-btn" onClick={reset}>Back to the top</button>
          </div>
          <div style={{ marginTop: 12 }}><MicPicker mic={mic} disabled={listening} webSpeech={engine === "webspeech"} /></div>
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="surtitle">
            <p className="sur-now">{current.map((w) => <span key={w.index} className={w.index < pos ? "read" : ""}>{w.text} </span>)}</p>
            <p className="sur-next">{nextLine.map((w) => w.text).join(" ")}</p>
          </div>
          <p className="ctl-note">Heard: <span style={{ color: "var(--ink)" }}>{heard || "…"}</span></p>
          {recovery && <p className="ctl-note recovery">↷ {recovery}</p>}
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
                    <span key={w.index} onClick={() => jump(w.index)} className={`${w.index < pos ? "read" : ""}${w.index === pos ? " here" : ""}${skippedWords.current.has(w.index) ? " skipped" : ""}`}>
                      {w.text}{w.cues && w.cues.map((c) => <sup key={c} className={skipped.current.has(w.index) ? "cue-mark skipped" : fired.current.has(w.index) ? "cue-mark fired" : "cue-mark"} title={skipped.current.has(w.index) ? "skipped: not fired" : undefined}>{c}</sup>)}{" "}
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
            {log.map((l, i) => l.skipped
              ? <li key={i} className="skipped-entry">{l.t} <s>{l.name}</s> at {l.word}: {l.how}</li>
              : <li key={i}>{l.t} at <b>{l.word}</b> → {l.name} ({l.label}) · {l.how}</li>)}
            {!log.length && <li>Nothing yet. Start listening and read from the top.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
