---
title: ETC Eos and grandMA3
description: The two lighting consoles that run most theater (Eos) and most concerts (grandMA3), and their free offline software. Mechanic: lighting console.
---

**What they are:** professional lighting consoles. A programmer **patches** every fixture to a DMX address, builds **looks**, records them as **cues**, and the operator plays them back with **Go**. ETC (Electronic Theatre Controls) makes the **Eos** family (Apex, Ti, Ion Xe, Element): keypad and command-line driven, built around channels and cue lists, dominant in theater and on Broadway. MA Lighting (Germany) makes **grandMA3**: built around fixtures, groups, presets, sequences, and **executors** (playback faders), dominant on concerts, tours, and TV. Mechanic: [lighting console](/pro-apps/mechanics/lighting-console).

**Cost (checked Nov 11, 2026):** both have **free software you can program on**:
- ETC: "The Eos software is always free to download and use on Mac and PC" ([ETCnomad](https://www.etcconnect.com/ETCnomad/)). Without a USB key it runs Offline (program and save, no DMX out); the ETCnomad key turns a laptop into a real console.
- MA: grandMA3 onPC is free "without any restrictions… the same as the grandMA3 console software" ([MA](https://www.malighting.com/special/grandma3-onpc/)); output to real lights needs MA hardware.
- Console prices: not checked (they're five to six figures).

## The maneuver, unpacked (Eos)

1. **Patch:** `Chan 1 Thru 10 Address 1 Enter`, choosing each fixture type from the library.
2. **Set levels:** `Chan 1 Thru 10 At Full`, or `Group 2 At 80 Enter`.
3. Color, focus, and beam with the **encoders**.
4. **Record:** `Record Cue 1 Enter` (default time 5 seconds).
5. Next look: `Record Cue 2 Time 8 Enter`.
6. **Playback:** the stage manager calls "Lights 12… GO" and the board operator presses **Go**.

**On grandMA3:** patch fixtures → store **groups** → store **presets** (a color, a position) → build a look from them → `Store Cue 1` into a **sequence** → put the sequence on an **executor** → Go, or let **timecode** fire every cue in time with the music.

## Watch

- [07.1 Record a Cue](https://www.youtube.com/watch?v=c2SN7M4Ow_M) (ETC, official, 1:53) and [08.1 Basic Playback](https://www.youtube.com/watch?v=mWLwuQree0o) (ETC, 2:01): Go, Stop/Back, manual control.
- [ETCnomad System Overview](https://www.youtube.com/watch?v=yDHdqxGvvGQ) (ETC, 21:11). 0:20 downloading the free software · 6:23 Offline mode · 7:49 a cueing exercise. **The free route for students.**
- [MAking of – Ed Sheeran Mathematics Tour | Interview with Mark Cunniffe and Matt Jones](https://www.youtube.com/watch?v=hEMQ9fZnbTU) (MA Lighting, official, 17:12): a stadium tour's lighting designer and director. ~6:41 "it's a live show"; ~15:21 "there is no greater feeling than being stood behind a lighting desk when the house lights go off."
- [MAking of – Eurovision Song Contest 2024 | The grandMA3 System](https://www.youtube.com/watch?v=Wi0wEcMD2dQ) (MA Lighting, 9:40). ~1:32 eleven consoles; ~3:01 several programmers in one show file.
- [MA3 onPC: The 40min Crash Course!](https://www.youtube.com/watch?v=7VD3ZcEq1wo) (Jonathan D. Martin, third-party, 40:02): patch to timecode in one sitting (no chapters).

Checked Nov 11, 2026; timestamps from captions, approximate. More programmers at work: [inspiration](/inspiration#a-lighting-programmer-at-the-console).

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-board/page.jsx: a tiny
lighting console where the projector is the light.
- "Channels": 8 on-screen faders (also the Akai MPK's 8 dials, Web MIDI) for
  intensity, hue, saturation, and five colored "lamps" drawn as soft circles on the
  stage window.
- A command line that understands "chan 1 thru 4 at 50", "record cue 3 time 4",
  and "go".
- Recorded cues go in a list; Go crossfades from the current look to the next over
  the cue's time (requestAnimationFrame). Back goes to the previous cue.
- Send the look to the stage with fireCue (kind "color") and setParam("brightness").
```

**Could you replace it?** No, not for real lighting: hundreds of fixtures, tracking, palettes, and safety-critical playback are the console's job. But download the free Eos or grandMA3 software and you're learning the real thing for nothing; and a MIDI controller plus the projector is an honest little board for a class piece.
