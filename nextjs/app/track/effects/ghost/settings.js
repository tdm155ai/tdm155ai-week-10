// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /track/effects/ghost: a glowing cloud that trails behind the mouse, your hand, or your head.
//  Save it and the page updates. The effect is React Bits' GhostCursor (lib/cv/react-bits/, MIT + Commons Clause),
//  drawn with Three.js.
// ─────────────────────────────────────────────────────────────────────────────

// The sliders on the page. Each sets the GhostCursor setting named in `prop`.
export const sliders = [
  { prop: "trailLength", label: "Trail", min: 5, max: 80, step: 1, value: 50, restarts: true }, // rebuilds the effect, so it applies when the slider stops
  { prop: "inertia", label: "Drift", min: 0, max: 0.98, step: 0.01, value: 0.5 },
  { prop: "bloomStrength", label: "Glow", min: 0, max: 2, step: 0.01, value: 0.4 },
  { prop: "brightness", label: "Brightness", min: 0.2, max: 3, step: 0.01, value: 1.2 },
  { prop: "grainIntensity", label: "Grain", min: 0, max: 0.3, step: 0.005, value: 0.05 },
  { prop: "edgeIntensity", label: "Edge", min: 0, max: 1, step: 0.01, value: 0 },
];

// The cloud's starting color (there's a color picker on the page too).
export const color = "#b497cf";

// Kept low so it runs well on a laptop and a projector (1 = full sharpness, heavier).
export const maxDevicePixelRatio = 0.75;

// What the cloud follows when the camera is on: "head" (the tip of your nose) or "hand" (your index fingertip).
export const follow = "head";
