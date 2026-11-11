---
title: Cue list
description: Line up everything that happens, then press Go. The backbone of theater sound, video, and lighting.
---

**The maneuver:** a numbered list of cues, each one a thing that happens (a sound starts, a video fades up, the lights change). An operator watches the show and presses **Go** at the right moment; the playhead fires the next cue and moves down one. That's it, and it runs most theater in the world.

**Where you see it:** QLab (sound and video for theater), ETC Eos and grandMA3 (lighting), Millumin (video), stage managers' calling scripts.

## Unpacked

1. **A cue** = what (a file or a look), how (volume, fade time, loop), and a number or name.
2. **The list** is ordered. The **playhead** (a highlighted row) is the cue that fires on the next Go.
3. **Go** fires the cue at the playhead and advances. In QLab it's the space bar.
4. **Fades** are cues too: a "fade cue" targets another cue and changes its volume or opacity over time.
5. **Chaining:** a cue can *auto-continue* (fire the next one immediately) or *auto-follow* (fire it when this one finishes), so one Go can set off a sequence.
6. **Panic / stop all:** one key that fades everything out. Every show needs it.
7. **Standing by:** the operator can see what's next before pressing Go. The list is also the show's paperwork.

## Build it yourself

- A cue list is a JSON array; the playhead is an index; Go is `fireCue(list[i]); i++`. A student version fits in one file.
- Audio fades: the Web Audio API's `GainNode.gain.linearRampToValueAtTime`, or Tone.js / Howler.js if you want them done for you.
- Auto-continue: after firing, if `cue.continue === "auto"`, fire the next one; for auto-follow, wait for the media's `ended` event.
- Space bar as Go: a `keydown` listener. Guard against key repeat (`event.repeat`), or a held key fires the whole show.

**Where the pro tool wins:** QLab is tested in thousands of theaters, plays many audio outputs with precise timing (licensed), talks to lighting and sound desks over MIDI and OSC, and doesn't crash at 8 pm. Your browser cue list is perfect for a class performance and a rehearsal sketch; for a run of a show, stage managers trust QLab.

**Try it:** [/launch](/launch). The tool page: [QLab](/pro-apps/tools/qlab).
