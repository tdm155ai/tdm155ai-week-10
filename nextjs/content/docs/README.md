---
title: Docs
description: How each part of this week's app works, the one file to change, and prompts to try with Claude Code.
order: 0
---

Every guide follows the same pattern: what the page does, **the one file to change**, and a few prompts to paste into Claude Code when you want to go further. Open the [stage](/stage) first; everything else fires cues on it. For the whole map of inputs and outputs, in the order we'll try them, see [inputs and outputs](/repertoire).

| Guide | Open | The file to change |
| --- | --- | --- |
| [The stage](/docs/stage) | [/stage](/stage) | your media in `_media/`, served at `/media/...` |
| [Launch: buttons, keys, MIDI, cue list, XY pad](/docs/launch) | [/launch/hello](/launch/hello), [/launch](/launch) | `nextjs/app/launch/hello/Hello.jsx`, then `nextjs/lib/launch/buttons.js`, `midi-map.js`, `cue-list.json`, `loop.js`, `shader.js`, `spectrogram/SpectrogramShell.jsx` |
| [Voice cues](/docs/voice) | [/voice/hello](/voice/hello), [/voice](/voice) | `nextjs/app/voice/hello/Hello.jsx`, then `nextjs/lib/voice/triggers.js`, `script.js`, `topics.js` |
| [Track (MediaPipe)](/docs/track) | [/track/hello](/track/hello), [/track](/track) | `nextjs/app/track/hello/Hello.jsx`, then `nextjs/app/track/cues.js`; `three/scene.js` for 3D |
| [Draw a box](/docs/draw-a-box) | [/draw-a-box/hello](/draw-a-box/hello), [/draw-a-box](/draw-a-box) | `nextjs/app/draw-a-box/hello/Hello.jsx`, then `nextjs/app/draw-a-box/clips.js` |

New to the repo? The [home page](/) has the first hour in order. To run it, see the [repo setup](https://github.com/tdm155ai/tdm155ai-week-10#run-it).
