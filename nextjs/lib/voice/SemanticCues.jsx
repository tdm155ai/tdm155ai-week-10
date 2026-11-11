"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import { speechSupported, startListening, words } from "./speech.js";
import { topics } from "./topics.js";

// /voice/semantic: two lanes. The slow lane: at each pause, the last few sentences go to a small AI model
// (app/voice/decide/route.js) with the topics in lib/voice/topics.js, and it answers { cue, confidence, arm } as JSON;
// a confident new topic fires its cue. The fast lane: if the model "armed" a topic (it thinks it's coming), the first
// of that topic's words to show up in the live transcript fires it at once, without waiting for the model.

const LECTURE = [
  "Good afternoon. I want to start somewhere quiet, late in the evening, when the light is gone.",
  "If you go outside after midnight and wait, your eyes adjust and the sky fills up with points of light.",
  "Ancient sailors steered by them, across open water, through storms and gales that could last for days.",
  "But my real subject today is the way simple rules can make astonishing structure.",
  "Take a shape, shrink it, repeat it inside itself, and repeat that forever: you get infinite detail on a finite page.",
  "The same thing happens in living systems. Cells divide, populations compete, and over generations evolution builds whole ecosystems.",
  "And then, every so often, someone writes a poem about a person they adore, and none of this seems to matter at all.",
];

export default function SemanticCues() {
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState([]); // [{ key, text, final }]
  const [decisions, setDecisions] = useState([]);
  const [current, setCurrent] = useState("none");
  const [armed, setArmed] = useState("none");
  const [threshold, setThreshold] = useState(0.7);
  const [thinking, setThinking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [typed, setTyped] = useState("");
  const [lecturing, setLecturing] = useState(false);
  const textRef = useRef(new Map()); // key -> text
  const currentRef = useRef("none");
  const armedRef = useRef("none");
  const thresholdRef = useRef(0.7);
  const busy = useRef(false);
  const pending = useRef(false);
  const stopRef = useRef(null);
  const lectureRef = useRef(null);
  const typedIndex = useRef(0);

  useEffect(() => setSupported(speechSupported()), []);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  const show = useCallback((id, how) => {
    const t = topics.find((x) => x.id === id);
    if (!t || id === currentRef.current) return false;
    fireCue({ id: t.id, ...t.cue });
    currentRef.current = id; setCurrent(id);
    if (armedRef.current === id) { armedRef.current = "none"; setArmed("none"); }
    setDecisions((d) => [{ t: new Date().toLocaleTimeString(), fired: true, cue: id, how }, ...d].slice(0, 40));
    return true;
  }, []);

  const recent = () => [...textRef.current.values()].join(" ").split(/\s+/).slice(-60).join(" ");

  const decide = useCallback(async () => {
    if (busy.current) { pending.current = true; return; }
    busy.current = true; setThinking(true);
    try {
      const res = await fetch("/voice/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: recent(), topics: topics.map(({ id, about }) => ({ id, about })), current: currentRef.current }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `decide: ${res.status}`);
      setDecisions((list) => [{ t: new Date().toLocaleTimeString(), ...d }, ...list].slice(0, 40));
      if (d.cue !== "none" && d.confidence >= thresholdRef.current) show(d.cue, `model, ${Math.round(d.confidence * 100)}%`);
      if (d.arm && d.arm !== currentRef.current) { armedRef.current = d.arm; setArmed(d.arm); }
    } catch (e) { setError(e.message); }
    busy.current = false; setThinking(false);
    if (pending.current) { pending.current = false; decide(); }
  }, [show]);

  const onResult = useCallback((r) => {
    const key = `${r.session}:${r.index}`;
    textRef.current.set(key, r.text);
    if (textRef.current.size > 30) textRef.current.delete(textRef.current.keys().next().value);
    setTranscript((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      const line = { key, text: r.text, final: r.final };
      if (i >= 0) { const next = prev.slice(); next[i] = line; return next; }
      return [...prev, line].slice(-14);
    });
    // Fast lane: an armed topic fires on its first word.
    const a = topics.find((t) => t.id === armedRef.current);
    if (a?.words?.length) {
      const heard = words(r.text);
      const hit = a.words.find((w) => heard.includes(w.toLowerCase()));
      if (hit) show(a.id, `armed, heard “${hit}”`);
    }
    // Slow lane: ask the model at every pause.
    if (r.final) decide();
  }, [decide, show]);

  const start = () => { setError(""); stopRef.current = startListening({ onResult, onState: setState, onError: (e) => setError(e.message) }); };
  const stop = () => { stopRef.current?.(); stopRef.current = null; setState("off"); };
  const stopLecture = () => { clearInterval(lectureRef.current); lectureRef.current = null; setLecturing(false); };
  useEffect(() => () => { stopRef.current?.(); clearInterval(lectureRef.current); }, []);

  // No mic: a short lecture, a sentence every few seconds, wandering across the topics without naming most of them.
  const lecture = () => {
    if (lectureRef.current) return stopLecture();
    let i = 0;
    setLecturing(true);
    const next = () => {
      if (i >= LECTURE.length) return stopLecture();
      typedIndex.current += 1;
      onResult({ index: typedIndex.current, text: LECTURE[i], final: true, session: "lecture" });
      i += 1;
    };
    next();
    lectureRef.current = setInterval(next, 4500);
  };

  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    typedIndex.current += 1;
    onResult({ index: typedIndex.current, text: typed, final: true, session: "typed" });
    setTyped("");
  };

  const listening = state === "listening" || state === "restarting";
  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <div className="ctl-row">
            {!listening ? <button className="ctl-btn primary" onClick={start} disabled={!supported}>Start listening</button> : <button className="ctl-btn on" onClick={stop}>Stop listening</button>}
            <button className={lecturing ? "ctl-btn on" : "ctl-btn"} onClick={lecture}>{lecturing ? "Stop the lecture" : "No mic? Play a sample lecture"}</button>
            <label className="ctl-note slider-row" style={{ gridTemplateColumns: "auto 120px 40px", margin: 0 }}>
              <span>fire above</span>
              <input type="range" min="0.3" max="0.95" step="0.05" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
              <output>{Math.round(threshold * 100)}%</output>
            </label>
            <span className={thinking ? "ctl-status ok" : "ctl-status"}>{thinking ? "● the model is thinking" : "○"}</span>
          </div>
          {error && <p className="ctl-note" style={{ color: "var(--error)" }}>{error}</p>}
          <div className="transcript" aria-live="polite">
            {transcript.length ? transcript.map((l) => <p key={l.key} className={l.final ? "" : "interim"}>{l.text}</p>) : <p className="interim">Talk about anything. Wander between the topics; you don't have to name them.</p>}
          </div>
          <form className="ctl-row" onSubmit={sendTyped} style={{ marginTop: 10 }}>
            <input className="ctl-input" style={{ flex: 1 }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a sentence and press Enter" />
          </form>
        </div>
        <div className="ctl-panel">
          <h2>Topics</h2>
          <div className="topic-list">
            {topics.map((t) => (
              <div key={t.id} className={`topic${current === t.id ? " on" : ""}${armed === t.id ? " armed" : ""}`}>
                <b>{t.id}</b> <span className="ctl-status">{current === t.id ? "on stage" : armed === t.id ? `armed: ${t.words?.join(", ")}` : ""}</span>
                <span className="ctl-note">{t.about} → {t.cue.label}</span>
              </div>
            ))}
          </div>
          <p className="ctl-note">Change them in <code>nextjs/lib/voice/topics.js</code>.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
        </div>
        <div className="ctl-panel">
          <h2>The model's calls</h2>
          <ul className="ctl-log">
            {decisions.map((d, i) => d.fired
              ? <li key={i}>{d.t} <b>→ {d.cue} on stage</b> ({d.how})</li>
              : <li key={i}>{d.t} {d.cue === "none" ? "no topic" : <b>{d.cue}</b>} {Math.round((d.confidence || 0) * 100)}%{d.arm && d.arm !== "none" ? ` · arm ${d.arm}` : ""} · {d.ms} ms · {d.reason}</li>)}
            {!decisions.length && <li>Each pause in your speech asks the model once.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
