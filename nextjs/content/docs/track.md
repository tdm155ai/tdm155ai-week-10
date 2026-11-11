---
title: Track (MediaPipe)
order: 4
description: Your hands, face, and body as a controller. Raise a hand and a cue fires on the stage.
---

**Open:** [/track/hello](/track/hello) (Hello World), then [/track](/track), [/track/instruments](/track/instruments), [/track/zones](/track/zones), [/track/xy](/track/xy), and [/track/three](/track/three). Use Chrome, and allow the camera.

## What it does

[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) is Google's free library of small vision models that run in the browser, on your laptop, with no server and no key. The page sends each camera frame to a model and gets back numbers: 21 points on each hand, 478 points and 52 expression scores on a face, 33 points on a body. Those numbers become cues on the [stage](/docs/stage), the same stage the buttons, MIDI, and voice cues fire.

- **Hello World** (`/track/hello`): one file, `app/track/hello/Hello.jsx`. A line across the picture; lift your index fingertip above it and one cue fires; lower your hand to re-arm. Change `LINE` (0 top, 1 bottom), `CUE`, and `COLOR` at the top.
- **Zones** (`/track`): three dashed zones on the picture. Put an index fingertip in a zone and its cue fires, once; take your hand out to re-arm. The top zone is "raise a hand."
- **Instruments** (`/track/instruments`):
  - **Hand fader**: fingertip height (0 at the bottom, 1 at the top) sets the stage's brightness, continuously.
  - **Pinch**: thumb to index finger fires a cue.
  - **Gestures**: thumbs up, thumbs down, open palm, fist, victory, pointing up, "I love you", each its own cue.
  - **Mouth open**: the face model's `jawOpen` score past a threshold fires a cue.
  - **Arms up**: both wrists above your nose fires a cue.
  - **Scrub a video**: fingertip left–right is the position in the stage's video; a pinch plays it on. The clip goes up when you pick the tab.
- **Body zones** (`/track/zones`): the picture is split into columns (up to four people, from the pose model). Step into a column and its sound fires once; it stays lit while someone is in it. The columns and sounds are `bodyZones` in `app/track/cues.js`.
- **XY pad** (`/track/xy`): your palm is the finger on the [XY pad](/docs/launch): it sweeps a filter and echo over a loop.
- **Three.js** (`/track/three`): a 3D field of 1,600 glowing blocks with a wave running out from the middle, an **output** to play rather than an input. No camera needed: sliders for speed, wave height, ripples, color, and spin; drag to orbit, scroll to zoom, `F` full screen, `Space` pause. Tick **Use my hand** and your fingertip spins the field (left–right) and lifts the wave (up–down); a pinch sends a ring-shaped pulse out. **The one file to change:** `app/track/three/scene.js`: `controls` is the list of sliders, `fromHand()` what the hand does, `makeScene()` what's in the world (its `update(seconds, values, hand)` runs every frame). The chain is input → parameter → picture: a slider or your hand sets `values`, which set each block's height and color.

Every page shows **what the model sees** as numbers on the right. Watch them while you move: that's how you pick a threshold.

## Try it

1. Start with [/track/hello](/track/hello), then open [/track](/track). Pick your camera in the bar (the overhead camera, a webcam, your laptop's).
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
| `lib/cv/trigger.js` | debounce: fire once per gesture (held about 0.1–0.2 s, re-armed after about half a second; the numbers are set in `HelloTrack.jsx` and `instruments/Instruments.jsx`) |
| `lib/cv/mediapipe.js` | loads the four models (hand, gesture, face, pose) from the CDN |
| `lib/cv/useCamera.js` | camera picker |

The model's points are normalized: `x` and `y` run 0 to 1 across the frame, so the same rule works at any camera resolution. Point numbers: on a hand, 0 is the wrist, 4 the thumb tip, 8 the index tip ([hand map](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)); on a body, 0 is the nose, 15 and 16 the wrists ([pose map](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)).

## Prompts for Claude Code

Open Claude Code in this repo and try one:

- "In `app/track/three/scene.js`, make the blocks spheres, and make a pinch change their color."
- "On /track/three, make the wave start where my hand is instead of in the middle, and fire a stage cue when the wave height goes over 3."

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
