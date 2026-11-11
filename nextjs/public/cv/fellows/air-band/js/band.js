// Air Band: one camera, one hand tracker, one audio mix — and up to 5 players side by side,
// each with their own instrument in their own column of the video.
import { FilesetResolver, PoseLandmarker, HandLandmarker }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { SONGS } from "../air-guitar.js";
import { Engine, TRUMPET_SAMPLES, PIANO_SAMPLES, NAMES, noteName } from "./common.js";
import { TrumpetPlayer, REGISTERS } from "./trumpet.js";
import { PianoPlayer, FINGERS, FINGER_NAMES, TIPS, fingerNote } from "./piano.js";
import { GuitarPlayer } from "./guitar.js";
import { DrumPlayer } from "./drums.js";
import { FilterPlayer } from "./filter.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const $ = id => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), ctx2d = canvas.getContext("2d");
const INSTRUMENTS = { trumpet: "🎺", piano: "🎹", guitar: "🎸", drums: "🥁", filter: "🎛️" };
const MAX_PLAYERS = 5;

// ---------- Settings shared by every player of the same instrument ----------
const settings = {
  trumpet: { register: 2, mode: "hold", useSamples: true, sens: 1 },
  piano: { low: 60, pressDepth: 25, separation: 0.75, sustain: true },
  drums: { stickMode: "enter", sensitivity: 1 },
  filter: { maxQ: 6 },
  guitar: { fretMode: true, strumHand: "right", capo: 0, lineY: 0.72, stringsPos: 0.5, stringsWidth: 0.6, sensitivity: 1, song: 0 },
};
let showSkel = true;

// ---------- Players ----------
let band = { count: 5, insts: ["trumpet", "piano", "guitar", "drums", "filter"] }; // the whole band by default
try { const b = JSON.parse(localStorage.getItem("airBand5")); if (b?.count && b?.insts?.length === MAX_PLAYERS) band = b; } catch {}
const saveBand = () => { try { localStorage.setItem("airBand5", JSON.stringify(band)); } catch {} };

let engine = null, poseLm = null, handLm = null;
let zones = []; // [{ inst, player }], left → right as the players see themselves

function makePlayer(inst) {
  if (inst === "trumpet") return new TrumpetPlayer(engine, settings.trumpet);
  if (inst === "piano") return new PianoPlayer(engine, settings.piano);
  if (inst === "drums") return new DrumPlayer(engine, settings.drums);
  if (inst === "filter") return new FilterPlayer(engine, settings.filter);
  return new GuitarPlayer(engine, settings.guitar, refreshGuitarUI);
}

function rebuildPlayers() {
  const old = zones, kept = new Set(), next = [];
  band.insts.slice(0, band.count).forEach((inst, i) => {
    const o = old[i];
    if (o && o.inst === inst && (o.player || !engine)) { kept.add(o); next[i] = o; }
    else next[i] = { inst, player: null };
  });
  zones = next; // swap in first so callbacks fired while building players see a complete list
  for (const z of zones) if (!z.player && engine) z.player = makePlayer(z.inst);
  old.forEach(o => { if (!kept.has(o)) o.player?.dispose(); });
  keys.reset();
  renderZones();
  renderPlayerRows();
  for (const inst of Object.keys(INSTRUMENTS)) document.body.classList.toggle("uses-" + inst, zones.some(z => z.inst === inst));
  document.body.classList.toggle("multi", band.count > 1);
  handLm?.setOptions({ numHands: 2 * band.count });
  poseLm?.setOptions({ numPoses: band.count });
  refreshGuitarUI();
}
const firstOf = inst => zones.find(z => z?.inst === inst && z.player)?.player;
const allOf = inst => zones.filter(z => z?.inst === inst && z.player).map(z => z.player);

// ---------- Player setup UI ----------
$("player-count").querySelectorAll("button").forEach(b => b.onclick = () => {
  band.count = +b.dataset.n; saveBand(); rebuildPlayers();
});
function renderPlayerRows() {
  $("player-count").querySelectorAll("button").forEach(b => b.classList.toggle("sel", +b.dataset.n === band.count));
  $("player-rows").innerHTML = "";
  for (let i = 0; i < band.count; i++) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span class="who">P${i + 1}</span>` + Object.entries(INSTRUMENTS)
      .map(([k, icon]) => `<button data-inst="${k}" class="${band.insts[i] === k ? "sel" : ""}">${icon} ${k[0].toUpperCase() + k.slice(1)}</button>`).join("");
    row.querySelectorAll("button").forEach(b => b.onclick = () => { band.insts[i] = b.dataset.inst; saveBand(); rebuildPlayers(); });
    $("player-rows").appendChild(row);
  }
}

let zoneEls = [];
function renderZones() {
  const box = $("zones");
  box.innerHTML = "";
  zoneEls = zones.map((z, i) => {
    const el = document.createElement("div");
    el.className = "zone";
    el.innerHTML = `<div class="badge"><span class="who">P${i + 1}</span><span class="txt">${INSTRUMENTS[z.inst]}</span><span class="note"></span></div>`;
    box.appendChild(el);
    return { el, txt: el.querySelector(".txt"), note: el.querySelector(".note") };
  });
}

// ---------- Trumpet controls ----------
REGISTERS.forEach((r, i) => {
  const b = document.createElement("button");
  b.textContent = r.name; b.onclick = () => setRegister(i);
  $("registers").appendChild(b);
});
function setRegister(i) {
  settings.trumpet.register = Math.max(0, Math.min(REGISTERS.length - 1, i));
  [...$("registers").children].forEach((b, j) => b.classList.toggle("sel", j === settings.trumpet.register));
}
setRegister(settings.trumpet.register);
function setMode(m) {
  settings.trumpet.mode = m;
  $("mode-hold").classList.toggle("sel", m === "hold");
  $("mode-fanfare").classList.toggle("sel", m === "fanfare");
  allOf("trumpet").forEach(p => p.stop());
}
$("mode-hold").onclick = () => setMode("hold");
$("mode-fanfare").onclick = () => setMode("fanfare");
function setSound(real) {
  settings.trumpet.useSamples = real;
  allOf("trumpet").forEach(p => p.stop());
  $("snd-real").classList.toggle("sel", real);
  $("snd-synth").classList.toggle("sel", !real);
}
$("snd-real").onclick = () => setSound(true);
$("snd-synth").onclick = () => setSound(false);
$("sens").oninput = e => settings.trumpet.sens = +e.target.value;

// ---------- Piano controls ----------
function showFingerMap() {
  const low = settings.piano.low;
  const row = side => TIPS.slice().sort((a, b) => FINGERS[side][a] - FINGERS[side][b])
    .map(t => `${FINGER_NAMES[t]} ${noteName(fingerNote(low, side, t))}`).join(" · ");
  $("finger-map").innerHTML = `<b>Left:</b> ${row("left")}<br><b>Right:</b> ${row("right")}`;
  // one meter per finger, in screen order: left pinky…thumb | right thumb…pinky
  const order = [...[20, 16, 12, 8, 4].map(t => ["left", t]), null, ...TIPS.map(t => ["right", t])];
  $("meters").innerHTML = order.map(o => o
    ? `<div class="meter" id="m-${o[0]}${o[1]}"><div class="bar"><div class="fill"></div><div class="line"></div></div>${NAMES[fingerNote(low, o[0], o[1]) % 12]}</div>`
    : `<div class="meter gap"></div>`).join("");
}
showFingerMap();
function shiftOctave(d) {
  allOf("piano").forEach(p => p.releaseAll());
  settings.piano.low = Math.max(48, Math.min(84, settings.piano.low + 12 * d));
  showFingerMap();
}
$("oct-down").onclick = () => shiftOctave(-1);
$("oct-up").onclick = () => shiftOctave(1);
$("press-depth").oninput = e => settings.piano.pressDepth = +e.target.value;
$("separation").oninput = e => settings.piano.separation = +e.target.value;
$("sustain").onchange = e => settings.piano.sustain = e.target.checked;
$("calibrate").onclick = () => allOf("piano").forEach(p => p.startCalibration());

// ---------- Guitar controls ----------
const FINGER_WORDS = ["fist", "1", "2", "3", "4", "open hand"];
SONGS.forEach((song, i) => {
  const b = document.createElement("button");
  b.className = "chip"; b.textContent = song.name; b.onclick = () => setSong(i);
  $("g-songs").appendChild(b);
});
function setSong(i) {
  settings.guitar.song = i;
  allOf("guitar").forEach(p => p.g.setSong(i));
  const song = SONGS[i];
  [...$("g-songs").children].forEach((b, j) => b.classList.toggle("sel", j === i));
  $("g-chords").innerHTML = "";
  song.chords.forEach((name, k) => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = name; b.title = `Key ${k + 1}`;
    b.onclick = () => { const p = firstOf("guitar"); p?.g.setChord(name); };
    $("g-chords").appendChild(b);
  });
  const fingers = song.fingers || song.chords.slice(0, 6);
  $("g-fingermap").textContent = fingers.map((c, k) => `${FINGER_WORDS[k]} = ${c}`).join(" · ");
  refreshGuitarUI();
}
function refreshGuitarUI() {
  const chord = firstOf("guitar")?.g?.chord;
  [...$("g-chords").children].forEach(b => b.classList.toggle("sel", b.textContent === chord));
}
setSong(0);
$("g-capo").innerHTML = '<option value="0">None</option>' +
  Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Fret ${i + 1}</option>`).join("");
for (const [id, key, parse, prop] of [
  ["g-fret", "fretMode", v => v, "checked"], ["g-strum", "strumHand", v => v], ["g-capo", "capo", v => parseInt(v) || 0],
  ["g-lineY", "lineY"], ["g-stringsPos", "stringsPos"], ["g-stringsWidth", "stringsWidth"], ["g-sens", "sensitivity"],
]) {
  const el = $(id), apply = () => settings.guitar[key] = (parse || parseFloat)(el[prop || "value"]);
  el.addEventListener("input", apply); el.addEventListener("change", apply); apply();
}

// ---------- Drums controls ----------
$("d-trig").onchange = e => settings.drums.stickMode = e.target.value;
$("d-sens").oninput = e => settings.drums.sensitivity = +e.target.value;
$("d-clear").onclick = () => allOf("drums").forEach(p => p.clearLoops());

// ---------- Filter controls ----------
$("f-q").oninput = e => settings.filter.maxQ = +e.target.value;

// ---------- General ----------
$("vol").oninput = e => engine?.setVolume(+e.target.value);
$("show-skel").onchange = e => showSkel = e.target.checked;

// ---------- Computer keyboard: plays Player 1's instrument ----------
const PC_PIANO = "awsedftgyhujk", VALVE_KEYS = { j: 0, k: 1, l: 2 };
const keys = {
  valves: [false, false, false], blow: false, piano: new Set(),
  reset() { this.valves = [false, false, false]; this.blow = false; this.piano.clear(); },
};
addEventListener("keydown", e => {
  if (e.target.matches?.("input, select")) return;
  const p1 = zones[0];
  if (!p1) return;
  const k = e.key.toLowerCase();
  if (p1.inst === "drums") {
    const p = p1.player, pad = "asdf".indexOf(k);
    if (!p || e.repeat || e.metaKey || e.ctrlKey) return;
    if (pad >= 0) p.hitPad(pad, e.shiftKey ? "palm" : "stick", 0.8);
    else if (e.key === "ArrowRight") { p.changeKit(1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { p.changeKit(-1); e.preventDefault(); }
    else if (k === "r") p.toggleRecord();
    else if (e.key === "Delete" || e.key === "Backspace") p.clearLoops();
  } else if (p1.inst === "guitar") {
    const i = parseInt(e.key) - 1, chords = SONGS[settings.guitar.song].chords;
    if (i >= 0 && i < chords.length) p1.player?.g.setChord(chords[i]);
    if (e.code === "Space" && p1.player) { e.preventDefault(); p1.player.g.strum("down", 0.7); }
  } else if (p1.inst === "piano") {
    const i = PC_PIANO.indexOf(k);
    if (i >= 0 && !e.repeat && !keys.piano.has(i) && p1.player) { keys.piano.add(i); p1.player.press(settings.piano.low + i, 0.75); }
    else if (e.key === "ArrowUp") { shiftOctave(1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { shiftOctave(-1); e.preventDefault(); }
  } else {
    if (k in VALVE_KEYS) keys.valves[VALVE_KEYS[k]] = true;
    else if (e.key === "ArrowUp") { setRegister(settings.trumpet.register + 1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { setRegister(settings.trumpet.register - 1); e.preventDefault(); }
    else if (e.code === "Space") { keys.blow = true; e.preventDefault(); }
  }
});
addEventListener("keyup", e => {
  const k = e.key.toLowerCase(), i = PC_PIANO.indexOf(k), p1 = zones[0];
  if (i >= 0 && keys.piano.has(i)) { keys.piano.delete(i); if (p1?.inst === "piano") p1.player?.release(settings.piano.low + i); }
  if (k in VALVE_KEYS) keys.valves[VALVE_KEYS[k]] = false;
  if (e.code === "Space") keys.blow = false;
});

// ---------- Start ----------
async function makeModels(delegate) {
  const fs = await FilesetResolver.forVisionTasks(WASM);
  [poseLm, handLm] = await Promise.all([
    PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: "VIDEO", numPoses: band.count,
    }),
    HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: "VIDEO", numHands: 2 * band.count,
    }),
  ]);
}

$("start").onclick = async () => {
  const status = $("status");
  $("start").disabled = true;
  try {
    engine = new Engine(); await engine.ac.resume();
    engine.setVolume(+$("vol").value);
    $("snd-status").textContent = "Loading trumpet recordings… (synth until ready)";
    engine.loadBank("trumpet", TRUMPET_SAMPLES)
      .then(() => $("snd-status").textContent = "Recorded trumpet ready.")
      .catch(e => { console.error(e); $("snd-status").textContent = "Couldn't load recordings — using synth."; });
    $("piano-status").textContent = "Loading piano recordings…";
    engine.loadBank("piano", PIANO_SAMPLES)
      .then(() => $("piano-status").textContent = "Grand piano ready.")
      .catch(e => { console.error(e); $("piano-status").textContent = "Couldn't load piano recordings."; });
    rebuildPlayers();
    status.textContent = "Requesting camera…";
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false,
    });
    await video.play();
    status.textContent = "Loading hand + pose models…";
    try { await makeModels("GPU"); } catch { await makeModels("CPU"); }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    $("stage").style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    $("start-screen").remove();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    status.textContent = "Couldn't start: " + (err.message || err);
    $("start").disabled = false;
  }
};

// ---------- Every frame ----------
let lastVideoTime = -1;
function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const now = performance.now();
  const hands = handLm.detectForVideo(video, now);
  const poses = zones.some(z => z.inst === "trumpet") ? poseLm.detectForVideo(video, now) : null;
  runFrame(hands, poses, video.videoWidth, video.videoHeight, now);
}

/** Split tracked hands/bodies into player zones by where they are on screen, then run each player. */
function runFrame(handsRes, posesRes, W, H, now) {
  const N = zones.length;
  const zoneOf = displayX => Math.max(0, Math.min(N - 1, Math.floor(displayX * N)));
  const buckets = zones.map(() => ({ hands: [], poses: [] }));
  (handsRes.landmarks || []).forEach((lm, i) => buckets[zoneOf(1 - lm[0].x)].hands.push({
    lm, world: handsRes.worldLandmarks?.[i], handed: handsRes.handednesses?.[i]?.[0]?.categoryName,
  }));
  (posesRes?.landmarks || []).forEach(pl => buckets[zoneOf(1 - pl[0].x)].poses.push(pl)); // by nose

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  zones.forEach((z, i) => {
    const p = z.player;
    if (!p) return;
    const zone = [i / N, (i + 1) / N];
    p.update({ ...buckets[i], W, H, now, zone, keys: i === 0 ? keys : null });
    ctx2d.save(); // keep each player's drawing inside their own column (canvas x is mirrored)
    ctx2d.beginPath(); ctx2d.rect(W * (1 - zone[1]), 0, W * (zone[1] - zone[0]), H); ctx2d.clip();
    p.draw(ctx2d, W, H, zone, showSkel, now);
    ctx2d.restore();
    const ze = zoneEls[i];
    if (ze) { ze.txt.textContent = p.text; ze.note.textContent = p.note; ze.el.classList.toggle("on", p.active); }
  });

  // sidebar live views follow the first player of each instrument
  const tp = firstOf("trumpet");
  if (tp) tp.valves.forEach((v, i) => $("v" + (i + 1)).classList.toggle("down", v));
  const pp = firstOf("piano");
  if (pp) {
    for (const el of document.querySelectorAll(".meter[id]")) {
      const m = pp.meter[el.id.slice(2)];
      el.querySelector(".fill").style.height = m ? Math.max(0, Math.min(100, m.amount * 50)) + "%" : "0%";
      el.classList.toggle("on", !!m?.on);
      el.classList.toggle("blocked", !!m?.blocked);
    }
  }
  for (const p of allOf("piano")) if (p.calibMsg) { $("piano-status").textContent = p.calibMsg; p.calibMsg = null; }
}

rebuildPlayers();
window.airBand = { settings, band, zones: () => zones, runFrame, rebuildPlayers, engine: () => engine }; // console testing
