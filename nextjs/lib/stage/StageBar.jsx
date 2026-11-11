"use client";

import { useEffect, useRef, useState } from "react";
import { onStage, openStage, panic, pingStage } from "./stage.js";

// The strip every control page shows: open the stage window, whether one is answering, and the panic button.
export default function StageBar() {
  const [open, setOpen] = useState(false);
  const lastSeen = useRef(0);
  useEffect(() => {
    const stop = onStage((m) => { if (m.type === "status") { lastSeen.current = Date.now(); setOpen(true); } });
    pingStage();
    const timer = setInterval(() => { setOpen(Date.now() - lastSeen.current < 5000); pingStage(); }, 2000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  return (
    <div className="ctl-row">
      <button className="ctl-btn" onClick={() => openStage()}>Open stage window</button>
      <button className="ctl-btn danger" onClick={() => panic()} title="Blackout and fade every sound">Panic</button>
      <span className={open ? "ctl-status ok" : "ctl-status"}>{open ? "● stage open" : "○ no stage window yet: open one, click it once"}</span>
    </div>
  );
}
