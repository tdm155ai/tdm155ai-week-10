---
title: "TouchDesigner"
description: "Derivative's node-based environment for real-time visuals, installations, and projection. Mechanic: node graph."
---

**What it is:** a visual programming environment where you wire **operators** into a live **network** that renders in real time: audio-reactive visuals, projection mapping, sensor-driven installations. Made by Derivative (Toronto). Windows and macOS (Apple Silicon recommended; some operators, such as Kinect and Face Track, are Windows/Nvidia only). Mechanic: [node graph](/pro-apps/mechanics/node-graph).

**Cost (checked Nov 11, 2026, [derivative.ca licensing](https://derivative.ca/UserGuide/Licensing)):** **Non-Commercial is free**: no paid work, image resolution capped at 1280×1280, a few pro operators missing, 10 install keys per account. Educational $300, Commercial $600, Pro $2,200.

## The maneuver, unpacked

1. You're inside a **network**. Press Tab to create an operator.
2. Pick a **family** (color-coded): **TOP** images on the GPU, **CHOP** channels of numbers (audio, LFOs, sensors), **SOP** 3D geometry, **DAT** text, tables and Python, **MAT** materials, **COMP** components and containers.
3. Drop a source (a Noise TOP, a Movie File In TOP). Every operator shows a live preview.
4. **Wire** outputs to inputs, left to right: Movie File In → Level → Composite → Null.
5. Make it react: an Audio Device In CHOP or an LFO, **exported** into a parameter on a TOP, so a number drives the picture.
6. For 3D: Geometry COMP + SOPs + Camera + Light → Render TOP.
7. Send the final TOP to a **Window COMP** on the projector, or use perform mode.

## Watch

- [TouchDesigner Quick Start Guide](https://www.youtube.com/watch?v=icV5moCR87s) (threedashes, 23:59; 2020 build). Chapters: 01:44 SOP · 07:13 CHOP · 13:30 TOP · 18:17 DAT · 20:20 rendering. The best single tour of the families.
- [03 – The Interface – TouchDesigner Beginner Course](https://www.youtube.com/watch?v=xtp1CLzWRUk) (bileam tschepe / elekktronaut, 13:03). **08:16 the network.** Part of a free [22-video beginner course](https://www.youtube.com/playlist?list=PLFrhecWXVn5862cxJgysq9PYSjLdfNiHz).
- [01 – About TouchDesigner](https://www.youtube.com/watch?v=u2Jr060p8dY) (bileam tschepe, 6:34). **03:30 use cases, 05:58 showcase.** For inspiration, browse [derivative.ca/showcase](https://derivative.ca/showcase).

Checked Nov 11, 2026 against YouTube's metadata (chapters from the descriptions).

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-patch/page.jsx: a tiny
TouchDesigner-style network written as code, with a preview at each step.
- Source: the webcam (getUserMedia) into a <video>.
- Signal: microphone loudness from a Web Audio AnalyserNode, smoothed (0–1).
- Effect: draw the webcam into a canvas each frame with requestAnimationFrame;
  loudness drives a hue shift and a zoom. Show three small previews side by side:
  "camera", "loudness" (a moving bar), "output".
- Output: also call setParam("brightness", loudness) so the stage window reacts.
- Label each box like an operator (TOP / CHOP) so I can see the network.
Keep it one file and explain the data flow in a comment at the top.
```

**Could you replace it?** Partly. A single-purpose patch, yes; TouchDesigner as a whole studio, no. Worth knowing it's free to try: Marlon will have it open in class.
