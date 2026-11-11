"use client";

// The mic menu and its meter, for any page that listens. Pass the object from useMic() (lib/voice/mic.js).
// "Check" opens the mic so you can see the meter move before you start; it closes again when you start for real.
export default function MicPicker({ mic, disabled = false, webSpeech = false }) {
  const pct = Math.min(100, Math.round(Math.sqrt(mic.level) * 260)); // sqrt so quiet speech still shows
  return (
    <div className="mic-picker">
      <div className="ctl-row">
        <label className="ctl-note">Mic{" "}
          <select className="ctl-select" value={mic.id} onChange={(e) => mic.setId(e.target.value)} disabled={disabled}>
            <option value="">Default input</option>
            {mic.mics.filter((m) => m.id && m.id !== "default").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        {!disabled && (mic.live
          ? <button className="ctl-btn" onClick={mic.close}>Stop check</button>
          : <button className="ctl-btn" onClick={() => mic.open().catch(() => {})}>Check</button>)}
        <label className="ctl-note" title="Echo cancellation, noise suppression, and auto gain help in a noisy room but can swallow quiet voices">
          <input type="checkbox" checked={mic.raw} onChange={(e) => mic.setRaw(e.target.checked)} disabled={disabled} /> raw (no cleanup)
        </label>
      </div>
      <div className="mic-meter" aria-label="mic level"><span style={{ width: `${pct}%`, background: pct > 92 ? "var(--error)" : undefined }} /></div>
      <p className="ctl-note" style={{ margin: "4px 0 0" }}>
        {mic.live ? (pct < 4 ? "Open, but quiet: say something, or pick another mic." : "Hearing you.") : "Pick the mic, then Check: the bar should move when you talk."}
        {webSpeech && " Web Speech is asked to use this mic; if it seems to hear a different one, set the Mac's input in System Settings › Sound."}
      </p>
    </div>
  );
}
