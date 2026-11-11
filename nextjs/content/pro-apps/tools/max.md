---
title: Max/MSP
description: Cycling '74's visual programming environment for music, sound, and video: objects wired with patch cords. Mechanic: node graph.
---

**What it is:** a visual programming environment. You place **objects** in a **patcher** and connect them with **patch cords**; MSP handles audio and Jitter handles video. The grandparent of the node-graph apps, and the tool of choice in experimental music and sound art. Made by Cycling '74 (owned by Ableton); macOS and Windows; current version Max 9. **Max for Live** runs Max devices inside Ableton Live (bundled with Live Suite). Mechanic: [node graph](/pro-apps/mechanics/node-graph).

**Cost (checked Nov 11, 2026, [cycling74.com/shop](https://cycling74.com/shop/max)):** $399 permanent, or $120/year, or $12.99/month. **Free 30-day demo; after that you can still run and edit patches, but not save** ([source](https://support.cycling74.com/hc/en-us/articles/32781890060947-Is-there-a-Max-demo)).

## The maneuver, unpacked

1. File > New Patcher. Press `n` and type `metro 500`: an object that "bangs" every 500 ms.
2. Add a **toggle** and wire it into the metro's left inlet.
3. Wire `metro` → `random 12` → `+ 60`: random note numbers.
4. → `makenote 100 250` (velocity, duration) → `noteout`: plays the computer's built-in synth.
5. **Message boxes** `200` and `1000` wired to the metro's right inlet change its speed when clicked.
6. Lock the patch (Cmd-E), click the toggle: music.
7. **Presentation mode** hides the wiring and shows a clean front panel for the operator.

## Watch

- [Getting Started~ a beginners' guide to Max MSP (2025)](https://www.youtube.com/watch?v=oNpi9Y7w4D8) (oliver thurley, 51:41). Chapters: 05:38 kinds of objects · 08:31 message boxes · 18:52 inlets and outlets · 20:05 edit vs interaction mode.
- [Intro to MIDI in Max 7](https://www.youtube.com/watch?v=zCx_7lum-DU) (Kimberlee Swisher, 8:28). ~2:02 `noteout`; ~2:32 `makenote`; ~6:08 metro → counter → select firing chords.
- [Welcome to Max 9](https://www.youtube.com/watch?v=XZNu1Lcj9js) (Cycling '74, official, 1:09): what it looks like now.

Checked Nov 11, 2026 against YouTube's metadata.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-max/page.jsx: the classic first
Max patch, as code, with a visible "patch" diagram.
- A metro (a setInterval you can start/stop with a toggle) bangs every N ms;
  N comes from a slider (or MIDI dial 1 on the Akai MPK).
- Each bang picks a random note from a C-major scale and plays it with Tone.js.
- Every 8th bang fires a random color cue on the stage (fireCue kind "color").
- Draw the chain as boxes and arrows at the top: toggle → metro → random → note →
  synth, and flash each box when it fires.
```

**Could you replace it?** Any one patch, yes: anything you'd build in Max you can describe to Claude as code. The environment itself (live patching, decades of objects, Max for Live), no.
