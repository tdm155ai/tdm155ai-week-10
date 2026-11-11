---
title: QLab
description: Figure 53's cue-list app for theater sound, video, and lighting. The one TDM students already use. Mechanic: cue list.
---

**What it is:** QLab is "sound, video, and lighting control for macOS" (Figure 53's words). A show is a **cue list**; the operator presses **GO** (the space bar) and the next cue fires. It is the standard playback tool in theater sound departments. **Mac only.** Mechanic: [cue list](/pro-apps/mechanics/cue-list).

**Cost (checked Nov 11, 2026, [qlab.app/shop](https://qlab.app/shop/)):** free to download and use, with Audio, Video and Lighting cues and unlimited cue lists, but limited to 2 audio output channels, 1 single-output video stage, and 16 DMX addresses; Network, MIDI, Script and Timecode cues need a license. Licenses: $599 / $1,099 / $1,399 for one, two, or all three feature sets, or rent by the day ($8–15). [Educational pricing](https://qlab.app/educational-pricing/): $479–1,119, or $6–12 a day.

## The maneuver, unpacked

1. New workspace: it opens with an empty cue list. Show the **Inspector** (View menu).
2. **Drag audio or video files into the list.** Each becomes an Audio or Video cue with its target set. A cue with no target shows an ✕ ("broken").
3. Add a **Fade cue** aimed at another cue: what to fade (level; for video, opacity, scale, or effects), how long, and its curve. A fade is its own cue because the operator, not the file, decides when it happens.
4. **Chain cues** with the Continue setting: **auto-continue** fires the next cue at the same time; **auto-follow** fires it when this one ends (pre-show music).
5. **Group cues** fire together; a timeline group runs several fades with different curves at once.
6. Select the top cue and press **GO**. The playhead moves to the next cue on standby; *Active Cues* shows what's running.

## Watch

- [Qlab Tutorial | Basics Episode 1 "First Steps"](https://www.youtube.com/watch?v=a9t91hAXs0o) (Qlab Tutorial, 7:52; QLab 4, same ideas). ~4:00 drag a file in; ~5:00 select and GO; **~6:00–7:00 the key idea: a cue list is not iTunes; nothing plays until you GO.**
- [Qlab Tutorial | Basics Episode 2 "Pre Show Loops & Auto Follows"](https://www.youtube.com/watch?v=a3v5xfDPe9w) (Qlab Tutorial, 3:49). ~2:00 auto-continue fires everything at once; ~3:00 auto-follow plays one song after another. The clearest short demo of the difference.
- [Exploring the Fade Cue in QLab 5](https://www.youtube.com/watch?v=tPlRyKKG4TQ) (Figure 53, official, 10:41). ~1:41 why a fade is its own cue; ~2:40 fading video opacity, scale and position; ~8:42 timeline groups.

Checked Nov 11, 2026 against YouTube's metadata and transcripts; timestamps approximate. There's no QLab "show reel": it's invisible infrastructure.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md (the stage contract: fireCue, panic, openStage).
Build a new page at nextjs/app/my-cues/page.jsx: a QLab-style cue list.
- Cues come from a JSON array at the top of the file: number, label, kind, src, options,
  and continue: "none" | "auto-continue" | "auto-follow".
- Show the list with the playhead row highlighted and the next cue "standing by".
- Space bar = GO: fire the cue at the playhead with fireCue, advance the playhead.
  Ignore key repeat. Esc = panic(). Up/down arrows move the playhead without firing.
- auto-continue fires the next cue right away; auto-follow fires it when this cue's
  media ends (or after options.duration seconds for text/color cues).
- Add a fade cue kind that fades a running sound over N seconds (use the stage's stop
  kind with fadeOut, or setParam("master")).
- A button to open the stage window.
Use the samples in nextjs/public/samples/. Keep it one file I can read.
```

**Could you replace it?** For a class piece, yes. For a run of a show, keep QLab and have your app talk to it (QLab listens for MIDI and OSC with a license).
