---
title: Inputs and outputs
description: "Every way into the stage and every thing it can do, in the order we'll try them: soundboard, MIDI, raw audio, words, meaning, tracking, boxes."
order: 1
---

Written with AI from Marlon's class direction (November 11, 2026). The order is a working sequence and may change during class; the last two may swap.

Every piece today is an **input** (something the computer notices) wired to an **output** (something that happens in the room). Try each input on its own first, with the simplest output. Then, in your group, combine them.

## The sequence

Each step has a **Hello World** (one short file, read it top to bottom, change the settings at the top) and a fuller version for the performance.

| # | Input | What the computer notices | Hello World | Fuller version | File to change |
| --- | --- | --- | --- | --- | --- |
| 1 | **Soundboard** (keys, buttons) | A key press or a click | [/launch/hello](/launch/hello) | [/launch](/launch), [/launch/cue-list](/launch/cue-list) | `app/launch/hello/Hello.jsx`, then `lib/launch/buttons.js` |
| 2 | **MIDI** (pads, keys, knobs) | A note (on/off) or a knob's value (0–127) | [/launch/midi](/launch/midi) | [/launch/xy](/launch/xy) | `lib/launch/midi-map.js` |
| 3 | **Raw audio signal** | The sound itself: how loud, which frequencies, moment to moment; no words yet | the level meter on [/voice](/voice) (press **Check**) | [/launch/spectrogram](/launch/spectrogram); mic loudness on [/launch/shader](/launch/shader) | `lib/launch/spectrogram/SpectrogramShell.jsx` |
| 4 | **Words** | The words someone said | [/voice/hello](/voice/hello) | [/voice](/voice), [/voice/script](/voice/script) | `app/voice/hello/Hello.jsx`, then `lib/voice/triggers.js`, `lib/voice/script.js` |
| 5 | **Meaning** | What someone is talking about, without magic words | — | [/voice/semantic](/voice/semantic) (OpenAI key) | `lib/voice/topics.js` |
| 6 | **Tracking** (live video) | Where hands, fingers, faces, and bodies are | [/track/hello](/track/hello) | [/track](/track), [/track/instruments](/track/instruments), [/track/zones](/track/zones), [/track/xy](/track/xy) | `app/track/hello/Hello.jsx`, then `app/track/cues.js` |
| 7 | **Boxes** (live video) | A drawn rectangle, a colored card, or printed markers on paper | [/draw-a-box/hello](/draw-a-box/hello) | [/draw-a-box](/draw-a-box) | `app/draw-a-box/hello/Hello.jsx`, then `app/draw-a-box/clips.js` |

All paths start in `nextjs/`. Each step has a guide: [launch](/docs/launch), [voice](/docs/voice), [track](/docs/track), [draw a box](/docs/draw-a-box).

**Raw audio, words, and meaning are three different levels** of the same microphone. Raw audio is the signal itself: loudness and pitch, which a clap or a hum can drive, with no understanding. Words need a speech recognizer (Chrome's, free, or OpenAI's). Meaning needs a language model reading the words. Each level is slower and less certain than the one before, and can do more.

**Raw audio, seen:** [/launch/spectrogram](/launch/spectrogram) is the Chrome Music Lab Spectrogram (Google Creative Lab, Apache 2.0), from the Lab's fork [ll-26-27/spectrogram-next](https://github.com/ll-26-27/spectrogram-next). Press the mic and sing, whistle, or clap: frequency over time, in 3D. Or play its instrument sounds, draw on it, or drag in a file. To add a sound button, copy a `music-box__buttons__button` block in `nextjs/lib/launch/spectrogram/SpectrogramShell.jsx` and point `data-src` at `/samples/...` or `/media/...`. It shows the signal but fires no cues. To make raw audio a trigger, ask Claude Code: *"Make a page where a clap (the mic getting loud fast) fires a stage cue, with a threshold slider and a meter. Use `lib/voice/mic.js` for the mic and `fireCue` from `lib/stage/stage.js`."*

## Inputs, by kind

- **Media files:** sounds, videos, pictures, and GIFs already on disk (`public/samples/`, `public/cv/`, or your own in `_media/`). They are the material outputs are made of, and a looping track can be the thing you play (the `_media/` source on [/launch/xy](/launch/xy)).
- **Live sound:** the microphone, at three levels: raw audio, words, meaning.
- **Live video:** the camera, read by two kinds of computer vision. **MediaPipe** finds landmarks on people: 21 points on each hand, the face, the body's pose. **OpenCV** finds shapes: boxes drawn in marker, colored cards, printed markers.
- **Keyboard and MIDI:** buttons that fire once (keys, pads, notes) and continuous controls that hold a value (knobs, faders, the joystick).
- **Sensors** (later, not today): distance, pressure, motion, light. The same idea: a value comes in, a cue goes out.

## Outputs, by kind

Everything goes to the [stage](/stage) through `fireCue` (do something once) or `setParam` (change something smoothly). [The stage guide](/docs/stage) has the details.

- **Audio:** play a sound, loop it, stop it.
- **Audio effects:** a filter sweep, resonance, echo (`setParam` `filter`, `resonance`, `echo`, `echoTime`; play with them on [/launch/xy](/launch/xy)).
- **Text:** words on the screen.
- **Pictures and video:** an image, a clip, a color wash, blackout. A video can be scrubbed, sped up, or paused (`setParam` `scrub`, `speed`, `play`).
- **Graphics:** [/launch/shader](/launch/shader), a fragment shader (a small program the GPU runs for every pixel) you play with sliders, the mouse, the mic's loudness, MIDI knobs, or the XY pad, with its code editable on the page (change `lib/launch/shader.js`). And [/track/three](/track/three), a Three.js 3D wave field you play with sliders, the mouse, or your hand (change `app/track/three/scene.js`).
- **Audio as picture:** [/launch/spectrogram](/launch/spectrogram) draws sound as frequency over time.

## Then combine them

A useful pattern: one input that **fires** (a word, a pad, a raised hand) and one that **steers** (a knob, a hand's height, the loudness). For example, the word "storm" starts the wind; a hand's height sweeps the filter on it. For combinations the Lab's fellows built this week (drums, finger pads, a gesture camera, a five-person air band), see [the fellows' experiments](/fellows). Plan your group's piece with [the worksheet](/perform), and find prompts for each step in [Prompts for Claude Code](/prompts).
