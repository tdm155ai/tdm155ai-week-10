"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireCue } from "../stage/stage.js";
import StageBar from "../stage/StageBar.jsx";
import { startOpenAILive } from "./openai-live.js";
import { speechSupported, startListening, triggerWatcher } from "./speech.js";
import { triggers } from "./triggers.js";

// /voice/compare: two listeners on the same voice, side by side: Chrome's Web Speech (free, no key) and OpenAI's
// gpt-live-transcribe (a key, on the server). Both watch for the trigger words in lib/voice/triggers.js; the table
// shows which heard each word first and by how much. Fire cues from whichever hears it first, or from one engine.

const ENGINES = { ws: "Web Speech (Chrome)", oa: "OpenAI gpt-live-transcribe" };

function useTranscript() {
  const [lines, setLines] = useState([]);
  const add = useCallback((r) => {
    const key = `${r.session}:${r.index}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      const line = { key, text: r.text, final: r.final };
      if (i >= 0) { const next = prev.slice(); next[i] = line; return next; }
      return [...prev, line].slice(-25);
    });
  }, []);
  return [lines, add, () => setLines([])];
}

export default function CompareEngines() {
  const [mode, setMode] = useState("first");
  const [delay, setDelay] = useState("low");
  const [source, setSource] = useState("mic");
  const [fileUrl, setFileUrl] = useState("");
  const [wsState, setWsState] = useState("off");
  const [oaState, setOaState] = useState("off");
  const [errors, setErrors] = useState([]);
  const [level, setLevel] = useState(0);
  const [rows, setRows] = useState([]);
  const [wsLines, addWs, clearWs] = useTranscript();
  const [oaLines, addOa, clearOa] = useTranscript();
  const [supported, setSupported] = useState(true);
  const modeRef = useRef(mode);
  const occurrences = useRef([]);
  const wsStop = useRef(null);
  const oa = useRef(null);
  const media = useRef(null); // { stream, audio, ctx }

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => setSupported(speechSupported()), []);
  const err = (e) => setErrors((x) => [e.message || String(e), ...x].slice(0, 5));

  const heard = useCallback((engine, t) => {
    const now = performance.now();
    const other = engine === "ws" ? "oa" : "ws";
    let occ = [...occurrences.current].reverse().find((o) => o.say === t.say && o[engine] == null && o[other] != null && now - o[other] < 4000);
    const isNew = !occ;
    if (!occ) { occ = { id: occurrences.current.length, say: t.say, label: t.cue.label || t.cue.kind, ws: null, oa: null, firedBy: null, clock: new Date().toLocaleTimeString() }; occurrences.current.push(occ); }
    occ[engine] = now;
    const m = modeRef.current;
    if ((m === "first" && isNew) || m === engine) { fireCue(t.cue); occ.firedBy = engine; }
    setRows(occurrences.current.slice(-30).reverse().map((o) => ({ ...o })));
  }, []);

  const wsWatch = useMemo(() => triggerWatcher(() => triggers, (t) => heard("ws", t)), [heard]);
  const oaWatch = useMemo(() => triggerWatcher(() => triggers, (t) => heard("oa", t)), [heard]);

  const start = async () => {
    setErrors([]);
    // Web Speech listens to the default microphone on its own.
    if (speechSupported()) wsStop.current = startListening({ onResult: (r) => { wsWatch(r); addWs(r); }, onState: setWsState, onError: err });
    try {
      let stream;
      if (source === "file" && fileUrl) {
        const ctx = new AudioContext();
        const audio = new Audio(fileUrl);
        audio.crossOrigin = "anonymous";
        const node = ctx.createMediaElementSource(audio);
        const dest = ctx.createMediaStreamDestination();
        node.connect(dest);
        node.connect(ctx.destination); // you hear it too (and so does Web Speech, through the mic, if the speakers are on)
        stream = dest.stream;
        media.current = { stream, audio, ctx };
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        media.current = { stream };
      }
      oa.current = await startOpenAILive({
        stream, delay,
        keywords: triggers.map((t) => t.say),
        prompt: "A live performance: someone reading poetry or speaking cue words aloud in a theater studio.",
        onResult: (r) => { oaWatch(r); addOa(r); },
        onState: setOaState, onError: err, onLevel: setLevel,
      });
      // A recording starts once OpenAI is connected, so its first words aren't lost.
      if (media.current?.audio) setTimeout(() => media.current?.audio?.play().catch(err), 800);
    } catch (e) { err(e); setOaState("off"); }
  };

  const stop = () => {
    wsStop.current?.(); wsStop.current = null; setWsState("off");
    oa.current?.stop(); oa.current = null;
    const m = media.current;
    if (m) { m.stream?.getTracks().forEach((tr) => tr.stop()); m.audio?.pause(); m.ctx?.close(); media.current = null; }
    setOaState("off");
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { occurrences.current = []; setRows([]); clearWs(); clearOa(); };
  const active = ["getting a token", "connecting", "listening", "restarting"];
  const running = active.includes(wsState) || active.includes(oaState) || !!oa.current;
  const ms = (a, b) => (a != null && b != null ? Math.round(a - b) : null);

  return (
    <div>
      <div className="ctl-panel">
        <div className="ctl-row">
          {!running ? <button className="ctl-btn primary" onClick={start}>Start both</button> : <button className="ctl-btn on" onClick={stop}>Stop</button>}
          <label className="ctl-note">Fire cues from{" "}
            <select className="ctl-select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="first">whichever hears it first</option>
              <option value="ws">Web Speech only</option>
              <option value="oa">OpenAI only</option>
              <option value="none">neither (just compare)</option>
            </select>
          </label>
          <label className="ctl-note">OpenAI delay{" "}
            <select className="ctl-select" value={delay} onChange={(e) => setDelay(e.target.value)} disabled={running}>
              <option value="minimal">minimal (fastest)</option>
              <option value="low">low</option>
              <option value="medium">medium (more accurate)</option>
            </select>
          </label>
          <label className="ctl-note">OpenAI listens to{" "}
            <select className="ctl-select" value={source} onChange={(e) => setSource(e.target.value)} disabled={running}>
              <option value="mic">the microphone</option>
              <option value="file">a recording</option>
            </select>
          </label>
          {source === "file" && <input className="ctl-input" style={{ minWidth: 260 }} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="/media/my-reading.mp3" disabled={running} />}
          <button className="ctl-btn" onClick={clear}>Clear</button>
          <span className="ctl-status">level <span className="level"><span style={{ width: `${Math.min(100, level * 600)}%` }} /></span></span>
        </div>
        {!supported && <p className="ctl-note">No Web Speech in this browser (use Chrome); OpenAI still works.</p>}
        {errors.map((e, i) => <p key={i} className="ctl-note" style={{ color: "var(--error)" }}>{e}</p>)}
        <div style={{ marginTop: 12 }}><StageBar /></div>
      </div>

      <div className="compare-cols">
        {[["ws", wsLines, wsState], ["oa", oaLines, oaState]].map(([k, lines, st]) => (
          <div className="ctl-panel" key={k}>
            <h2>{ENGINES[k]} <span className={st === "listening" ? "ctl-status ok" : "ctl-status"}>· {st}</span></h2>
            <div className="transcript">
              {lines.length ? lines.map((l) => <p key={l.key} className={l.final ? "" : "interim"}>{l.text}</p>) : <p className="interim">…</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="ctl-panel">
        <h2>Who heard each trigger word first</h2>
        <table className="midi-table">
          <thead><tr><td>time</td><td>word</td><td>cue</td><td>Web Speech</td><td>OpenAI</td><td>fired by</td></tr></thead>
          <tbody>
            {rows.map((o) => {
              const d = ms(o.oa, o.ws);
              return (
                <tr key={o.id}>
                  <td className="ctl-status">{o.clock}</td>
                  <td><b>{o.say}</b></td>
                  <td>{o.label}</td>
                  <td>{o.ws != null ? (d != null && d > 0 ? <b>first</b> : d != null ? `+${-d} ms` : "heard") : "missed"}</td>
                  <td>{o.oa != null ? (d != null && d < 0 ? <b>first</b> : d != null ? `+${d} ms` : "heard") : "missed"}</td>
                  <td className="ctl-status">{o.firedBy ? ENGINES[o.firedBy].split(" ")[0] : "—"}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="ctl-note">Say the trigger words (moon, sun, rose, bell, wind, light, dark, quiet, “hello world”) in sentences.</td></tr>}
          </tbody>
        </table>
        <p className="ctl-note">“missed” can mean the engine didn't hear the word or hasn't yet: an OpenAI word arriving more than 4 seconds after Web Speech's counts as a new row.</p>
      </div>
    </div>
  );
}
