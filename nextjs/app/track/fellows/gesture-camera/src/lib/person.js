// person.js: cuts the person out of each camera frame with the segmenter's
// mask, so the background can be blurred or swapped, and the person made
// bigger or smaller and moved left or right.
//
// Layers, back to front:
//   1. the background: the camera, the empty stage it has learned, or black;
//      blurred if Background blur is up;
//   2. you, cut out of the camera picture, resized from your feet and moved.
// Then the look (exposure, contrast, color, warmth) over both.
//
// All of it is canvas drawing, which the browser does on the graphics card.
// The only work done point by point in JavaScript is on the small mask
// (256 × 144 points), not the full picture.

import { drawWarmth, lookFilter } from "./look.js";

export const BACKGROUNDS = {
  camera: "Camera",
  plate: "Empty stage",
  black: "Black",
};

// Is any person effect on? If not, the page skips all of this.
export function personEffectsOn(look, background) {
  return background !== "camera" || look.blur > 0.005 || Math.abs(look.size - 1) > 0.005 || Math.abs(look.move) > 0.005;
}

// How much each new mask counts against the last (0–1). Lower is steadier but lags behind you.
const MASK_FOLLOW = 0.6;

// How fast the empty stage takes in what's behind you, per frame (0–1).
const PLATE_LEARN = 0.08;

// How far the blur reaches at 100%, as a share of the picture's height.
const MAX_BLUR = 0.04;

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class PersonLayer {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.soft = null;
    this.hasMask = false;
    this.plateFilled = false;
    // Where you are in the picture (0–1): the middle across, and your lowest point.
    this.box = { cx: 0.5, bottom: 1, found: false };
  }

  // The size of the camera picture.
  resize(width, height) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.margin = Math.ceil(MAX_BLUR * height * 2) + 2;
    this.person = makeCanvas(width, height);
    this.plate = makeCanvas(width, height);
    this.scratch = makeCanvas(width, height);
    this.pad = makeCanvas(width + 2 * this.margin, height + 2 * this.margin);
    this.plateFilled = false;
  }

  // values: the segmenter's person mask for this frame, w × h points, 0–1 each.
  updateMask(values, w, h) {
    if (!this.soft || w !== this.maskW || h !== this.maskH) {
      this.maskW = w;
      this.maskH = h;
      this.soft = Float32Array.from(values);
      this.rowMax = new Float32Array(w * h);
      this.mask = makeCanvas(w, h);
      this.maskData = this.mask.getContext("2d").createImageData(w, h);
      this.maskData.data.fill(255);
      this.wide = makeCanvas(w, h);
      this.wideData = this.wide.getContext("2d").createImageData(w, h);
      this.wideData.data.fill(255);
    }

    // Smooth the mask over time so the edge doesn't shimmer, and firm it up:
    // under 0.3 sure is background, over 0.7 is you.
    const soft = this.soft;
    const alpha = this.maskData.data;
    let minX = w;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const s = soft[i] + (values[i] - soft[i]) * MASK_FOLLOW;
        soft[i] = s;
        alpha[i * 4 + 3] = Math.max(0, Math.min(255, ((s - 0.3) / 0.4) * 255));
        if (s > 0.5) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    this.mask.getContext("2d").putImageData(this.maskData, 0, 0);

    // A wider mask, a few points bigger all round, so the empty stage learns
    // what's behind you without picking up your edges.
    const R = 4;
    const rowMax = this.rowMax;
    const wide = this.wideData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let k = Math.max(0, x - R); k <= Math.min(w - 1, x + R); k++) m = Math.max(m, soft[y * w + k]);
        rowMax[y * w + x] = m;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let k = Math.max(0, y - R); k <= Math.min(h - 1, y + R); k++) m = Math.max(m, rowMax[k * w + x]);
        wide[(y * w + x) * 4 + 3] = m > 0.25 ? 255 : 0;
      }
    }
    this.wide.getContext("2d").putImageData(this.wideData, 0, 0);

    // Where you are, smoothed, so resizing grows from your feet and doesn't jitter.
    if (count > w * h * 0.002) {
      const box = this.box;
      const follow = box.found ? 0.2 : 1;
      box.cx += ((minX + maxX + 1) / 2 / w - box.cx) * follow;
      box.bottom += ((maxY + 1) / h - box.bottom) * follow;
      box.found = true;
    }
    this.hasMask = true;
  }

  // Learns the empty stage a little each frame, from every part of the
  // picture you're not in. The first frame is taken whole.
  learnPlate(video) {
    const { width: W, height: H } = this;
    const plate = this.plate.getContext("2d");
    if (!this.plateFilled) {
      plate.drawImage(video, 0, 0, W, H);
      this.plateFilled = true;
      return;
    }
    const s = this.scratch.getContext("2d");
    s.globalCompositeOperation = "copy";
    s.drawImage(video, 0, 0, W, H);
    s.globalCompositeOperation = "destination-out";
    s.drawImage(this.wide, 0, 0, W, H);
    s.globalCompositeOperation = "source-over";
    plate.globalAlpha = PLATE_LEARN;
    plate.drawImage(this.scratch, 0, 0);
    plate.globalAlpha = 1;
  }

  // Takes the whole frame as the empty stage, for when no one's in it.
  capturePlate(video) {
    this.plate.getContext("2d").drawImage(video, 0, 0, this.width, this.height);
    this.plateFilled = true;
  }

  // How you're resized and moved, in the camera's 0–1 coordinates. Move is
  // as you see it on the stage, so with Mirror on, right on screen is left
  // in the camera's own picture.
  placement(look, mirror) {
    return { scale: look.size, ax: this.box.cx, ay: this.box.bottom, dx: mirror ? -look.move : look.move };
  }

  // Where a point of the camera picture ends up once you're resized and moved.
  place(point, look, mirror) {
    const { scale, ax, ay, dx } = this.placement(look, mirror);
    return { x: ax + dx + (point.x - ax) * scale, y: ay + (point.y - ay) * scale };
  }

  // The background with its edge pixels stretched outward, so the blur
  // doesn't pull darkness in from beyond the picture's edges.
  fillPad(source) {
    const { width: W, height: H, margin: m } = this;
    const sw = source.videoWidth || source.width;
    const sh = source.videoHeight || source.height;
    const g = this.pad.getContext("2d");
    g.drawImage(source, 0, 0, sw, sh, m, m, W, H);
    g.drawImage(source, 0, 0, 1, sh, 0, m, m, H);
    g.drawImage(source, sw - 1, 0, 1, sh, m + W, m, m, H);
    g.drawImage(source, 0, 0, sw, 1, m, 0, W, m);
    g.drawImage(source, 0, sh - 1, sw, 1, m, m + H, W, m);
    g.drawImage(source, 0, 0, 1, 1, 0, 0, m, m);
    g.drawImage(source, sw - 1, 0, 1, 1, m + W, 0, m, m);
    g.drawImage(source, 0, sh - 1, 1, 1, 0, m + H, m, m);
    g.drawImage(source, sw - 1, sh - 1, 1, 1, m + W, m + H, m, m);
  }

  // Draws this frame into the picture canvas: background, then you, then the look.
  draw(ctx, video, look, { background, mirror }) {
    const { width: W, height: H } = this;
    const filter = lookFilter(look);

    // You, cut out of this frame. The mask is small, so it's stretched up
    // smoothly and softened a touch at the edge.
    const p = this.person.getContext("2d");
    p.globalCompositeOperation = "copy";
    p.drawImage(video, 0, 0, W, H);
    p.globalCompositeOperation = "destination-in";
    p.filter = `blur(${(H / 480).toFixed(1)}px)`;
    p.drawImage(this.mask, 0, 0, W, H);
    p.filter = "none";
    p.globalCompositeOperation = "source-over";

    ctx.save();
    if (background === "black") {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    } else {
      const source = background === "plate" ? this.plate : video;
      const blur = look.blur * MAX_BLUR * H;
      if (blur < 0.5) {
        ctx.filter = filter;
        ctx.drawImage(source, 0, 0, W, H);
      } else {
        this.fillPad(source);
        ctx.filter = `${filter} blur(${blur.toFixed(1)}px)`;
        ctx.drawImage(this.pad, -this.margin, -this.margin);
      }
    }
    ctx.restore();

    const { scale, ax, ay, dx } = this.placement(look, mirror);
    ctx.save();
    ctx.filter = filter;
    ctx.translate((ax + dx) * W, ay * H);
    ctx.scale(scale, scale);
    ctx.translate(-ax * W, -ay * H);
    ctx.drawImage(this.person, 0, 0);
    ctx.restore();

    drawWarmth(ctx, look);
  }
}
