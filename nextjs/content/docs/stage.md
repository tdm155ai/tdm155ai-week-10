---
title: The stage
description: One black window for the projector. Every button, pad, word, and gesture in this app fires a cue on it.
order: 1
---

**Open:** [/stage](/stage) in its own window. Use Chrome.

## What it does

Every mechanic this week does the same thing: it **fires a cue**. A cue is one moment of the show: a sound, a video, a picture, a line of text, a color, a blackout. The **stage** is the window that plays them: black, full screen, on the projector. The page you control it from (buttons, MIDI, voice, tracking) is a different tab or window on the same laptop, and the two talk to each other directly in the browser (a `BroadcastChannel`), with no server in between.

1. On any control page, press **Open stage window** (or open [/stage](/stage) yourself).
2. Drag that window onto the projector's screen.
3. **Click it once.** That lets it play sound and makes it full screen. `F` toggles full screen; `Esc` blacks out.
4. Go back to the control page and fire cues. The small preview there is silent; the sound comes from the stage window.

The **Panic** button on every control page (**Blackout** on the tracking pages) blacks out the picture and fades every sound.

## What a cue looks like

```js
{ id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg", options: { fadeIn: 1 } }
```

| kind | src | options |
| --- | --- | --- |
| `sound` | an audio file | `volume` (0–1), `fadeIn`, `fadeOut` (seconds), `loop` |
| `video` | a video file | `loop`, `muted` (true unless you say false), `volume`, `fit` (`cover` or `contain`), `fadeIn` |
| `image` | an image file | `fit`, `fadeIn` |
| `text` | the words | `color`, `background`, `size` (like `"10vw"`), `font`, `fadeIn` |
| `color` | a color (`"#ff6b57"`, `"crimson"`, a CSS gradient) | `fadeIn` |
| `blackout` | (none) | `fadeOut`: picture to black, sounds out |
| `stop` | (none) | `target` (a sound's id; leave out for all sounds), `fadeOut` |

Pictures replace each other with a cross-fade; sounds play on top of whatever is showing, and several can play at once.

Four **continuous controls** go from 0 to 1 and are what a dial, a slider, or a hand's height should move: `master` (the volume of every sound), `opacity` and `brightness` (of the picture), and `hue` (shifts its colors).

## Your own media

- `/samples/...` are small files made for this class (tones, wind, a chord, three short generated videos, a few pictures), in `nextjs/public/samples/`. Use them freely.
- Put your own files in the **`_media/`** folder at the top of the repo (next to `nextjs/`). `_media/clips/rain.mp4` plays as `/media/clips/rain.mp4`. That folder is never committed, so your clips stay on your machine (and don't put copyrighted media in the repo).

## Fire a cue from your own page

```js
"use client";
import { fireCue, setParam, panic, openStage } from "../../lib/stage/stage.js";

fireCue({ id: "rain", label: "Rain", kind: "video", src: "/media/rain.mp4", options: { loop: true } });
setParam("opacity", 0.5);
```

The contract for builders is in `nextjs/lib/stage/README.md`.

## Ask Claude Code

> Read `nextjs/lib/stage/README.md` and `nextjs/lib/stage/Stage.jsx`. Add a new cue kind, `split`, that shows two images side by side on the stage, and add a button for it in `nextjs/lib/launch/buttons.js`. Keep the change small and tell me how to test it.

> Make the stage play sounds through Web Audio instead of `<audio>` elements so a `pan` option (-1 left to 1 right) can place a sound in the room.
