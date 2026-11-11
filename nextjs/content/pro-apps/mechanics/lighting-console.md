---
title: Lighting console
description: Record looks (levels, colors, positions) as cues and play them back. The light board, and the protocol called DMX.
---

**The maneuver:** a lighting programmer patches every fixture to an address, builds a "look" by setting levels and colors, records it as a cue, and builds the next. In performance the board operator presses Go and the console crossfades from one look to the next over the cue's time. Moving lights, color, and effects are all just more numbers in the look.

**Where you see it:** ETC Eos family (most American theater), grandMA3 (most concerts and touring), and their free offline editors (ETCnomad, grandMA3 onPC) you can practice on with no hardware.

## Unpacked

1. **Patch:** each light gets a channel number and a DMX address. DMX is the cable protocol: 512 channels per "universe", each a value 0–255. Over a network it's Art-Net or sACN.
2. **Select and set:** on Eos, typed like a sentence: `Chan 1 Thru 10 At Full Enter`.
3. **Record:** `Record Cue 1 Enter` saves the look.
4. **Timing:** each cue has a fade time (up and down), so Go is a crossfade, not a snap.
5. **Go / Back:** the same cue-list logic as QLab, applied to light.
6. **Faders and executors:** physical sliders for live control (busking a concert) instead of a fixed list.

## Build it yourself

- **On screen:** a "light" is a colored full-screen div or a grid of colored cells. A look is an object `{ hue, brightness }`; a cue crossfades between looks with `requestAnimationFrame`. Your projector *is* a light.
- **Faders:** MIDI dials and sliders through Web MIDI, mapped with `setParam("brightness", value)`.
- **Real lights (beyond today):** a USB-DMX interface plus Web Serial from Chrome, or a tiny Node server with the `dmx` or `artnet` npm packages sending to an Art-Net node. Addressable LED strips over Web Serial to an Arduino or Pico are the cousin of this (see the LED corner of the room, and Marlon's point that hardware is where AI's multiplier is smallest).

**Where the pro tool wins:** this is the clearest case. A console drives hundreds of fixtures with thousands of parameters, tracking, palettes, and a hardware surface designed for a programmer working fast in the dark. It's also safety-critical: the stage must not go black by accident. A MIDI pad and a browser are a cheap, honest board for a small piece.

**Try it:** [/launch](/launch) with the Akai MPK's dials. Tool page: [ETC Eos and grandMA3](/pro-apps/tools/eos-grandma). Watch a programmer at work: [inspiration](/inspiration).
