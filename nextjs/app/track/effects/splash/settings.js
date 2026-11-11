// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /track/effects/splash: a fluid simulation you stir with the mouse or your hand.
//  Save it and the page updates. The effect is React Bits' SplashCursor (lib/cv/react-bits/, MIT + Commons Clause).
// ─────────────────────────────────────────────────────────────────────────────

// The sliders on the page. Each one sets the SplashCursor setting named in `prop`, live (no restart).
export const sliders = [
  { prop: "CURL", label: "Swirl", min: 0, max: 30, step: 0.5, value: 3 },
  { prop: "DENSITY_DISSIPATION", label: "Fade", min: 0.2, max: 6, step: 0.1, value: 1.5 },
  { prop: "SPLAT_RADIUS", label: "Splash size", min: 0.05, max: 1, step: 0.01, value: 0.25 },
  { prop: "SPLAT_FORCE", label: "Force", min: 1000, max: 15000, step: 100, value: 6000 },
];

// The color of the fluid, or rainbow colors that change as you move.
export const color = "#ff6b57";
export const rainbow = true;

// Kept low so it runs well on a laptop and a projector. Higher is sharper and heavier (these restart the effect).
export const quality = { SIM_RESOLUTION: 64, DYE_RESOLUTION: 512, PRESSURE_ITERATIONS: 10 };

// The fluid gets glitchy after a while, so it starts fresh every RESET_SECONDS (and on the Reset button).
export const RESET_SECONDS = 45;

// Your hand (with "Use my hand" on): the index fingertip stirs; a pinch makes a burst where your fingertip is.
export const pinchBurst = true;
