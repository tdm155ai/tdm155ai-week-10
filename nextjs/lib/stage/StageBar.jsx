"use client";

import { useEffect, useRef, useState } from "react";
import { fireCue, onStage, openStage, panic, pingStage, setParam } from "./stage.js";
import { describeFilter } from "./fx.js";

// The strip every control page shows: open the stage window, whether one is answering, and the panic button.
export default function StageBar() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState({ fx: null, sink: false }); // the stage's effects and sound output, from its status
  const lastSeen = useRef(0);
  useEffect(() => {
    const stop = onStage((m) => { if (m.type === "status") { lastSeen.current = Date.now(); setOpen(true); setInfo({ fx: m.fx || null, sink: !!m.sink, started: !!m.started }); } });
    pingStage();
    const timer = setInterval(() => { setOpen(Date.now() - lastSeen.current < 5000); pingStage(); }, 2000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  const fxOn = !!info.fx && (Math.abs(info.fx.filter - 0.5) > 0.02 || info.fx.echo > 0.01);
  return (
    <div className="ctl-row">
      <button className="ctl-btn" onClick={() => openStage()}>Open stage window</button>
      <button className="ctl-btn danger" onClick={() => panic()} title="Blackout and fade every sound">Panic</button>
      <button className="ctl-btn" onClick={() => fireCue({ id: "test-sound", label: "Test sound", kind: "sound", src: "/samples/ping.mp3" })}>Test sound</button>
      <span className={open ? "ctl-status ok" : "ctl-status"}>{open ? (info.started ? "● stage window running: sound plays there" : "● stage window open but not started: click it once (until then, sound plays on this page)") : "○ no stage window: sound plays on this page (open the stage for the projector and PA)"}</span>
      {open && fxOn && (
        <span className="ctl-status" style={{ color: "var(--error)" }}>
          ⚠ stage effects on: filter {describeFilter(info.fx.filter)}{info.fx.echo > 0.01 ? `, echo ${Math.round(info.fx.echo * 100)}%` : ""}{" "}
          <button className="ctl-btn" onClick={() => { setParam("filter", 0.5); setParam("resonance", 0); setParam("echo", 0); }}>Reset effects</button>
        </span>
      )}
      {open && info.sink && <span className="ctl-status">sound → a chosen output (press O on the stage to change)</span>}
    </div>
  );
}
