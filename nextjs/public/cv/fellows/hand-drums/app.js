import { FilesetResolver, HandLandmarker } from './vendor/vision_bundle.mjs';
import { audioContext, play, KITS } from './audio.js';
import { GestureEngine, FieldTrigger, settings, TOUCH_ON } from './gestures.js';

const $ = (id) => document.getElementById(id);
const video = $('cam');
const canvas = $('view');
const g = canvas.getContext('2d');
const engine = new GestureEngine();
const field = new FieldTrigger();
let stickMode = 'enter'; // 'enter' = a pointed finger entering a pad plays it once; 'tap' = tap down

const MAX_LOOPS = 8;
const EDGE_MARGIN = 12; // px a fingertip must leave a pad by before it can play again
const LOOP_COLORS = ['#ff7a59', '#f6c344', '#7bd88f', '#6cc5ff', '#c58bff', '#ff8fc7', '#9be3d4', '#d9d96b'];
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

let W = 0, H = 0, dpr = 1;
let kitIndex = 0;
let landmarker = null;
let camOn = false;
let lastVideoTime = -1;
let hands = []; // latest engine output (normalized to video, mirrored)
const flashes = [0, 0, 0, 0];
const ripples = [];
let banner = { text: '', t: 0 };
let toast = { text: '', t: 0 };

let recording = null; // {start, events}
let loops = [];
let nextLoopId = 1;
const grabs = new Map(); // handId or 'mouse' -> loop

const kit = () => KITS[kitIndex];

// ---------- layout ----------
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const padArea = () => ({ x: 18, y: H * 0.1, w: W - 36, h: H * 0.26 });
const tray = () => ({ x: 18, y: H * 0.72, w: W - 36, h: H * 0.26 });
const cardSize = () => { const t = tray(); const h = Math.min(t.h - 28, 120); return { w: Math.min(170, (t.w - 8 * 10) / 8 + 10), h }; };
const slotPos = (i) => { const t = tray(); const c = cardSize(); return { x: t.x + 10 + i * (c.w + 10), y: t.y + 24 }; };

// video "cover" mapping: mirrored normalized x/y -> screen
function cover() {
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  return { dw, dh, ox: (W - dw) / 2, oy: (H - dh) / 2 };
}
const toScreen = (p) => { const c = cover(); return { x: c.ox + p.x * c.dw, y: c.oy + p.y * c.dh }; };

// ---------- drumming ----------
function hit(kind, sx, sy, vel, forceZone) {
  const zone = forceZone ?? Math.min(3, Math.max(0, Math.floor((sx / W) * 4)));
  const voice = kit().zones[zone][kind];
  audioContext();
  play(voice, 0, vel);
  flashes[zone] = 1;
  ripples.push({ x: sx, y: sy, t: performance.now(), color: kit().color, kind });
  if (recording) recording.events.push({ t: audioContext().currentTime - recording.start, voice, vel });
}

function changeKit(dir) {
  kitIndex = (kitIndex + dir + KITS.length) % KITS.length;
  banner = { text: kit().name, t: performance.now() };
  $('kit').textContent = kit().name;
  $('kit').style.color = kit().color;
}

// ---------- loops ----------
function toggleRecord() {
  const c = audioContext();
  if (!recording) {
    if (loops.length >= MAX_LOOPS) { say(`Eight loops is the limit. Throw one away first.`); return; }
    recording = { start: c.currentTime, events: [], kit: kit() };
    $('rec').hidden = false;
    return;
  }
  const dur = c.currentTime - recording.start;
  const ev = recording.events;
  recording = null;
  $('rec').hidden = true;
  if (!ev.length || dur < 0.4) { say('Empty loop discarded. Drum something while recording.'); return; }
  const id = nextLoopId++;
  const now = c.currentTime;
  loops.push({
    id, events: ev, dur, color: LOOP_COLORS[(id - 1) % LOOP_COLORS.length], kitName: kit().name,
    origin: now, cycleStart: now, idx: 0, muted: false,
    x: slotPos(loops.length).x, y: slotPos(loops.length).y, vx: 0, vy: 0, grabbedBy: null, dying: 0, born: performance.now(),
  });
  say(`Loop ${id} playing · ${dur.toFixed(1)} s`);
}

function scheduler() {
  if (!camOn && !recording && !loops.length) return;
  const c = audioContext();
  const now = c.currentTime, ahead = now + 0.15;
  for (const l of loops) {
    if (l.dying) continue;
    for (let guard = 0; guard < 200; guard++) {
      if (l.idx >= l.events.length) {
        if (l.cycleStart + l.dur > ahead) break;
        l.cycleStart += l.dur; l.idx = 0; continue;
      }
      const e = l.events[l.idx];
      const t = l.cycleStart + e.t;
      if (t > ahead) break;
      if (t >= now - 0.03 && !l.muted) play(e.voice, t, e.vel);
      l.idx++;
    }
  }
  if (recording && now - recording.start > 30) toggleRecord();
}
setInterval(scheduler, 25);

function removeLoop(l) { loops = loops.filter((x) => x !== l); }

function releaseLoop(l, throwIt) {
  l.grabbedBy = null;
  if (throwIt) { l.dying = performance.now(); }
}

function say(text) { toast = { text, t: performance.now() }; }

// grabbing logic shared by fist and mouse
function startGrab(owner, x, y) {
  const t = tray(), c = cardSize();
  if (owner !== 'mouse' && y < t.y - 30) return null; // fist must be down at the tray
  let best = null, bd = Infinity;
  for (const l of loops) {
    if (l.dying || l.grabbedBy) continue;
    const dx = Math.max(l.x - x, 0, x - (l.x + c.w)), dy = Math.max(l.y - y, 0, y - (l.y + c.h));
    const d = Math.hypot(dx, dy);
    const reach = owner === 'mouse' ? 0 : 70; // a fist near a loop is enough
    if (d <= reach && d < bd) { bd = d; best = l; }
  }
  if (!best) return null;
  best.grabbedBy = owner; grabs.set(owner, best);
  best.grabDX = x - best.x; best.grabDY = y - best.y; best.moved = 0;
  return best;
}
function moveGrab(owner, x, y) {
  const l = grabs.get(owner);
  if (!l) return;
  const nx = x - l.grabDX, ny = y - l.grabDY;
  l.vx = nx - l.x; l.vy = ny - l.y;
  l.moved += Math.abs(l.vx) + Math.abs(l.vy);
  l.x = nx; l.y = ny;
}
function endGrab(owner) {
  const l = grabs.get(owner);
  if (!l) return null;
  grabs.delete(owner);
  const t = tray();
  const c = cardSize();
  const cy = l.y + c.h / 2;
  const outside = cy < t.y - 10 || l.x + c.w < 0 || l.x > W;
  const flicked = Math.hypot(l.vx, l.vy) > 28;
  l.grabbedBy = null;
  if (outside || flicked) { l.dying = performance.now(); say(`Loop ${l.id} thrown away`); }
  return l;
}

// ---------- events from gestures / keyboard / mouse ----------
function onEvent(e) {
  if (e.type === 'hit') {
    if (e.kind === 'stick' && stickMode === 'enter') return;
    const s = toScreen({ x: e.x, y: e.y });
    hit(e.kind, s.x, s.y, e.vel);
  } else if (e.type === 'swipe') changeKit(e.dir);
  else if (e.type === 'pinch') toggleRecord();
}

const KEYS = { a: 0, s: 1, d: 2, f: 3 };
window.addEventListener('keydown', (ev) => {
  if (ev.repeat || ev.metaKey || ev.ctrlKey) return;
  const k = ev.key.toLowerCase();
  if (k in KEYS) { const z = KEYS[k]; hit(ev.shiftKey ? 'palm' : 'stick', (z + 0.5) * W / 4, H * 0.35, 0.8); }
  else if (ev.key === 'ArrowRight') changeKit(1);
  else if (ev.key === 'ArrowLeft') changeKit(-1);
  else if (k === 'g') showScope = !showScope;
  else if (k === 'l') {
    const blob = new Blob([JSON.stringify({ settings, frames: log }, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'hand-drums-log.json' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Saved the last 20 s of tracking to hand-drums-log.json');
  }
  else if (k === 'r' || ev.key === ' ') { ev.preventDefault(); toggleRecord(); }
  else if (ev.key === 'Delete' || ev.key === 'Backspace') { loops.forEach((l) => (l.dying = performance.now())); }
});

canvas.addEventListener('pointerdown', (ev) => {
  audioContext();
  const x = ev.clientX, y = ev.clientY;
  const l = startGrab('mouse', x, y);
  if (l) { canvas.setPointerCapture(ev.pointerId); l.downAt = performance.now(); return; }
  const pa = padArea();
  if (y >= pa.y && y <= pa.y + pa.h) hit(ev.shiftKey ? 'palm' : 'stick', x, y, 0.8);
});
canvas.addEventListener('pointermove', (ev) => moveGrab('mouse', ev.clientX, ev.clientY));
canvas.addEventListener('pointerup', () => {
  const l = grabs.get('mouse');
  if (!l) return;
  const quick = performance.now() - (l.downAt || 0) < 350 && l.moved < 8;
  endGrab('mouse');
  if (quick && !l.dying) { l.muted = !l.muted; say(`Loop ${l.id} ${l.muted ? 'muted' : 'unmuted'}`); }
});

$('trig').addEventListener('change', (e) => { stickMode = e.target.value; });
$('sens').addEventListener('input', (e) => (settings.sensitivity = +e.target.value));
let dim = 0.5;
$('dim').addEventListener('input', (e) => (dim = +e.target.value));

// ---------- startup ----------
async function loadTracker() {
  const fileset = await FilesetResolver.forVisionTasks('./vendor/wasm');
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: './models/hand_landmarker.task', delegate },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { landmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU')); }
}

$('start').addEventListener('click', async () => {
  audioContext();
  $('startCard').hidden = true;
  $('status').textContent = 'Starting camera…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    camOn = true;
    startVideoLoop();
  } catch (err) {
    $('status').textContent = 'No camera (' + (err.name || 'error') + '). Keyboard and mouse still work.';
  }
  try {
    await loadTracker();
    if (camOn) $('status').textContent = 'Show a hand';
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Hand tracking failed to load: ' + err.message;
  }
});

changeKit(0);
banner.t = 0;

// ---------- frame loop ----------
let lastT = 0, lastDetect = 0;
const log = []; // rolling diagnostics: what the tracker saw, for tuning (press D to save)
const scope = []; // {t, vy, start, hit} for the little live graph

function process(nowMs, captureTime) {
  if (!(landmarker && camOn && video.readyState >= 2)) return;
  // time the camera frame was captured (more even than the moment this code runs)
  let t = Number.isFinite(captureTime) && Math.abs(captureTime - nowMs) < 500 ? captureTime : nowMs;
  if (t <= lastT) t = lastT + 1;
  lastT = t;
  lastDetect = Math.max(lastDetect + 1, performance.now());
  const res = landmarker.detectForVideo(video, lastDetect);
  const out = engine.update(res.landmarks || [], video.videoWidth, video.videoHeight, t);
  hands = out.hands;
  out.events.forEach(onEvent);
  handleFists(t);
  handleField();
  const h0 = hands.find((h) => h.mode) || hands[0];
  const hitNow = out.events.some((e) => e.type === 'hit');
  scope.push({ t, vy: h0 ? h0.vy : 0, start: h0 ? h0.start : 0, hit: hitNow });
  while (scope.length && t - scope[0].t > 3000) scope.shift();
  log.push({ t: Math.round(t), hands: hands.map((h) => ({ id: h.id, pose: h.pose, mode: h.mode, vy: +h.vy.toFixed(2), tipX: +h.tip.x.toFixed(3), tipY: +h.tip.y.toFixed(3), pinch: +h.pd.toFixed(2) })), events: out.events.map((e) => e.type + (e.kind ? ':' + e.kind : '')) });
  while (log.length && t - log[0].t > 20000) log.shift();
  if (hands.length) $('status').textContent = hands.map((h) => `${h.pose}`).join(' · ');
  else $('status').textContent = 'Show a hand';
}

function startVideoLoop() {
  if (!('requestVideoFrameCallback' in video)) return;
  const tick = (now, meta) => { process(now, meta && meta.captureTime); video.requestVideoFrameCallback(tick); };
  video.requestVideoFrameCallback(tick);
  usingVFC = true;
}
let usingVFC = false;

function frame(nowMs) {
  if (!usingVFC && video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; process(nowMs); }
  draw(nowMs);
  requestAnimationFrame(frame);
}

function padAt(x, y, margin = 0) {
  const pa = padArea(), zw = pa.w / 4;
  if (y < pa.y - margin || y > pa.y + pa.h + margin) return -1;
  for (let i = 0; i < 4; i++) {
    const x0 = pa.x + i * zw + 5, x1 = x0 + zw - 10;
    if (x >= x0 - margin && x <= x1 + margin) return i;
  }
  return -1;
}

// a pointed fingertip that moves into a pad plays it once
function handleField() {
  const seen = new Set();
  for (const h of hands) {
    seen.add(h.id);
    const s = toScreen(h.tip);
    const pointing = stickMode === 'enter' && (h.pose === 'point' || h.mode === 'stick');
    const grow = (settings.sensitivity - 1) * 30; // sensitivity widens (or narrows) every pad's edge, in pixels
    const fire = field.update(h.id, pointing, padAt(s.x, s.y, grow), padAt(s.x, s.y, grow + EDGE_MARGIN));
    h.inPad = pointing ? padAt(s.x, s.y, grow) : -1;
    if (fire >= 0) hit('stick', (fire + 0.5) * (padArea().w / 4) + padArea().x, s.y, 0.85, fire);
  }
  for (const id of field.state.keys()) if (!seen.has(id)) field.update(id, false, -1, -1);
}

function handleFists() {
  const seen = new Set();
  for (const h of hands) {
    seen.add(h.id);
    const s = toScreen(h.palm);
    const fist = h.pose === 'fist' && h.fistMs > 140;
    if (fist) {
      if (!grabs.has(h.id)) startGrab(h.id, s.x, s.y);
      else moveGrab(h.id, s.x, s.y);
    } else if (grabs.has(h.id)) endGrab(h.id);
  }
  for (const owner of [...grabs.keys()]) if (owner !== 'mouse' && !seen.has(owner)) endGrab(owner);
}

// ---------- drawing ----------
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

function draw(nowMs) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0b0b10';
  g.fillRect(0, 0, W, H);
  if (camOn && video.readyState >= 2) {
    const c = cover();
    g.save();
    g.globalAlpha = dim;
    g.translate(c.ox + c.dw, c.oy);
    g.scale(-1, 1);
    g.drawImage(video, 0, 0, c.dw, c.dh);
    g.restore();
  }

  // pads
  const pa = padArea(), k = kit();
  const zw = pa.w / 4;
  for (let i = 0; i < 4; i++) {
    flashes[i] *= 0.9;
    const x = pa.x + i * zw + 5, w = zw - 10;
    g.fillStyle = hexA(k.color, 0.08 + flashes[i] * 0.5);
    rr(x, pa.y, w, pa.h, 14); g.fill();
    if (flashes[i] > 0.05) { g.fillStyle = hexA(k.color, flashes[i] * 0.12); g.fillRect(pa.x + i * zw, pa.y + pa.h, zw, tray().y - pa.y - pa.h - 8); }
    g.strokeStyle = hexA(k.color, 0.35 + flashes[i] * 0.6);
    g.lineWidth = 2; g.stroke();
    g.fillStyle = hexA('#ffffff', 0.85);
    g.font = '700 20px system-ui'; g.textAlign = 'center';
    g.fillText(k.zones[i].label, x + w / 2, pa.y + 30);
    g.font = '13px system-ui'; g.fillStyle = hexA('#ffffff', 0.55);
    g.fillText('point · palm', x + w / 2, pa.y + 50);
  }

  for (const h of hands) if (h.inPad >= 0) { g.strokeStyle = '#fff'; g.lineWidth = 3; rr(pa.x + h.inPad * zw + 5, pa.y, zw - 10, pa.h, 14); g.stroke(); }
  // faint column lines show where each pad's hits land
  g.strokeStyle = hexA(k.color, 0.18); g.lineWidth = 1; g.setLineDash([4, 8]);
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(pa.x + i * zw, pa.y + pa.h); g.lineTo(pa.x + i * zw, tray().y - 8); g.stroke(); }
  g.setLineDash([]);

  // ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], a = (nowMs - r.t) / 450;
    if (a >= 1) { ripples.splice(i, 1); continue; }
    g.strokeStyle = hexA(r.color, 1 - a); g.lineWidth = 4 * (1 - a) + 1;
    g.beginPath(); g.arc(r.x, r.y, (r.kind === 'palm' ? 40 : 18) + a * 70, 0, 7); g.stroke();
  }

  drawTray(nowMs);
  drawHands();

  if (showScope) drawScope();
  // banner & toast
  const ba = 1 - (nowMs - banner.t) / 900;
  if (ba > 0) {
    g.globalAlpha = ba; g.fillStyle = k.color; g.font = '800 72px system-ui'; g.textAlign = 'center';
    g.fillText(banner.text, W / 2, H * 0.44); g.globalAlpha = 1;
  }
  const ta = 1 - (nowMs - toast.t) / 2200;
  if (ta > 0) {
    g.globalAlpha = Math.min(1, ta * 2); g.fillStyle = '#fff'; g.font = '600 16px system-ui'; g.textAlign = 'center';
    g.fillText(toast.text, W / 2, H * 0.69); g.globalAlpha = 1;
  }
  if (recording) $('recTime').textContent = (audioContext().currentTime - recording.start).toFixed(1);
}

let showScope = true;
function drawScope() {
  const pa = padArea(); const x = 18, y = pa.y + pa.h + 10, w = 240, h = 70, span = 3000;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y, w, h);
  if (scope.length < 2) return;
  const t1 = scope[scope.length - 1].t;
  const max = 14; // hand sizes per second at the top of the graph
  const Y = (v) => y + h - Math.max(0, Math.min(1, v / max)) * h;
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([3, 3]);
  const st = scope[scope.length - 1].start; g.beginPath(); g.moveTo(x, Y(st)); g.lineTo(x + w, Y(st)); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#7bd88f'; g.lineWidth = 2; g.beginPath();
  scope.forEach((p, i) => { const px = x + w - ((t1 - p.t) / span) * w; i ? g.lineTo(px, Y(p.vy)) : g.moveTo(px, Y(p.vy)); });
  g.stroke();
  g.fillStyle = '#ff7a59';
  for (const p of scope) if (p.hit) { const px = x + w - ((t1 - p.t) / span) * w; g.fillRect(px - 2, y, 4, h); }
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '11px system-ui'; g.textAlign = 'left';
  g.fillText('downstroke speed · dashed = needed · orange = hit · G hides', x + 4, y + 11);
}

function drawTray(nowMs) {
  const t = tray(), cs = cardSize();
  g.fillStyle = 'rgba(0,0,0,.45)';
  rr(t.x, t.y, t.w, t.h, 18); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '600 12px system-ui'; g.textAlign = 'left';
  g.fillText(loops.length ? 'LOOPS · fist to grab, open your hand outside the tray to throw away · click to mute' : 'LOOPS · pinch to record one', t.x + 14, t.y + 16);
  
  let slot = 0;
  for (const l of [...loops]) {
    if (l.dying) {
      const a = (nowMs - l.dying) / 450;
      if (a >= 1) { removeLoop(l); continue; }
      l.x += (l.vx || 0) * 0.5; l.y += (l.vy || -10) * 0.8 - 4;
      g.globalAlpha = 1 - a;
      drawCard(l, cs, nowMs, 1 - a * 0.4);
      g.globalAlpha = 1;
      continue;
    }
    if (!l.grabbedBy) {
      const sp = slotPos(slot);
      l.x += (sp.x - l.x) * 0.25; l.y += (sp.y - l.y) * 0.25;
    }
    slot++;
  }
  for (const l of loops) if (!l.dying && !l.grabbedBy) drawCard(l, cs, nowMs, 1);
  for (const l of loops) if (!l.dying && l.grabbedBy) drawCard(l, cs, nowMs, 1.06);
}

function drawCard(l, cs, nowMs, scale) {
  g.save();
  g.translate(l.x + cs.w / 2, l.y + cs.h / 2); g.scale(scale, scale); g.translate(-cs.w / 2, -cs.h / 2);
  const grabbed = !!l.grabbedBy;
  g.globalAlpha *= l.muted ? 0.45 : 1;
  g.fillStyle = hexA(l.color, grabbed ? 0.55 : 0.28);
  rr(0, 0, cs.w, cs.h, 14); g.fill();
  g.strokeStyle = l.color; g.lineWidth = grabbed ? 3 : 1.5; g.stroke();
  g.fillStyle = '#fff'; g.font = '700 14px system-ui'; g.textAlign = 'left';
  g.fillText(`Loop ${l.id}${l.muted ? ' (muted)' : ''}`, 10, 22);
  g.font = '12px system-ui'; g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillText(`${l.kitName} · ${l.dur.toFixed(1)} s`, 10, 40);
  // events
  const bx = 10, bw = cs.w - 20, by = 52, bh = cs.h - 64;
  g.fillStyle = 'rgba(0,0,0,.35)'; rr(bx, by, bw, bh, 6); g.fill();
  g.fillStyle = l.color;
  for (const e of l.events) { const ex = bx + (e.t / l.dur) * bw; g.fillRect(ex - 1.5, by + 4, 3, bh - 8); }
  // playhead
  const ph = (((audioNow() - l.origin) % l.dur) + l.dur) % l.dur / l.dur;
  g.fillStyle = '#fff'; g.fillRect(bx + ph * bw - 1, by, 2, bh);
  g.restore();
}

function audioNow() { return audioContext().currentTime; }

function drawHands() {
  const k = kit();
  for (const h of hands) {
    const P = h.pts.map(toScreen);
    g.strokeStyle = hexA(k.color, 0.85); g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath();
    for (const [a, b] of BONES) { g.moveTo(P[a].x, P[a].y); g.lineTo(P[b].x, P[b].y); }
    g.stroke();
    g.fillStyle = '#fff';
    for (const p of P) { g.beginPath(); g.arc(p.x, p.y, 3.5, 0, 7); g.fill(); }
    if (h.pose === 'point') { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(P[8].x, P[8].y, 14, 0, 7); g.stroke(); }
    // thumb tip and index tip: a line between them, red and big when they touch
    const touching = h.pose === 'pinch';
    g.strokeStyle = touching ? '#ff3b4a' : 'rgba(255,255,255,.7)'; g.lineWidth = touching ? 5 : 2;
    g.beginPath(); g.moveTo(P[4].x, P[4].y); g.lineTo(P[8].x, P[8].y); g.stroke();
    for (const i of [4, 8]) { g.fillStyle = touching ? '#ff3b4a' : '#ffd23f'; g.beginPath(); g.arc(P[i].x, P[i].y, touching ? 10 : 6, 0, 7); g.fill(); }
    if (touching) { g.fillStyle = '#ff3b4a'; g.font = '800 22px system-ui'; g.textAlign = 'center'; g.fillText('PINCH', (P[4].x + P[8].x) / 2, Math.min(P[4].y, P[8].y) - 20); }
    if (h.pose === 'fist') { g.strokeStyle = h.fistMs > 140 ? '#ffd23f' : '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(P[9].x, P[9].y, 26, 0, 7); g.stroke(); }
    // downstroke gauge: fills with the speed of the fingertip (or palm); a hit fires when the stroke peaks above the white tick and then slows
    if (h.mode) {
      const bx = P[0].x - 40, by = P[0].y + 40, bw = 80;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(bx, by, bw, 8);
      const f = Math.max(0, Math.min(1, h.vy / (h.start * 3)));
      g.fillStyle = h.vy > h.start ? '#7bd88f' : '#aaa'; g.fillRect(bx, by, bw * f, 8);
      g.fillStyle = '#fff'; g.fillRect(bx + bw / 3 - 1, by - 2, 2, 12);
    }
    const lab = ({ point: 'stick', palm: 'palm', pinch: 'PINCH', fist: 'fist', other: '', none: '' }[h.pose] || '') + `  thumb-index ${h.pd.toFixed(2)} (touch < ${TOUCH_ON})`;
    if (lab) { g.fillStyle = '#fff'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.fillText(lab, P[0].x, P[0].y + 26); }
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

requestAnimationFrame(frame);
