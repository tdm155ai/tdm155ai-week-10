---
title: Installations and Live Events
description: TDM 155AI · Make something happen in the room.
---

Make a cue happen: a sound, a picture, a color, a few words. Then give it a trigger—a key, a pad, a spoken word, or a hand in the camera. Everything sends cues to the same [stage](/stage), a separate window you can put on a projector.

## Start here: your first hour

**The map: [inputs and outputs](/repertoire).** Soundboard → MIDI → raw audio → words → meaning → tracking → boxes, each with a Hello World and the file to change.

Run this repo locally and open **http://localhost:3000 in Chrome**. The [repo setup](https://github.com/tdm155ai/tdm155ai-week-10#run-it) has the commands. Work at your own computer. For each experiment, make it work once, change the small file named below, and try your change.

1. **[Click a button, press a key](/launch).** Click a cue, then press `1`–`9`; `Space` runs the next cue. Change one label or picture in `nextjs/lib/launch/buttons.js`. [How it works](/docs/launch).
2. **[Hit a MIDI pad](/launch/midi).** Connect a controller, click **Connect MIDI**, and hit a pad. Use **Learn** to assign it. No controller? The on-screen pads and dials use the same mapping. Change `nextjs/lib/launch/midi-map.js`.
3. **[Say a word](/voice).** Start listening and say “moon” or “hello world.” Or type a line to try the matcher without a mic. Give your own word a cue in `nextjs/lib/voice/triggers.js`. [Voice guide](/docs/voice).
4. **[Raise a hand](/track).** Allow the camera and put an index fingertip in the top zone. Change its words or move the zone in `nextjs/app/track/cues.js`. [Tracking guide](/docs/track).

**See it in the room:** open [Stage ↗](/stage) in a separate window, click it once to enable sound, then return to a controller tab to fire cues. Keep both windows in the same Chrome profile on the same computer. Drag the stage to the projector when you're ready. [Stage setup and blackout](/docs/stage).

Camera and mic ask for permission. Web Speech and the first vision-model download need internet. Stop the listener or camera when you finish that experiment. These four starts use no model API key; the optional voice experiments that call a model need an OpenAI or OpenRouter key and incur API charges.

## Then make a short live performance

Use the [group worksheet](/perform): roles, a cue sheet, rehearsal checklist. In a group, combine **keys, buttons, or MIDI** with **voice-triggered cues**. Choose a reader or performer, a cue operator, and an audience's position in the room. Build a short sequence you can rehearse, including a manual backup and a blackout.

- **[Follow a sonnet](/voice/script):** cues marked into a script, with a simulated reader and a manual Go button. Change `nextjs/lib/voice/script.js`.
- **[Run a cue list](/launch/cue-list):** a numbered sequence with Go, back, skip, and panic. Change `nextjs/lib/launch/cue-list.json`.
- **[Try more tracking instruments](/track/instruments):** a hand fader, pinch, gestures, face, and pose.
- **[Draw a box](/draw-a-box):** under an overhead camera, draw a dark rectangle and put a clip inside it; pick the clip with a word, a button, or keys `1`–`5`. [Setup and tuning](/docs/draw-a-box).

The physical stations are **MediaPipe**, **button launching**, and **printing buttons**. MediaPipe and button launching are separate rotations. Printing buttons is a physical making station in the room.

## Look at the shows and tools

- **[The fellows' experiments](/fellows):** hand drums, finger sounds, a gesture camera, a five-person air band, and shader trails, built with Claude Code this week: each one's input, output, and file to change.
- **[Inspiration](/inspiration):** concert and theater clips, [examples](/inspiration/examples), and [case studies](/inspiration/case-studies) that break a show into maneuvers.
- **[Pro apps](/pro-apps):** QLab, TouchDesigner, Isadora, and more: what they do and what a small browser version could do.
- **[Build it yourself](/pro-apps/build-it-yourself):** professional app → browser libraries and an approach to building the maneuver.
- **[Prompts for Claude Code](/prompts):** paste-in prompts for each mechanic and for your group's piece, each naming the file it changes.
- **[All guides](/docs):** setup, the small file to change, and prompts to extend each mechanic.

## Further voice experiments

After the first four starts, [compare speech engines](/voice/compare) or [let topics trigger cues](/voice/semantic). Comparing engines uses OpenAI and needs a key in the repo-root `.env`; topic cues go through OpenRouter and need `OPENROUTER_API_KEY` in `nextjs/.env.local`. Keep the basic word trigger and manual cue controls available for your performance.
