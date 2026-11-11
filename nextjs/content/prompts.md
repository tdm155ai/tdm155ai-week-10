---
title: Prompts for Claude Code
description: Paste one into Claude Code in this repo, then test it on the page. Each names the file it changes.
order: 5
---

If a prompt goes sideways, say what you saw and ask Claude Code to undo it.

## How to use these

1. Open a terminal in the repo (the folder with `nextjs/` in it) and start `claude`.
2. Keep the page open in Chrome at http://localhost:3000 and the [stage](/stage) in another window. When Claude Code saves a file, the page updates by itself.
3. Paste a prompt. Add what you want in your own words: your words, your sounds, your timing.
4. Try it. Then ask: "What did you change, and in which files?" If it works, commit it (`git add` the files it named, then `git commit`).

Your own sounds, pictures, and clips go in the `_media/` folder at the top of the repo; `_media/rain.mp4` plays as `/media/rain.mp4`. It's never committed. The built-in samples are in `nextjs/public/samples/` (beep-a, chord, ping, thump, wind, gradient, fractal, life, dawn, moon, sun, rose).

## Warm-ups: change the one file (5 minutes)

> In `nextjs/lib/launch/buttons.js`, replace the labels and sounds of buttons 1–3 with these: [your three cues]. Keep the keys the same.

> In `nextjs/lib/voice/triggers.js`, add three trigger words: "storm" plays `/samples/wind.mp3` looping, "flash" turns the stage white, and "calm" fades everything out. Tell me how to test them by typing instead of talking.

> In `nextjs/app/track/cues.js`, add a zone in each bottom corner of the picture, each firing a different sample sound from `nextjs/public/samples/`.

> In `nextjs/app/draw-a-box/clips.js`, add three clips from my `_media/` folder with the words "ocean", "city", and "night".

> In `nextjs/lib/launch/cue-list.json`, write a new ten-cue list for [a poem or scene]: a title card, two sounds, an image, a color wash, and a blackout at the end.

## Stretch: one new move (20 minutes)

**Launch** ([guide](/docs/launch))

> On /launch/cue-list, add a "pre-wait" and an "auto-continue" option to cues in `nextjs/lib/launch/cue-list.json`, the way QLab does: a cue can wait a few seconds before it fires, and can fire the next cue by itself when it's done. Show both in the list.

> Make /launch/cue-list advance when a MIDI pad is hit, so a performer can run the show from a drum pad on the floor.

> In `nextjs/lib/launch/MidiBoard.jsx`, make the piano keys of my MIDI keyboard play notes through the stage (a simple Web Audio synth), while the pads keep firing cues.

**Voice** ([guide](/docs/voice))

> In `nextjs/lib/voice/ScriptFollower.jsx`, show the next cue coming up ("standing by: Moon, 6 words away") under the surtitles.

> In `nextjs/lib/voice/script.js`, replace Sonnet 18 with this text and mark cues on the words I've put in capitals: [paste your text].

> Add a mode to /voice/script for two readers taking alternate lines, each with a different color on the surtitles.

**Track** ([guide](/docs/track))

> Make the hand's x position (left to right) set the stage's `hue` while its height sets `brightness`.

> Count fingers held up (0–5) and fire a different cue for each number.

> Add an instrument to `nextjs/lib/cv/instruments.js` called `clap`: it fires when the two hands' wrists come within 0.1 of each other. Add its cue to `nextjs/app/track/cues.js` and a tab for it.

**Draw a box** ([guide](/docs/draw-a-box))

> When a clip starts in the box, also fire a stage cue (`fireCue` from `nextjs/lib/stage/stage.js`) so the projector shows it full screen too.

> Let me draw two boxes and play a different clip in each: find the two biggest boxes, and let the words pick "left box" or "right box".

**The stage** ([guide](/docs/stage))

> Read `nextjs/lib/stage/README.md` and `nextjs/lib/stage/Stage.jsx`. Add a new cue kind, `split`, that shows two images side by side on the stage, and add a button for it in `nextjs/lib/launch/buttons.js`. Keep the change small and tell me how to test it.

## For your group's performance

> Read `nextjs/lib/stage/README.md`. We're performing [describe it in two sentences]. Our reader says these words: [list]. Our operator has a MIDI controller. Make `nextjs/lib/voice/triggers.js` fire our word cues and `nextjs/lib/launch/buttons.js` hold our manual backups, with a blackout on key 9.

> Make a "rehearsal log" on /launch/cue-list: every time a cue fires, write the time since Go on cue 1, so we can see how long the piece runs and where it drags.

> Add a big on-screen "standing by" display to /launch/cue-list that the operator can read from across the room: the next cue's number and label, very large.

## When something breaks

> The page at [URL] shows this error: [paste it]. Find the cause and fix it with the smallest change. Don't change anything else.

> Undo your last change to [file], and explain what it was trying to do.

> Nothing appears on the stage when I fire a cue. Check `nextjs/lib/stage/stage.js` and the page I'm on and tell me what to look at, before you change anything.
