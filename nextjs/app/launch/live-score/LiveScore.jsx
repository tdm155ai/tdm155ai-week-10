'use client';

// From mk-audio-editing (ll-26-27), Bok to the Future, Oct 22: the live-score page (task A10, with its Zones launch
// mode), copied into TDM 155AI week 10 on 2026-11-11 (source commit 9aa1bd2; the source is unchanged). Changed for
// this app: MediaPipe's WASM matches this app's version (lib/cv/mediapipe.js), and the header links point here.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createLaunchTracker, launchScore, scoreFromRoom, zoneOf } from './mapping.mjs';
import { createMotion, createPose, readPeople, MOTION_GRID } from './sensing.mjs';
import { installMediaPipeInfoFilter, canTrackFrame } from './mediapipe-runtime.mjs';
import { SPEAKERS, VOICES } from './score.mjs';

const ZONES = VOICES.length;
const COLORS = ['#ff8a1f', '#7fc787', '#8ab4ff', '#e7a6ff', '#ffd86b'];
const WHY = { enter: 'entered', hand: 'hand up', reach: 'reached in' };

export default function LiveScore() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const run = useRef({ generation: 0, releaseInfo: null, score: null, pose: null, motion: null, stream: null, raf: 0, pointer: null, pointerDown: 0, flash: new Array(ZONES).fill(-Infinity), last: null, spot: { x: 0.5, y: 0.6 }, settings: {} });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [settings, setSettings] = useState({ mode: 'launch', depthFrom: 'size', camera: '', output: '', master: 0.8, drone: 1, pointer: false });
  const [view, setView] = useState(null);
  run.current.settings = settings;

  const note = msg => setStatus(s => [...s.slice(-5), msg]);

  async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter(d => d.kind === 'videoinput'));
    setOutputs(devices.filter(d => d.kind === 'audiooutput'));
  }

  async function startCamera(deviceId) {
    const r = run.current, generation = r.generation;
    r.stream?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { width: 1280, height: 720 }, audio: false });
      if (generation !== r.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      r.stream = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      note('Camera on.');
    } catch (e) {
      if (generation !== r.generation) return;
      r.stream = null;
      note(`No camera (${e.name}). Turn on "pointer is a person" to play it with the mouse.`);
    }
    await listDevices().catch(() => {});
  }

  async function start() {
    const r = run.current;
    const generation = r.generation = (r.generation || 0) + 1;
    r.releaseInfo = installMediaPipeInfoFilter();
    // Created inside the click, so the browser lets it play.
    let ctx;
    try {
      ctx = new AudioContext({ latencyHint: 'playback' });
      await ctx.resume();
      if (generation !== r.generation) { await ctx.close(); return; }
      setRunning(true);
      const { createScore } = await import('./score.mjs');
      const score = await createScore(ctx);
      if (generation !== r.generation) { await score.dispose(); return; }
      r.score = score;
      r.score.setMaster(settings.master);
    r.score.setDrone(settings.drone);
      note(`Score running: ${r.score.channels} output channels (device reports ${r.score.maxChannels}).`);
      r.motion = createMotion(ZONES);
      await startCamera(settings.camera);
      if (generation !== r.generation) return;
      createPose().then(p => { if (generation !== r.generation) { p.close(); return; } r.pose = p; note('Pose model loaded (up to 4 people).'); }).catch(e => { if (generation === r.generation) { r.releaseInfo?.(); r.releaseInfo = null; note(`Pose model failed (${e.message}); using motion only.`); } });
      loop();
    } catch (e) {
      if (generation === r.generation) { await stop(); note(`Could not start (${e.message}).`); }
      await ctx?.close().catch(() => {});
    }
  }

  async function stop() {
    const r = run.current;
    r.generation = (r.generation || 0) + 1;
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach(t => t.stop());
    r.stream = null;
    r.pose?.close(); r.pose = null;
    r.releaseInfo?.(); r.releaseInfo = null;
    const score = r.score; r.score = null;
    setRunning(false); setView(null);
    await score?.dispose();
  }

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loop() {
    const r = run.current;
    const launch = createLaunchTracker({ zones: ZONES });
    let lastInference = -Infinity, lastVideoTime = -1, lastSend = 0, lastView = 0, frame = 0, people = [], motion = { zones: new Array(ZONES).fill(0), total: 0, x: 0.5, y: 0.5, cells: null };
    const tick = now => {
      const video = videoRef.current, s = r.settings;
      if (r.stream && canTrackFrame(video, lastVideoTime, now, lastInference)) {
        lastVideoTime = video.currentTime; lastInference = now;
        if (r.pose) { try { people = readPeople(r.pose.detectForVideo(video, now)); } catch { people = []; } }
        if (frame++ % 2 === 0) motion = r.motion(video);
      } else if (!r.stream) { people = []; motion = { ...motion, zones: motion.zones.map(z => z * 0.9), total: motion.total * 0.9, cells: null }; }
      const all = s.pointer && r.pointer ? [...people, pointerPerson(r.pointer, r.pointerDown)] : people;
      if (s.pointer && r.pointer?.moved) { motion = { ...motion, total: Math.min(1, motion.total + r.pointer.moved), x: r.pointer.x, y: r.pointer.y }; r.pointer.moved *= 0.5; }
      let out, room = null;
      if (s.mode === 'launch') {
        room = launch(all, now / 1000);
        for (const e of room.events) { r.score?.sting(e.zone, e.why === 'enter' ? 0.8 : 0.95); r.flash[e.zone] = now; r.last = e; }
        out = launchScore({ room, people: all, motion, depthFrom: s.depthFrom, zones: ZONES });
        if (room.events.length) lastSend = 0; // a launch also brings its loop up straight away
      } else out = scoreFromRoom({ people: all, motion, mode: s.mode, spot: r.spot, depthFrom: s.depthFrom, zones: ZONES });
      if (r.score && now - lastSend > 200) { r.score.update(out); lastSend = now; }
      const zonesNow = room ? room.tracks.map(t => t.zone) : all.map(p => zoneOf(p.x, ZONES));
      draw(all, motion, out, room, now);
      if (r.score && now - lastView > 150) {
        lastView = now;
        setView({ out, people: all.length, zonesNow, last: r.last, mode: s.mode, phases: r.score.phases(), speakers: r.score.speakerGains(), channels: r.score.channels });
      }
      r.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
  }

  // The pointer as a person: holding the mouse button raises a hand; with Shift, both hands.
  function pointerPerson(p, down) {
    const hand = up => ({ x: p.x, y: up ? p.y - 0.3 : p.y + 0.1, shoulderY: p.y - 0.12, shoulderX: p.x, visible: true });
    return { x: p.x, y: p.y, size: 0.2, pointer: true, hands: [hand(down > 0), hand(down > 1)] };
  }

  function draw(people, motion, out, room, now) {
    const canvas = canvasRef.current; if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, w, h);
    const s = run.current.settings;
    if (motion.cells) {
      c.fillStyle = 'rgba(255,255,255,.18)';
      const cw = w / MOTION_GRID.W, ch = h / MOTION_GRID.H;
      for (let i = 0; i < motion.cells.length; i++) if (motion.cells[i]) c.fillRect((i % MOTION_GRID.W) * cw, Math.floor(i / MOTION_GRID.W) * ch, cw, ch);
    }
    const hex = a => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');
    if (s.mode !== 'spot') {
      out.levels.forEach((lvl, z) => {
        const x0 = (z / ZONES) * w, cw = w / ZONES;
        // Launch: an occupied zone glows in its colour and flashes on each launch; an empty one is dim.
        const flash = room ? Math.max(0, 1 - (now - run.current.flash[z]) / 700) : 0;
        const glow = room ? (room.occupied[z] ? 0.26 * room.occupied[z] : 0.03) + 0.5 * flash : lvl * 0.27;
        c.fillStyle = COLORS[z] + hex(glow);
        c.fillRect(x0, 0, cw, h);
        const lit = room && (room.occupied[z] || flash > 0);
        c.strokeStyle = lit ? COLORS[z] : 'rgba(236,236,230,.25)'; c.lineWidth = lit ? 3 : 1;
        c.strokeRect(x0 + (lit ? 1.5 : 0), lit ? 1.5 : 0, cw - (lit ? 3 : 0), h - (lit ? 3 : 0));
        c.fillStyle = COLORS[z];
        c.font = '800 34px Inter Variable, sans-serif'; c.fillText(String(z + 1), x0 + 12, 44);
        c.font = '600 12px Inter Variable, sans-serif'; c.fillText(`${VOICES[z].note} · ${VOICES[z].period}s`, x0 + 12, 64);
      });
      c.lineWidth = 1;
    } else {
      const { x, y } = run.current.spot;
      c.strokeStyle = '#ff8a1f'; c.lineWidth = 2;
      [0.5, 0.36, 0.22, 0.08].forEach(r => { c.beginPath(); c.ellipse(x * w, y * h, r * w, r * w, 0, 0, Math.PI * 2); c.globalAlpha = 0.25 + out.proximity * 0.5; c.stroke(); });
      c.globalAlpha = 1; c.fillStyle = '#ff8a1f'; c.beginPath(); c.arc(x * w, y * h, 6, 0, Math.PI * 2); c.fill();
    }
    // Wrists, joined to their shoulders; a raised hand is filled with the colour of the zone it is in.
    people.forEach((p, i) => (room?.tracks[i]?.hands ?? p.hands ?? []).forEach(hd => {
      if (!hd.visible) return;
      const raised = hd.raised ?? hd.y < hd.shoulderY - 0.03;
      c.strokeStyle = 'rgba(236,236,230,.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(hd.shoulderX * w, hd.shoulderY * h); c.lineTo(hd.x * w, hd.y * h); c.stroke();
      c.fillStyle = raised ? COLORS[zoneOf(hd.x, ZONES)] : 'rgba(236,236,230,.8)';
      c.beginPath(); c.arc(hd.x * w, hd.y * h, raised ? 11 : 6, 0, Math.PI * 2); c.fill();
    }));
    c.lineWidth = 1;
    people.forEach((p, i) => {
      const listener = i === out.listener;
      c.fillStyle = listener ? '#ff8a1f' : '#ecece6';
      c.beginPath(); c.arc(p.x * w, p.y * h, listener ? 14 : 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#121412'; c.font = '700 11px Inter Variable, sans-serif'; c.textAlign = 'center';
      c.fillText(p.pointer ? '↖' : String(i + 1), p.x * w, p.y * h + 4); c.textAlign = 'start';
    });
  }

  function framePoint(e) {
    const b = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
  }
  function onPointerMove(e) {
    const p = framePoint(e), prev = run.current.pointer;
    const moved = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) * 2 : 0;
    run.current.pointer = { ...p, moved: Math.min(0.4, (prev?.moved ?? 0) + moved) };
  }
  function onClick(e) { if (settings.mode === 'spot') run.current.spot = framePoint(e); }

  function set(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
    const r = run.current;
    if (key === 'master') r.score?.setMaster(value);
    if (key === 'drone') r.score?.setDrone(value);
    if (key === 'camera' && r.score) startCamera(value);
    if (key === 'output' && r.score) r.score.setSink(value).then(() => note(`Output: ${r.score.channels} channels (device reports ${r.score.maxChannels}).`)).catch(e => note(`Output not changed: ${e.message}`));
  }

  const speakers = view ? SPEAKERS[view.channels] : null;
  return (
    <main id="main" className="ls">
      <header className="ls-head">
        <div>
          <p className="eyebrow"><Link href="/launch">Launch</Link> · a generative score</p>
          <h1>Live score</h1>
          <p className="ls-deck">The camera watches the room; five loops of different lengths, after Eno's <em>Music for Airports</em>, one per zone from low (1) to high (5). In <strong>Zones (launch)</strong>, stepping into a zone plays its figure at once and brings its loop up; raise a hand to play the zone it's in, reach into the next zone to play that one too, raise both to swell the room.</p>
        </div>
        <div className="ls-actions">
          {running ? <button onClick={stop}>Stop</button> : <button className="ls-go" onClick={start}>Start the room</button>}
        </div>
      </header>

      <section className="ls-grid">
        <div className="ls-stage" data-mode={settings.mode}>
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} onPointerMove={onPointerMove} onPointerLeave={() => { run.current.pointer = null; run.current.pointerDown = 0; }} onPointerDown={e => (run.current.pointerDown = e.shiftKey ? 2 : 1)} onPointerUp={() => (run.current.pointerDown = 0)} onClick={onClick} />
          {!running && <p className="ls-idle">Press <strong>Start the room</strong>. It asks for the camera; audio starts quietly.</p>}
        </div>

        <aside className="ls-panel">
          <fieldset>
            <legend>Mode</legend>
            <label><input type="radio" checked={settings.mode === 'launch'} onChange={() => set('mode', 'launch')} /> Zones (launch): entering a zone fires its figure and brings its loop up fast; hands play zones</label>
            <label><input type="radio" checked={settings.mode === 'zones'} onChange={() => set('mode', 'zones')} /> Eno (slow): presence and movement in each column fade its loop in and out</label>
            <label><input type="radio" checked={settings.mode === 'spot'} onChange={() => set('mode', 'spot')} /> Spot: the nearest person to the mark is the listener (click to move the mark)</label>
          </fieldset>
          <label className="ls-field">Depth from
            <select value={settings.depthFrom} onChange={e => set('depthFrom', e.target.value)}>
              <option value="size">body size (a camera at the front)</option>
              <option value="height">height in frame (overhead camera)</option>
            </select>
          </label>
          <label className="ls-field">Camera
            <select value={settings.camera} onChange={e => set('camera', e.target.value)}>
              <option value="">default</option>
              {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || c.deviceId.slice(0, 8)}</option>)}
            </select>
          </label>
          <label className="ls-field">Audio output
            <select value={settings.output} onChange={e => set('output', e.target.value)} disabled={!running}>
              <option value="">default</option>
              {outputs.map(o => <option key={o.deviceId} value={o.deviceId}>{o.label || o.deviceId.slice(0, 8)}</option>)}
            </select>
          </label>
          <label className="ls-field">Volume
            <input type="range" min="0" max="2" step="0.01" value={settings.master} onChange={e => set('master', Number(e.target.value))} />
          </label>
          <label className="ls-field">Drone
            <input type="range" min="0" max="3" step="0.01" value={settings.drone} onChange={e => set('drone', Number(e.target.value))} />
          </label>
          <label className="ls-check"><input type="checkbox" checked={settings.pointer} onChange={e => set('pointer', e.target.checked)} /> Pointer is a person (try it without a camera; hold the button to raise a hand, Shift for both)</label>

          <div className="ls-mix" aria-live="off">
            <h2>The mix</h2>
            {VOICES.map((v, i) => (
              <div className="ls-row" key={v.id}>
                <span className="ls-dot" style={{ background: COLORS[i], opacity: view ? 0.35 + 0.65 * ((view.phases[i].since !== null && view.phases[i].since < 4) || (view.phases[i].stung !== null && view.phases[i].stung < 0.8) ? 1 : 0) : 0.35 }} />
                <span className="ls-name">Zone {i + 1} · {v.note} <small>{v.kind}, every {v.period}s</small></span>
                <span className="ls-meter"><span style={{ width: `${(view?.out.levels[i] ?? 0) * 100}%`, background: COLORS[i] }} /><i style={{ left: `${(view?.phases[i].phase ?? 0) * 100}%` }} /></span>
              </div>
            ))}
            <div className="ls-row"><span className="ls-dot" /><span className="ls-name">Shimmer <small>motion</small></span><span className="ls-meter"><span style={{ width: `${(view?.out.shimmer ?? 0) * 100}%` }} /></span></div>
            <div className="ls-row"><span className="ls-dot" /><span className="ls-name">Drone <small>D♭ + A♭</small></span><span className="ls-meter"><span style={{ width: `${(view?.out.drone ?? 0) * 100}%` }} /></span></div>
            {view ? (
              <dl className="ls-stats">
                <div><dt>People in view</dt><dd>{view.people}</dd></div>
                <div><dt>{view.zonesNow.length > 1 ? 'Zones' : 'You'}</dt><dd>{view.zonesNow.length ? (view.zonesNow.length > 1 ? [...new Set(view.zonesNow)].sort().map(z => z + 1).join(', ') : `zone ${view.zonesNow[0] + 1}`) : '—'}</dd></div>
                {view.mode === 'launch' && <div><dt>Last launch</dt><dd>{view.last ? `zone ${view.last.zone + 1} (${WHY[view.last.why]})` : '—'}</dd></div>}
                <div><dt>Intensity</dt><dd>{(view.out.intensity * 100).toFixed(0)}%{view.out.swell ? ' · swell' : ''}</dd></div>
                {view.mode === 'spot' && <div><dt>Proximity</dt><dd>{(view.out.proximity * 100).toFixed(0)}%</dd></div>}
              </dl>
            ) : <p className="ls-stats">Not running.</p>}
          </div>

          {speakers && (
            <div className="ls-speakers" data-n={view.channels}>
              <h2>{view.channels === 4 ? 'Quad' : 'Stereo'} out</h2>
              <div className="ls-room">
                {speakers.map((sp, k) => (
                  <span key={sp.name} style={{ left: `${(sp.x + 1) * 50}%`, top: `${(1 - sp.y) * 50}%`, opacity: 0.25 + Math.min(1, view.speakers[k]) * 0.75 }}>{sp.name}</span>
                ))}
                <em>front</em>
              </div>
              {view.channels < 4 && <p className="ls-note">This output has fewer than four channels, so the quad corners fold to left and right. Choose a four-output interface above to pan across the room.</p>}
            </div>
          )}
          {status.length > 0 && <ul className="ls-status">{status.map((s, i) => <li key={i}>{s}</li>)}</ul>}
        </aside>
      </section>
    </main>
  );
}
