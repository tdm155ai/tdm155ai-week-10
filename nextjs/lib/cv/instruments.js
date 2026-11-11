// The /track instruments: each one turns a MediaPipe result into numbers (`readout`), on/off switches (`on`,
// which the page debounces into cues), and, for the fader, a continuous `value` from 0 to 1.
// `points` arrive already flipped for the mirror (see draw.js `view`). Cues are in app/track/cues.js.

import { dots, HAND_CONNECTIONS, label, POSE_CONNECTIONS, skeleton, view } from "./draw.js";

const fmt = (v, d = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "–");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const INSTRUMENTS = {
  fader: {
    label: "Hand fader",
    model: "hand",
    explain: "Your index fingertip's height is a fader: bottom of the picture is 0, top is 1. It drives a stage control continuously (brightness by default; set it in cues.js). Fire a picture cue on the stage first so there's something to dim.",
    read(result, mirror, ctx) {
      const hands = (result.landmarks || []).map((p) => view(p, mirror));
      const tip = hands[0]?.[8];
      const value = tip ? clamp01((0.9 - tip.y) / 0.8) : null; // top 10% = 1, bottom 10% = 0
      hands.forEach((p) => skeleton(ctx, p, HAND_CONNECTIONS));
      const { width: W, height: H } = ctx.canvas;
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(W - 60, H * 0.1, 30, H * 0.8);
      if (value !== null) {
        ctx.fillStyle = "#ff6b57";
        ctx.fillRect(W - 60, H * 0.9 - value * H * 0.8, 30, value * H * 0.8);
        label(ctx, fmt(value), W - 140, H * 0.9 - value * H * 0.8);
      }
      return { value, on: {}, readout: [["hand seen", tip ? "yes" : "no"], ["fingertip y", fmt(tip?.y)], ["fader value", fmt(value), value !== null]] };
    },
  },

  pinch: {
    label: "Pinch",
    model: "hand",
    explain: "Touch your thumb tip to your index fingertip. The distance between them is divided by the size of your hand, so it works near or far from the camera. Under 0.25 counts as a pinch.",
    read(result, mirror, ctx) {
      const hands = (result.landmarks || []).map((p) => view(p, mirror));
      const rows = [["hands seen", String(hands.length)]];
      let pinched = false;
      hands.forEach((p, i) => {
        skeleton(ctx, p, HAND_CONNECTIONS);
        const ratio = dist(p[4], p[8]) / Math.max(dist(p[0], p[9]), 1e-6);
        const isPinch = ratio < 0.25;
        pinched ||= isPinch;
        const { width: W, height: H } = ctx.canvas;
        ctx.strokeStyle = isPinch ? "#7fc787" : "#ecece6";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(p[4].x * W, p[4].y * H); ctx.lineTo(p[8].x * W, p[8].y * H); ctx.stroke();
        label(ctx, `pinch ${fmt(ratio)}`, p[8].x * W + 14, p[8].y * H - 14, { size: 22 });
        rows.push([`hand ${i + 1} pinch distance`, fmt(ratio), isPinch]);
      });
      return { on: { pinch: pinched }, readout: rows };
    },
  },

  gestures: {
    label: "Gestures",
    model: "gesture",
    explain: "MediaPipe's gesture recognizer knows seven hand shapes: Thumb_Up, Thumb_Down, Open_Palm, Closed_Fist, Victory, Pointing_Up, ILoveYou. Hold one steady for a moment and its cue fires. A score over 0.6 counts.",
    read(result, mirror, ctx) {
      const hands = (result.landmarks || []).map((p) => view(p, mirror));
      const on = {};
      const rows = [["hands seen", String(hands.length)]];
      hands.forEach((p, i) => {
        skeleton(ctx, p, HAND_CONNECTIONS);
        const top = result.gestures?.[i]?.[0];
        const name = top?.categoryName || "None";
        const hit = name !== "None" && top.score > 0.6;
        if (hit) on[name] = true;
        label(ctx, `${name} ${fmt(top?.score)}`, p[0].x * ctx.canvas.width - 40, p[0].y * ctx.canvas.height + 40, { size: 24, color: hit ? "#7fc787" : "#ecece6" });
        rows.push([`hand ${i + 1}`, `${name} ${fmt(top?.score)}`, hit]);
      });
      return { on, readout: rows };
    },
  },

  mouth: {
    label: "Mouth open",
    model: "face",
    explain: "The face model returns 52 expression numbers (blendshapes) from 0 to 1. Open your mouth wide and jawOpen goes up; past the threshold in cues.js, the cue fires. Smile, blink, and brow numbers are shown too, for you to use.",
    read(result, mirror, ctx, config) {
      const face = result.faceLandmarks?.[0];
      if (face) dots(ctx, view(face, mirror), { every: 3 });
      const shapes = Object.fromEntries((result.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
      const threshold = config?.threshold ?? 0.45;
      const open = (shapes.jawOpen ?? 0) > threshold;
      return {
        on: { open },
        readout: [
          ["face seen", face ? "yes" : "no"],
          ["jawOpen", fmt(shapes.jawOpen), open],
          ["mouthSmileLeft", fmt(shapes.mouthSmileLeft)],
          ["mouthSmileRight", fmt(shapes.mouthSmileRight)],
          ["eyeBlinkLeft", fmt(shapes.eyeBlinkLeft)],
          ["eyeBlinkRight", fmt(shapes.eyeBlinkRight)],
          ["browInnerUp", fmt(shapes.browInnerUp)],
        ],
      };
    },
  },

  arms: {
    label: "Arms up",
    model: "pose",
    explain: "The pose model finds 33 points on a body. When both wrists are above your nose, the cue fires. Step back so the camera sees your upper body.",
    read(result, mirror, ctx) {
      const body = result.landmarks?.[0] ? view(result.landmarks[0], mirror) : null;
      if (!body) return { on: { up: false }, readout: [["body seen", "no"]] };
      skeleton(ctx, body, POSE_CONNECTIONS, { color: "#7fb3ff" });
      const nose = body[0];
      const left = nose.y - body[15].y; // positive = wrist above nose
      const right = nose.y - body[16].y;
      const up = left > 0 && right > 0;
      return {
        on: { up },
        readout: [["body seen", "yes"], ["wrist 1 above nose", fmt(left), left > 0], ["wrist 2 above nose", fmt(right), right > 0], ["both up", up ? "YES" : "no", up]],
      };
    },
  },
};
