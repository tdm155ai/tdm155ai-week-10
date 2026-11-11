---
title: Pro apps
description: The professional show apps used in theater, concerts, and installations, what each one's maneuver is, and which ones you could build yourself with Claude Code.
---

TDM students often run shows in QLab. Lighting designers program ETC Eos or grandMA. VJs play Resolume; installation artists patch TouchDesigner or Isadora; stadium tours run on disguise. Each of these is a particular arrangement of a few **mechanics**. Today's question: which of those mechanics can you build yourself, in a browser, with Claude Code, and where do the pro tools still win?

- **[Mechanics](/pro-apps/mechanics):** the eight maneuvers (cue list, node graph, clip launching, projection mapping, lighting console, media server, MIDI control, sensor triggers), each unpacked step by step.
- **[Tools](/pro-apps/tools):** one page per app, with videos to watch and a prompt to build its maneuver in 20 minutes.
- **[Build it yourself](/pro-apps/build-it-yourself):** the industry standard next to the browser libraries and strategies you'd use instead.
- **[Inspiration](/inspiration):** concerts, shows, and case studies that use these tools.

## The table, by mechanic

Prices and free versions were checked on the makers' sites on November 11, 2026. Routes in the last column are this app's.

| Mechanic | App | Maker · cost | The maneuver in one sentence | Build a version today? | Here |
| --- | --- | --- | --- | --- | --- |
| [Cue list](/pro-apps/mechanics/cue-list) | [QLab](/pro-apps/tools/qlab) | Figure 53 · free (2 audio outputs, 1 video stage); $599–1,399 or $8–15/day; Mac only | Drop media into a numbered list, set fades and follows, press GO for each moment. | **Yes:** a JSON list, a playhead, and the space bar | [/launch](/launch), [/voice](/voice) |
| [Node graph](/pro-apps/mechanics/node-graph) | [TouchDesigner](/pro-apps/tools/touchdesigner) | Derivative · free non-commercial (1280px cap); $300 edu | Wire operators (images, numbers, 3D, text) into a live network that renders. | **Partly:** one patch, not the studio | [/track](/track) |
| | [Isadora](/pro-apps/tools/isadora) | TroikaTronix · demo works except saving; $199/yr, $17.50/week | Patch actors into scenes, then step through scenes like cues; sensors can advance them. | **Yes**, its core: camera or mic drives cues | [/track](/track), [/voice](/voice) |
| | [Max/MSP](/pro-apps/tools/max) | Cycling '74 · 30-day demo, then no saving; $399 | Objects joined by patch cords make music, sound, and video logic. | **Partly:** any one patch, as code | |
| [Clip launching](/pro-apps/mechanics/clip-launching) | [Resolume](/pro-apps/tools/resolume) | Resolume · unlimited watermarked demo; €299/€799 | Fire a grid of video clips live, in time with the beat, layered and mapped. | **Partly:** grid, pads, quantize; not 60 fps HD layers | [/launch](/launch) |
| | [Ableton Live](/pro-apps/tools/ableton-live) | Ableton · 30-day trial; Lite free with many controllers; $99–749 | Launch loops and scenes from a grid; quantized to the bar. | **Partly:** a Tone.js grid | [/launch](/launch) |
| [Projection mapping](/pro-apps/mechanics/projection-mapping) | [MadMapper](/pro-apps/tools/madmapper) | GarageCube + 1024 architecture · free, watermarked; €479 | Draw a quad, drag its corners onto the object, assign media. | **Partly:** four-corner warps on one projector | [/stage](/stage) |
| | [Millumin](/pro-apps/tools/millumin) | (maker not verified) · 30-day trial; from $499; Mac only | A theater dashboard of layers × cues, each layer warped to the set. | **Partly** | [/stage](/stage) |
| [Lighting console](/pro-apps/mechanics/lighting-console) | [ETC Eos, grandMA3](/pro-apps/tools/eos-grandma) | ETC; MA Lighting · free offline software; consoles are hardware | Patch fixtures, build a look, Record Cue, press Go. | **No** for real lights; a projector "board" yes | [/launch](/launch) + MIDI dials |
| [Media server](/pro-apps/mechanics/media-server) | [disguise, Notch](/pro-apps/tools/disguise-notch) | disguise; Notch · Designer Starter free; Notch 60-day trial | Map content onto a 3D model of the stage; play it in sync, with live real-time graphics. | **No:** previs and shaders only | |
| [MIDI control](/pro-apps/mechanics/midi-control) | all of the above | controllers ~$100 | Bind pads, keys, and dials to anything. | **Yes**: Web MIDI in Chrome | [/launch](/launch) |
| [Sensor triggers](/pro-apps/mechanics/sensor-triggers) | Isadora, TouchDesigner | | The performer fires the cue: a word, a hand, a drawn box. | **Yes**: the browser's strongest case | [/voice](/voice), [/track](/track), [/draw-a-box](/draw-a-box) |

## Which ones could you replace? (for discussion)

Go down the table and argue it. A few prompts:

- **QLab is the easiest to rebuild and the hardest to replace.** A browser cue list takes twenty minutes. A stage manager trusting it for eight shows a week takes years: reliability, sample-accurate timing, 16 audio outputs, and a whole profession that already knows it. What would your version need before you'd run a real show on it?
- **Where you beat the pros:** triggers. A sonnet's words, a hand above the head, a box drawn on paper. Isadora and TouchDesigner can do this, but a browser with MediaPipe and a transcription model, wired by Claude, gets you there fastest, and shaped exactly to your piece.
- **Where the pros clearly win:** lighting consoles (DMX hardware, hundreds of fixtures, safety), media servers (synced 4K outputs, timecode, backup servers), and anything show-critical. Same lesson as the LED strips in the corner: Claude's multiplier is biggest in the browser and smallest where hardware is involved.
- **The professional answer is often both:** QLab runs the show, and your app sends it a MIDI or OSC message when the dancer raises her hand. Every app on this list listens to MIDI.
- **Learning the real thing is cheap:** QLab, TouchDesigner, the Eos and grandMA3 software, MadMapper, and disguise Starter are all free to try. Building a version teaches you the mechanic; opening the real one teaches you the profession's vocabulary.
