"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fireCue, panic } from "../stage/stage.js";
import Stage from "../stage/Stage.jsx";
import StageBar from "../stage/StageBar.jsx";
import fromFile from "./cue-list.json";

// /launch/cue-list: a QLab-style cue list. The highlighted cue is standing by; Go (Space) fires it and moves on.
// Back (← or Backspace) moves the playhead up without firing; Panic (Esc) blacks out. The list comes from
// lib/launch/cue-list.json; edits on the page are kept in this browser until you copy them back into the file.

const STORE = "tdm155ai-cue-list";

export default function CueList() {
  const [list, setList] = useState(fromFile);
  const [at, setAt] = useState(0);
  const [fired, setFired] = useState(-1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");
  const [edited, setEdited] = useState(false);
  const atRef = useRef(0);
  const listRef = useRef(fromFile);
  const rowRefs = useRef([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved?.cues?.length) { setList(saved); listRef.current = saved; setEdited(true); }
    } catch {}
  }, []);

  const move = (i) => {
    const n = listRef.current.cues.length;
    atRef.current = Math.max(0, Math.min(n, i));
    setAt(atRef.current);
    rowRefs.current[atRef.current]?.scrollIntoView({ block: "nearest" });
  };

  const go = useCallback(() => {
    const cue = listRef.current.cues[atRef.current];
    if (!cue) return;
    fireCue(cue);
    setFired(atRef.current);
    move(atRef.current + 1);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); go(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "Backspace") { e.preventDefault(); move(atRef.current - 1); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(atRef.current + 1); }
      else if (e.key === "Escape") { e.preventDefault(); panic(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const openEditor = () => { setDraft(JSON.stringify(listRef.current, null, 2)); setProblem(""); setEditing(true); };
  const saveDraft = () => {
    try {
      const next = JSON.parse(draft);
      if (!Array.isArray(next.cues)) throw new Error("needs a \"cues\" list");
      next.cues.forEach((c, i) => { if (!c.kind) throw new Error(`cue ${i + 1} has no kind`); });
      setList(next); listRef.current = next; setEdited(true); setEditing(false); move(0);
      try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
    } catch (e) { setProblem(e.message); }
  };
  const resetToFile = () => { try { localStorage.removeItem(STORE); } catch {} setList(fromFile); listRef.current = fromFile; setEdited(false); move(0); };
  const download = () => {
    const blob = new Blob([JSON.stringify(listRef.current, null, 2) + "\n"], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "cue-list.json" });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const standby = list.cues[at];
  return (
    <div className="ctl-grid">
      <div>
        <div className="ctl-panel">
          <div className="ctl-row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{list.title || "Cue list"}{edited ? " (edited here)" : ""}</h2>
            <span className="ctl-status">{at < list.cues.length ? `standing by: ${at + 1}` : "end of list"}</span>
          </div>
          <div className="go-row">
            <button className="go-btn" onClick={go} disabled={!standby}>GO<span>{standby ? `${at + 1} · ${standby.label}` : "end"}</span></button>
            <div className="ctl-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="ctl-btn" onClick={() => move(at - 1)}>↑ Back</button>
              <button className="ctl-btn" onClick={() => move(at + 1)}>↓ Skip</button>
              <button className="ctl-btn danger" onClick={() => panic()}>Panic</button>
            </div>
          </div>
          <ol className="cue-rows">
            {list.cues.map((c, i) => (
              <li key={`${c.id}-${i}`} ref={(el) => { rowRefs.current[i] = el; }} className={`${i === at ? "standby" : ""}${i === fired ? " fired" : ""}${i < at ? " done" : ""}`} onClick={() => move(i)}>
                <span className="cue-num">{i + 1}</span>
                <span className="cue-kind">{c.kind}</span>
                <span className="cue-label">{c.label || c.id}</span>
                <span className="cue-src">{c.kind === "text" ? `“${c.src}”` : c.src || ""}</span>
              </li>
            ))}
          </ol>
          <p className="ctl-note"><code>Space</code> Go · <code>↑</code>/<code>Backspace</code> back · <code>↓</code> skip · <code>Esc</code> panic · click a row to stand by on it.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Stage</h2>
          <StageBar />
          <div style={{ marginTop: 14 }}><Stage preview /></div>
        </div>
        <div className="ctl-panel">
          <h2>Edit the list</h2>
          <p className="ctl-note">The list is <code>nextjs/lib/launch/cue-list.json</code>: change it there (or ask Claude Code to), or edit it here. Edits here stay in this browser; download them to keep them.</p>
          {!editing ? (
            <div className="ctl-row">
              <button className="ctl-btn" onClick={openEditor}>Edit here</button>
              <button className="ctl-btn" onClick={download}>Download JSON</button>
              {edited && <button className="ctl-btn" onClick={resetToFile}>Back to the file</button>}
            </div>
          ) : (
            <>
              <textarea className="ctl-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
              {problem && <p className="ctl-note" style={{ color: "var(--error)" }}>Not saved: {problem}</p>}
              <div className="ctl-row"><button className="ctl-btn primary" onClick={saveDraft}>Save</button><button className="ctl-btn" onClick={() => setEditing(false)}>Cancel</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
