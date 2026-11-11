---
title: Track (MediaPipe)
order: 4
description: Your hands, face, and body as a controller. Raise a hand and a cue fires on the stage.
---

**Open:** [/track](/track) (Hello World), then [/track/instruments](/track/instruments). Use Chrome, and allow the camera.

## What it does

[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) is Google's free library of small vision models that run in the browser, on your laptop, with no server and no key. The page sends each camera frame to a model and gets back numbers: 21 points on each hand, 478 points and 52 expression scores on a face, 33 points on a body. Those numbers become cues on the [stage](/docs/stage), the same stage the buttons, MIDI, and voice cues fire.

- **Hello World** (`/track`): three dashed zones on the picture. Put an index fingertip in a zone and its cue fires, once; take your hand out to re-arm. The top zone is "raise a hand."
- **Instruments** (`/track/instruments`):
  - **Hand fader**: fingertip height (0 at the bottom, 1 at the top) sets the stage's brightness, continuously.
  - **Pinch**: thumb to index finger fires a cue.
  - **Gestures**: thumbs up, thumbs down, open palm, fist, victory, pointing up, "I love you", each its own cue.
  - **Mouth open**: the face model's `jawOpen` score past a threshold fires a cue.
  - **Arms up**: both wrists above your nose fires a cue.

Every page shows **what the model sees** as numbers on the right. Watch them while you move: that's how you pick a threshold.

## Try it

1. Open [/track](/track). Pick your camera in the bar (the overhead camera, a webcam, your laptop's).
2. Click **Open the stage**: a second window. Drag it to the projector if there is one.
3. Raise a hand into the top zone. "Hello, world" appears on the stage. Touch the left zone (red) and the right zone (a ping).
4. Go to [/track/instruments](/track/instruments) and try each tab. For the fader, fire a picture first (open palm, in Gestures) so there's something to dim.

The first time a model loads it takes a few seconds (it downloads from Google's CDN, then the browser caches it).

## The one file to change: `app/track/cues.js`

```js
export const zones = [
  { name: "Raise a hand", x: 0, y: 0, w: 1, h: 0.2,
    cue: { id: "hello", label: "Hello, world", kind: "text", src: "Hello, world", options: { size: "12vw" } } },
  // ...
];
```

- `x, y, w, h` are fractions of the picture, from the top left of what you see (0 to 1). Add a zone, move one, make one tiny.
- `cue` is any stage cue: `sound`, `video`, `image`, `text`, `color`, `blackout`, `stop` (see [the stage](/docs/stage) or `lib/stage/README.md`). Use the samples in `/samples/` or your own files in the repo's `_media/` folder as `/media/your-file.mp4`.
- Below the zones, `instruments` sets what each instrument fires: the fader's `param` (`brightness`, `opacity`, `master` volume, `hue`), a cue per gesture, the mouth threshold.

Save and the page updates.

## How it works (if you want to go further)

| file | what's in it |
| --- | --- |
| `app/track/cues.js` | the zones and cues (change this) |
| `app/track/HelloTrack.jsx` | Hello World: fingertip in zone → `fireCue` |
| `lib/cv/instruments.js` | each instrument: result → numbers, on/off, fader value |
| `lib/cv/trigger.js` | debounce: fire once per gesture (hold 0.2 s, re-arm after 0.5 s) |
| `lib/cv/mediapipe.js` | loads the four models (hand, gesture, face, pose) from the CDN |
| `lib/cv/useCamera.js` | camera picker |

The model's points are normalized: `x` and `y` run 0 to 1 across the frame, so the same rule works at any camera resolution. Point numbers: on a hand, 0 is the wrist, 4 the thumb tip, 8 the index tip ([hand map](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)); on a body, 0 is the nose, 15 and 16 the wrists ([pose map](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)).

## Prompts for Claude Code

Open Claude Code in this repo and try one:

- "In `app/track/cues.js`, add a zone in each corner of the picture, each firing a different sample sound from `public/samples/`."
- "Add an instrument to `lib/cv/instruments.js` called `clap`: it fires when the two hands' wrists come within 0.1 of each other. Add its cue to `cues.js` and a tab for it."
- "Make a two-hand fader: the distance between my two index fingertips sets the stage's `master` volume."
- "Add a `smile` instrument using the face model's `mouthSmileLeft` and `mouthSmileRight` scores."
- "Make the hand's x position (left to right) set the stage's `hue` while its height sets `brightness`."
- "Count fingers held up (0–5) and fire a different cue for each number."

## When it doesn't work

- **"Camera permission was refused"**: click the camera icon in Chrome's address bar, allow, reload.
- **Black video**: another app (Zoom, Photo Booth, another tab) may hold the camera. Close it, or pick another camera.
- **"Couldn't load the model"**: the models come from the internet the first time. Check the Wi-Fi.
- **Nothing on the stage**: the stage window must be open in the same Chrome profile, on the same machine. The pill in the bar says "Stage open" when it hears one.
- **Points are on the wrong side**: uncheck or check **Mirror**. Mirror on for a selfie camera; off for an overhead or rear camera.
