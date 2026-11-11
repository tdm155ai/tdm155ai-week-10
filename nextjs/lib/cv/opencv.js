"use client";

// OpenCV.js (about 11 MB) for /draw-a-box only: loaded by a <script> tag the first time the page asks for it,
// so no other page pays for it. jsDelivr's copy of the opencv-js 4.12 build first, the official docs build second.

const SOURCES = [
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js",
  "https://docs.opencv.org/4.x/opencv.js",
];

let ready = null;

function inject(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error(`couldn't load ${src}`)); };
    document.head.appendChild(script);
  });
}

// Careful: this build's `cv.then(fn)` calls fn(cv) with cv itself, so `await cv` (or resolving a promise with cv)
// loops forever. Poll until cv.Mat exists instead, and remove `then` once it is ready.
function settle() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const cv = window.cv;
      if (cv && cv.Mat && cv.imread) { delete cv.then; resolve(); return; } // ready (polled: Mat appears at init)
      if (cv instanceof Promise) {
        cv.then((mod) => { if (mod?.then) delete mod.then; window.cv = mod; check(); }, reject);
        return;
      }
      if (Date.now() - started > 60000) { reject(new Error("OpenCV.js took too long to start")); return; }
      setTimeout(check, 200);
    };
    check();
  });
}

export function loadOpenCV() {
  if (ready) return ready;
  ready = (async () => {
    if (window.cv?.Mat) return window.cv;
    let lastError;
    for (const src of SOURCES) {
      try { await inject(src); await settle(); return window.cv; } catch (error) { lastError = error; }
    }
    throw lastError;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

// Order four points as top-left, top-right, bottom-right, bottom-left.
export function orderCorners(points) {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

// Find the four-sided shapes in a frame (boxes drawn in marker on paper, or index cards), biggest first, up to `max`.
// A box inside another box doesn't count (a thick marker line has an inside and an outside edge: that's one box).
// `source` is a canvas holding the frame. Returns [{ quad: [tl, tr, br, bl] in that canvas's pixels, area }].
// `mats` holds reusable OpenCV images so we don't allocate every frame; call freeMats(mats) when done.
// `colorful: true` finds colored index cards instead of drawn lines: it looks for patches of strong color (saturation),
// so a yellow card on white paper stands out even though both look light in black and white.
export function findBoxes(cv, source, mats, { minArea = 0.02, maxArea = 0.9, blockSize = 25, offset = 12, max = 1, colorful = false } = {}) {
  const { width: W, height: H } = source;
  mats.src ??= new cv.Mat();
  mats.gray ??= new cv.Mat();
  mats.bin ??= new cv.Mat();
  mats.kernel ??= cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const src = cv.imread(source);
  if (colorful) {
    mats.rgb ??= new cv.Mat();
    mats.hsv ??= new cv.Mat();
    cv.cvtColor(src, mats.rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(mats.rgb, mats.hsv, cv.COLOR_RGB2HSV);
    const channels = new cv.MatVector();
    cv.split(mats.hsv, channels);
    const saturation = channels.get(1);
    saturation.copyTo(mats.gray);
    saturation.delete();
    channels.delete();
    src.delete();
    cv.GaussianBlur(mats.gray, mats.gray, new cv.Size(5, 5), 0);
    // Strong color → white, paper and table (grey, white, black) → black. `offset` sets how colorful counts (×5).
    cv.threshold(mats.gray, mats.bin, Math.min(250, offset * 5), 255, cv.THRESH_BINARY);
  } else {
    cv.cvtColor(src, mats.gray, cv.COLOR_RGBA2GRAY);
    src.delete();
    cv.GaussianBlur(mats.gray, mats.gray, new cv.Size(5, 5), 0);
    // Dark marker on light paper → white lines on black. Adaptive, so uneven studio light is OK.
    cv.adaptiveThreshold(mats.gray, mats.bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, blockSize, offset);
  }
  cv.morphologyEx(mats.bin, mats.bin, cv.MORPH_CLOSE, mats.kernel); // join small gaps in the drawn line

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mats.bin, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  const shapes = [];
  const frame = W * H;
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    if (area < minArea * frame || area > maxArea * frame) { c.delete(); continue; }
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.03 * cv.arcLength(c, true), true);
    if (approx.rows === 4 && cv.isContourConvex(approx)) {
      const d = approx.data32S;
      shapes.push({ area, quad: orderCorners([0, 1, 2, 3].map((k) => ({ x: d[k * 2], y: d[k * 2 + 1] }))) });
    }
    approx.delete();
    c.delete();
  }
  contours.delete();
  hierarchy.delete();
  shapes.sort((a, b) => b.area - a.area);
  const boxes = [];
  for (const shape of shapes) {
    if (boxes.length >= max) break;
    const middle = centre(shape.quad);
    if (boxes.some((box) => inside(middle, box.quad) || inside(centre(box.quad), shape.quad))) continue;
    boxes.push(shape);
  }
  return boxes;
}

// The biggest box only (the one-box version).
export function findBox(cv, source, mats, options = {}) {
  return findBoxes(cv, source, mats, { ...options, max: 1 })[0] || null;
}

export function centre(quad) {
  return { x: quad.reduce((s, p) => s + p.x, 0) / quad.length, y: quad.reduce((s, p) => s + p.y, 0) / quad.length };
}

// Is a point inside a convex four-cornered shape [tl, tr, br, bl]?
export function inside(point, quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross !== 0) { if (sign && Math.sign(cross) !== sign) return false; sign = Math.sign(cross); }
  }
  return true;
}

export function freeMats(mats) {
  for (const mat of Object.values(mats)) { try { mat.delete(); } catch {} }
}

// Steady the box: smooth small movements, ignore one-frame jumps, hold the box briefly when it's lost.
export function makeStabilizer({ smoothing = 0.35, jump = 0.08, confirmFrames = 4, holdMs = 1200 } = {}) {
  let current = null;
  let candidate = null;
  let candidateCount = 0;
  let lastSeen = 0;
  const gap = (a, b) => a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / 4;
  return function update(quad, scale, now = performance.now()) {
    if (quad) {
      lastSeen = now;
      if (!current) { current = quad; }
      else if (gap(quad, current) < jump * scale) {
        current = current.map((p, i) => ({ x: p.x + (quad[i].x - p.x) * smoothing, y: p.y + (quad[i].y - p.y) * smoothing }));
        candidate = null; candidateCount = 0;
      } else if (candidate && gap(quad, candidate) < jump * scale) {
        candidate = quad; candidateCount += 1;
        if (candidateCount >= confirmFrames) { current = quad; candidate = null; candidateCount = 0; }
      } else { candidate = quad; candidateCount = 1; }
    } else if (current && now - lastSeen > holdMs) {
      current = null;
    }
    return current;
  };
}

// A CSS matrix3d that maps a w×h element (transform-origin 0 0) onto four corners [tl, tr, br, bl].
// The classic projective-mapping math: solve the homography from the unit rectangle to the quad.
export function quadTransform(w, h, [tl, tr, br, bl]) {
  const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  const mul = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; } return c; };
  const mulv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const basis = (p1, p2, p3, p4) => { const m = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1]; const v = mulv(adj(m), [p4.x, p4.y, 1]); return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
  const s = basis({ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h });
  const d = basis(tl, tr, bl, br);
  const t = mul(d, adj(s)).map((v, _, arr) => v / arr[8]);
  return `matrix3d(${[t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(",")})`;
}

// The average color inside a box (its middle 60%, so the edges and the drawn line don't count), from a canvas's
// pixels. Returns { r, g, b, hue (0–360), saturation (0–1), value (0–1) }.
export function boxColor(image, [tl, tr, br, bl], steps = 14) {
  const { data, width } = image;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const u = 0.2 + (0.6 * i) / (steps - 1);
    const v = 0.2 + (0.6 * j) / (steps - 1);
    const x = Math.round((1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x));
    const y = Math.round((1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y));
    const k = (y * width + x) * 4;
    if (k < 0 || k >= data.length) continue;
    r += data[k]; g += data[k + 1]; b += data[k + 2]; n += 1;
  }
  if (!n) return null;
  r /= n * 255; g /= n * 255; b /= n * 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { r, g, b, hue: (hue * 60 + 360) % 360, saturation: max ? d / max : 0, value: max };
}

// The nearest card color by hue, or null for a grey, white, or black card.
export function nearestCard(color, cards, { minSaturation = 0.3, minValue = 0.2 } = {}) {
  if (!color || color.saturation < minSaturation || color.value < minValue) return null;
  const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  return cards.reduce((best, card) => (!best || gap(color.hue, card.hue) < gap(color.hue, best.hue) ? card : best), null);
}
