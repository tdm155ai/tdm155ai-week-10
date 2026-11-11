# The stage contract

Every mechanic in this app (keys, buttons, MIDI, voice, tracking, draw-a-box) does one thing: **fire a cue**. The **stage** (`/stage`) is a black, full-screen window for the projector that plays it. Tabs on the same machine talk over a `BroadcastChannel` named `tdm155ai-stage`; there is no server and no setup.

```js
"use client";
import { fireCue, setParam, panic, openStage } from "../../lib/stage/stage.js"; // adjust the ../ to your file

openStage();                    // opens /stage in its own window (call from a click)
fireCue({ id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg" });
fireCue({ id: "wind", label: "Wind", kind: "sound", src: "/samples/wind.mp3", options: { fadeIn: 2, loop: true } });
setParam("opacity", 0.4);       // a dial or a hand height, 0–1
panic();                        // blackout and fade every sound
```

## The cue

`{ id, label, kind, src, options }`

| kind | src | options |
| --- | --- | --- |
| `sound` | audio URL | `volume` 0–1, `fadeIn`, `fadeOut` (s), `loop`. Sounds layer; the same id again restarts it. |
| `video` | video URL | `loop`, `muted` (default true), `volume`, `fit` (`cover`/`contain`), `fadeIn` |
| `image` | image URL | `fit`, `fadeIn` |
| `text` | the words (or `options.text`) | `color`, `background`, `size` (CSS, e.g. `"12vw"`), `font`, `fadeIn` |
| `color` | any CSS color or gradient | `fadeIn` |
| `blackout` | — | `fadeOut` (default 1): picture to black, sounds out |
| `stop` | — | `target` (a sound's id; omit for all), `fadeOut` |

Pictures (video, image, text, color) replace one another with a cross-fade (`fadeIn`, default 0.3 s). Sounds play on top.

## Other calls

- `setParam(name, value)`, value 0–1: `master` (volume of all sounds), `opacity`, `brightness` (of the picture), `hue` (rotates its colors).
- `onStage(callback)`: hear everything on the bus (cues, params, the stage's `status` replies); returns an unsubscribe function. `pingStage()` asks an open stage to answer with `{ type: "status" }`.
- `<Stage preview />` from `lib/stage/Stage.jsx` (with `import "../../lib/stage/stage.css"`): a small, silent copy of the stage to put on a control page.

## Media

- `/samples/...`: `nextjs/public/samples/` (generated tones, short videos, images; see its `LICENSE.md`).
- `/media/...`: the repo-root `_media/` folder, gitignored, for your own clips and sounds (`_media/clips/rain.mp4` is `/media/clips/rain.mp4`). Video seeks (Range requests).

## On the projector

Open `/stage`, drag the window to the projector, click once (that allows sound and goes full screen). `F` toggles full screen, `Esc` blacks out. Use Chrome. The stage and the tab firing cues must be in the same browser profile on the same machine.
