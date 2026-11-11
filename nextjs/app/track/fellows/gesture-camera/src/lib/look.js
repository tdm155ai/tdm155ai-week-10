// look.js: the controls for the picture, in two groups.
//   "look": exposure, contrast, color, warmth, for the whole picture.
//   "you": background blur, size and move, for the person (lib/person.js).
// Each is applied while drawing a camera frame into the canvas that gets recorded.
//
// The look changes the picture after the camera has taken it, like a filter.
// It can't bring back detail the camera lost: a blown-out white stays white
// when you turn exposure down.

export const LOOK_CONTROLS = {
  exposure: {
    group: "look",
    label: "Brightness",
    min: -1.5,
    max: 1.5,
    step: 0.05,
    normal: 0,
    color: "#ffb000",
    // In stops, like a camera: +1 is twice as bright, -1 half as bright.
    format: (v) => (Math.abs(v) < 0.05 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`),
  },
  contrast: {
    group: "look",
    label: "Contrast",
    min: 0.5,
    max: 1.8,
    step: 0.01,
    normal: 1,
    color: "#a99cff",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  color: {
    group: "look",
    label: "Color",
    min: 0,
    max: 2,
    step: 0.01,
    normal: 1,
    color: "#2ad1a0",
    // 0% is black and white.
    format: (v) => `${Math.round(v * 100)}%`,
  },
  warmth: {
    group: "look",
    label: "Warmth",
    min: -1,
    max: 1,
    step: 0.01,
    normal: 0,
    color: "#ff8a3d",
    format: (v) => (Math.abs(v) < 0.01 ? "0" : `${v > 0 ? "warm" : "cool"} ${Math.round(Math.abs(v) * 100)}%`),
  },
  blur: {
    group: "you",
    label: "Background blur",
    short: "Blur",
    min: 0,
    max: 1,
    step: 0.01,
    normal: 0,
    color: "#5fb3ff",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  size: {
    group: "you",
    label: "Size",
    min: 0.5,
    max: 2,
    step: 0.01,
    normal: 1,
    color: "#ff7ad9",
    format: (v) => `${Math.round(v * 100)}%`,
  },
  move: {
    group: "you",
    label: "Move",
    menu: "Move left / right",
    min: -0.5,
    max: 0.5,
    step: 0.01,
    normal: 0,
    color: "#f5e663",
    // Slid sideways, not up and down, and as you see it on the stage: right is right.
    axis: "x",
    travel: 0.6,
    format: (v) => (Math.abs(v) < 0.005 ? "0" : `${v < 0 ? "←" : "→"} ${Math.round(Math.abs(v) * 100)}%`),
  },
};

export const LOOK_IDS = Object.keys(LOOK_CONTROLS);
export const GROUP_IDS = {
  look: LOOK_IDS.filter((id) => LOOK_CONTROLS[id].group === "look"),
  you: LOOK_IDS.filter((id) => LOOK_CONTROLS[id].group === "you"),
};

export const NORMAL_LOOK = Object.fromEntries(LOOK_IDS.map((id) => [id, LOOK_CONTROLS[id].normal]));

// The words for a control's value on the stage: "Exposure +0.5", "Warm 40%".
export function describe(id, value) {
  const c = LOOK_CONTROLS[id];
  if (id === "warmth" && Math.abs(value) >= 0.01) return `${value > 0 ? "Warm" : "Cool"} ${Math.round(Math.abs(value) * 100)}%`;
  return `${c.short ?? c.label} ${c.format(value)}`;
}

export function isNormal(look, id) {
  const c = LOOK_CONTROLS[id];
  return Math.abs(look[id] - c.normal) < c.step / 2;
}

// The look with one group put back to normal.
export function resetGroup(look, group) {
  return { ...look, ...Object.fromEntries(GROUP_IDS[group].map((id) => [id, LOOK_CONTROLS[id].normal])) };
}

export function clampLook(id, value) {
  const c = LOOK_CONTROLS[id];
  const v = Math.min(c.max, Math.max(c.min, value));
  // Snap to normal when close, so it's easy to slide back to where you started.
  return Math.abs(v - c.normal) < (c.max - c.min) * 0.025 ? c.normal : v;
}

// The canvas filter for exposure, contrast and color.
export function lookFilter(look) {
  return `brightness(${(2 ** look.exposure).toFixed(3)}) contrast(${look.contrast.toFixed(3)}) saturate(${look.color.toFixed(3)})`;
}

// Whether this browser can filter a canvas (some versions of Safari can't).
export function canFilterCanvas() {
  const ctx = document.createElement("canvas").getContext("2d");
  return typeof ctx?.filter === "string";
}

// A wash of orange or blue light over the whole picture, blended so it tints without flattening.
export function drawWarmth(ctx, look) {
  if (Math.abs(look.warmth) < 0.01) return;
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = look.warmth > 0 ? `rgba(255, 140, 30, ${look.warmth * 0.7})` : `rgba(40, 130, 255, ${-look.warmth * 0.7})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Draws one camera frame into the canvas with the look applied (when no
// person effect is on). The canvas is the camera's own size and isn't
// mirrored, so recordings show the real left and right; the page mirrors it
// on screen with CSS.
export function drawPicture(ctx, video, look) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.filter = lookFilter(look);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
  drawWarmth(ctx, look);
}
