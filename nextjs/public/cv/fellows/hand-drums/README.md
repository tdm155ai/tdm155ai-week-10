---
title: Hand drums
description: A webcam drum kit played with hand gestures (MediaPipe), with a gesture-controlled loop tray. Runs entirely on this computer.
author: claude
status: prototype
---

# Hand drums

Play drums in the air. MediaPipe Hand Landmarker tracks up to two hands in the browser; the sounds are synthesized with Web Audio. Nothing is uploaded, recorded, or sent to GitHub: the library, wasm and model are vendored in this folder and the camera image never leaves the page.

## Run it

```bash
node pocs/hand-drums/serve.mjs
```

Open http://localhost:3099 in Chrome and click **Start camera and sound**. (It needs a server rather than double-clicking `index.html`, because browsers block camera and wasm on `file://`.)

## Gestures

| gesture | does |
| --- | --- |
| Point with one finger and move it into a pad | the pad plays once (leave it and come back to play it again). A menu at the top right switches this to "taps down", where a downward tap plays the pad under your fingertip |
| Open palm, tap down | palm hit (the bongo/conga tone; a different voice on each pad) |
| Open palm, swipe sideways | next / previous drum set: Drum kit, Bongos, Congas, Electro |
| Pinch (thumb to index) | start recording a loop; pinch again to close it and start it playing |
| Fist over a loop in the tray | grab it; open your hand outside the tray (or flick) to throw it away |

Tap harder and faster for a louder hit. Up to eight loops play at once and the loop you record is layered on top of the others. A loop is whatever you drum between the two pinches, silence at the end included.

## Without a camera

Keys `A S D F` hit the pads (Shift for palm), `←` `→` change drums, `R` or Space starts and stops a loop, Delete clears the loops. Click a loop to mute it; drag it above the tray to throw it away.

## Tuning

The little graph at the top left plots the downstroke speed of the finger or palm (dashed line = speed needed, orange bar = a hit); `G` hides it. Press `L` to save the last 20 seconds of tracking as `hand-drums-log.json`, which is useful for tuning. The **Sensitivity** slider (top right) sets how hard a tap must be. If swipes read as hits, or hits as swipes, move it a notch. Good light and a plain background help; keep the hand roughly a forearm's length from the camera and the whole hand in frame. The detection thresholds are at the top of `gestures.js`.

## Files

- `app.js`: camera, MediaPipe, drawing, loops
- `gestures.js`: landmarks to taps, swipes, pinches, fists
- `audio.js`: the drum voices and kits
- `vendor/`, `models/`: MediaPipe tasks-vision 1.2.2 (Apache-2.0) and `hand_landmarker.task` (about 22 MB together), loaded from here, not a CDN
- `serve.mjs`: local-only server (127.0.0.1)
