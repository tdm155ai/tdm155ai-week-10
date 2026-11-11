"use client";

// LoopPanel: the loop's buttons, settings, and its grid of beats.
//
// Each row is a sound; each square is a 16th note (four to a beat). A filled
// square is a hit in the loop. Click a square to add or take away a hit. The
// line that moves across is where the loop is now.

import { useEffect, useMemo, useRef } from "react";
import { FINGERS } from "./lib/hands.js";
import { COUNT_IN_BEATS, LENGTHS, STEPS_PER_BEAT } from "./lib/looper.js";

const STEP_NAMES = ["", "e", "and", "a"];

export default function LoopPanel({ looper, loop, pads, label, onPreview }) {
  const playheadRef = useRef(null);
  const lightsRef = useRef(null);
  const countRef = useRef(null);
  const steps = loop.beats * STEPS_PER_BEAT;

  // One row per sound: the pads' sounds first, then any other sound in the loop.
  const rows = useMemo(() => {
    const seen = new Map();
    for (const pad of pads) {
      if (!seen.has(pad.sound)) seen.set(pad.sound, { sound: pad.sound, color: FINGERS[pad.finger].color });
    }
    for (const hit of loop.hits) if (!seen.has(hit.sound)) seen.set(hit.sound, { sound: hit.sound, color: null });
    return [...seen.values()];
  }, [pads, loop.hits]);

  const filled = useMemo(() => {
    const set = new Set();
    for (const hit of loop.hits) set.add(`${hit.sound}|${Math.floor(hit.t * STEPS_PER_BEAT + 1e-6)}`);
    return set;
  }, [loop.hits]);

  // Move the playhead and light the current beat, without re-rendering.
  useEffect(() => {
    const head = playheadRef.current;
    const lights = [...(lightsRef.current?.children ?? [])];
    const count = countRef.current;
    const reset = () => {
      head.style.opacity = "0";
      lights.forEach((el) => el.classList.remove("on", "count"));
      count.textContent = "";
    };
    if (!loop.playing) {
      reset();
      return;
    }
    let raf = 0;
    let shown = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pos = looper.position();
      if (pos === null) return;
      const counting = pos < 0;
      const beat = counting ? Math.floor(pos) + COUNT_IN_BEATS : Math.floor(pos);
      head.style.opacity = counting ? "0" : "1";
      if (!counting) head.style.left = `${(pos / loop.beats) * 100}%`;
      const key = `${counting}${beat}`;
      if (key === shown) return;
      shown = key;
      lights.forEach((el, i) => {
        el.classList.toggle("on", !counting && i === beat);
        el.classList.toggle("count", counting && i === beat);
      });
      count.textContent = counting ? `Count-in ${beat + 1}` : "";
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      reset();
    };
  }, [loop.playing, loop.beats, looper]);

  return (
    <section className="looper" aria-label="Loop">
      <div className="loop-head">
        <h2>Loop</h2>
        <div className="transport">
          <button
            type="button"
            className={`rec${loop.recording ? " on" : ""}`}
            aria-pressed={loop.recording}
            onClick={() => looper.toggleRecord()}
            title="Key: R"
          >
            <span className="rec-dot" aria-hidden="true" />
            {loop.recording ? "Recording" : "Record"}
          </button>
          <button type="button" onClick={() => looper.togglePlay()} title="Key: Space">
            {loop.playing ? "Stop" : "Play"}
          </button>
          <button type="button" onClick={() => looper.undo()} disabled={!loop.canUndo} title="Key: Z">
            Undo
          </button>
          <button type="button" onClick={() => looper.clear()} disabled={!loop.hits.length}>
            Clear
          </button>
        </div>
        <div ref={lightsRef} className="beat-lights" aria-hidden="true">
          {Array.from({ length: loop.beats }, (_, i) => (
            <i key={i} className={i % 4 === 0 ? "bar" : ""} />
          ))}
        </div>
        <span ref={countRef} className="count-in" aria-live="polite" />
      </div>

      <div className="loop-settings">
        <label className="field">
          <span>Tempo</span>
          <input type="range" min="40" max="220" step="1" value={loop.bpm} onChange={(e) => looper.setBpm(Number(e.target.value))} />
          <output>{loop.bpm} bpm</output>
        </label>
        <label className="field">
          <span>Length</span>
          <select value={loop.beats} onChange={(e) => looper.setBeats(Number(e.target.value))}>
            {LENGTHS.map((n) => (
              <option key={n} value={n}>
                {n} beats
              </option>
            ))}
          </select>
        </label>
        <label className="field" title="Rounds what you play to the nearest 16th or 8th note, so it lands on the beat.">
          <span>Snap</span>
          <select value={loop.snap} onChange={(e) => looper.setSnap(e.target.value)}>
            <option value="1/16">16th notes</option>
            <option value="1/8">8th notes</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={loop.click} onChange={(e) => looper.setClick(e.target.checked)} />
          Click on every beat
        </label>
      </div>

      <div className="grid-scroll">
        <div className="grid" style={{ "--steps": steps }}>
          <div className="grid-row grid-numbers" aria-hidden="true">
            <span className="row-label" />
            <div className="cells">
              {Array.from({ length: steps }, (_, s) => (
                <span key={s}>{s % STEPS_PER_BEAT === 0 ? s / STEPS_PER_BEAT + 1 : ""}</span>
              ))}
            </div>
          </div>
          {rows.map((row) => (
            <div className="grid-row" key={row.sound}>
              <span className="row-label" title={label(row.sound)}>
                <i style={row.color ? { background: row.color, borderColor: row.color } : undefined} />
                {label(row.sound)}
              </span>
              <div className="cells">
                {Array.from({ length: steps }, (_, s) => {
                  const on = filled.has(`${row.sound}|${s}`);
                  const beat = Math.floor(s / STEPS_PER_BEAT) + 1;
                  const part = STEP_NAMES[s % STEPS_PER_BEAT];
                  return (
                    <button
                      type="button"
                      key={s}
                      className={`cell${on ? " on" : ""}${s % STEPS_PER_BEAT === 0 ? " beat" : ""}${s % 16 === 0 ? " bar" : ""}`}
                      style={row.color ? { "--c": row.color } : undefined}
                      aria-pressed={on}
                      aria-label={`${label(row.sound)}, beat ${beat}${part ? ` ${part}` : ""}`}
                      onClick={() => {
                        if (looper.toggleStep(row.sound, s)) onPreview(row.sound);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div className="playhead-track" aria-hidden="true">
            <i ref={playheadRef} className="playhead" />
          </div>
        </div>
      </div>

      <p className="loop-hint">
        Press <strong>Record</strong> (<kbd>R</kbd>): after a count of four, everything you play is added to the loop, and it keeps going
        round so you can add more. Press Record again to stop adding. <kbd>Space</kbd> plays and stops, <kbd>Z</kbd> undoes the last
        thing you added, and clicking a square adds or takes away a hit.
      </p>
    </section>
  );
}
