---
title: Launch (buttons, keys, MIDI, cue list)
description: Fire cues with on-screen buttons, your keyboard, a MIDI pad controller, or a Go button running down a cue list.
order: 2
---

**Open:** [/launch/hello](/launch/hello) (Hello World), then [/launch](/launch), [/launch/midi](/launch/midi), [/launch/cue-list](/launch/cue-list), and [/launch/xy](/launch/xy). Use Chrome. Open the [stage](/docs/stage) first.

## 0. Hello World: one key, one cue

[/launch/hello](/launch/hello) is the whole idea in one short file: press `h` (or click the button) and "Hello, world" comes up on the stage. Read `nextjs/app/launch/hello/Hello.jsx` top to bottom, then change `KEY` and `CUE` at the top; the other cues to try are listed under them.

## 1. Buttons and keys

Nine buttons, each a cue. Click one or press its key (`1`–`9`). **Space is Go**: it fires the button with the dashed outline and moves on to the next, so you can run the whole set in order with one key.

**The one file to change:** `nextjs/lib/launch/buttons.js`. Each line is a button:

```js
{ key: "3", id: "dawn", label: "Dawn", kind: "image", src: "/samples/dawn.jpg", options: { fadeIn: 1.5 } },
```

Change a label, swap `src` for one of your own files (`/media/...`, see [the stage](/docs/stage)), add a line with `key: "q"`. Save, and the page updates.

## 2. A MIDI controller as a lighting board

A drum pad or a little keyboard controller (an Akai MPK mini: 25 keys, 8 pads, 8 dials) costs a fraction of a lighting console, and Chrome can read it directly over USB with **Web MIDI**: no driver, no app.

1. Plug the controller in, press **Connect MIDI**, and allow MIDI when Chrome asks. Your device's name appears.
2. Watch the **monitor**. Every pad, key, and dial sends a message: a pad or key is a **note** (a number, plus how hard you hit it, 0–127); a dial or slider is a **CC** (control change: a number, plus where the dial is, 0–127). This is the whole language.
3. **Pads → cues.** An MPK mini's eight pads (bank A, notes 36–43) already fire buttons 1–8. Button 9, the blackout, is on note 44: the on-screen pad marked 44 (each pad shows its note and cue), or press `9` (or use **Learn** to put it on a pad). To change one, press **Learn** next to a cue, then hit a pad. Harder hits play sounds louder.
4. **Dials → the stage.** Knobs 1–4 of an MPK mini (CC 70–73) are volume, picture opacity, brightness, and hue. Knobs 5–6 (CC 74–75) scrub and speed the stage's video. Press **Learn** next to one and turn a dial to reassign it. The MPK's joystick is a DJ filter: left muffles, right thins; up adds resonance.
5. **Keep it.** What you learn is remembered in this browser. **Copy as code** and paste it into `nextjs/lib/launch/midi-map.js` to keep it in the project.

No controller? The **on-screen pads** (notes 36–51, like a 4×4 drum pad) and **knobs** (CC 70–77) send the same messages.

**The one file to change:** `nextjs/lib/launch/midi-map.js`.

## 3. The cue list (Go)

This is how a theater runs a show, and what QLab does: every moment is a numbered cue, in order. The highlighted cue is **standing by**; the operator presses **Go** on the stage manager's call, and the next cue stands by.

- `Space` or the green button: **Go**.
- `↑` / `Backspace`: back one (without firing). `↓`: skip one. Click a row to stand by on it.
- `Esc` or **Panic**: blackout.

The list is `nextjs/lib/launch/cue-list.json`, a cue list for reading Sonnet 18. Edit it in the file (or on the page with **Edit here**, then **Download JSON** and replace the file).

**The one file to change:** `nextjs/lib/launch/cue-list.json`.

## 4. The XY pad (filter and echo)

[/launch/xy](/launch/xy) is a Kaoss pad: drag across a square to sweep effects over an EDM loop made in the browser. In **Filter** mode left–right is the filter (low-pass, off in the middle, high-pass) and up adds resonance; in **Echo** mode left–right is the echo's time and up is how much; **Filter + echo** puts the filter across and the echo up. Turn the loop's parts on and off by click, key, or pad; switch between springing back and holding. Click the step grid to change the pattern, then **Copy pattern as code** and paste it over `PATTERN` in `nextjs/lib/launch/loop.js` to keep it. A track of your own in `_media/` can be the source instead. **Hands (camera)** makes your palm the finger on the pad; [/track/xy](/track/xy) is the same pad under tracking.

**The one file to change:** `nextjs/lib/launch/loop.js` (tempo, chords, the 16-step patterns).

## Ask Claude Code

> On /launch/cue-list, add a "pre-wait" and an "auto-continue" option to cues in `nextjs/lib/launch/cue-list.json`, the way QLab does: a cue can wait a few seconds before it fires, and can fire the next cue by itself when it's done. Show both in the list.

> In `nextjs/lib/launch/MidiBoard.jsx`, make the piano keys of my MIDI keyboard play notes through the stage (a simple Web Audio synth), while the pads keep firing cues.

> Make /launch/cue-list advance when a MIDI pad is hit, so a performer can run the show from a drum pad on the floor.
