---
title: Make a short live performance
description: A worksheet for your group: roles, a cue sheet, a backup for every cue, and a blackout at the end.
order: 4
---

Written with AI from Marlon's class plan (November 11, 2026). A proposal for the group build; your instructor may change the timing.

The goal: a short piece, a minute or two, where things **pop up in the room at the right moments**. A reader reads (a sonnet, a poem, a scene, a little lecture) and cues fire: a sound, a picture, a color, a line of text. Combine **voice-triggered cues** with **keys, buttons, or MIDI**, so a person can always run the show by hand.

## 1. Choose your roles (5 minutes)

- **Performer / reader**: speaks the text into the mic. Says the cue words clearly.
- **Cue operator**: runs the laptop: watches the cues fire, presses **Go** when one doesn't, owns the **blackout**.
- **Stage manager** (if there are three of you): calls the cues, watches the projector and the room, starts and stops the piece.
- **Where's the audience?** Decide where they sit or stand, where the projection lands, and where the performer is. The performer should not be blocking the projector.

## 2. Pick a text and mark your cues (10 minutes)

Pick something short. Sonnet 18 is already loaded in [/voice/script](/voice/script); paste your own text there to try it. Mark 6–10 cues. Good cue words are **nouns and stressed words** the recognizer gets right ("moon", "storm", "rose"), not "the", "and", or names.

Fill in a cue sheet like this (copy it into a note or onto paper):

| # | On the word | What happens | Kind | Backup (key / pad) |
| --- | --- | --- | --- | --- |
| 1 | (before the first line) | Title card | text | `1` |
| 2 | "summer's" | Warm color wash | color | `2` |
| 3 | "winds" | Wind sound, looping | sound | `3` |
| 4 | … | … | … | … |
| last | (after the last line) | Blackout | blackout | `9` |

The kinds are `sound`, `video`, `image`, `text`, `color`, `blackout`, `stop` ([the stage guide](/docs/stage) has the options). Use the built-in samples, your own files in `_media/`, or media you make or generate. No copyrighted clips.

## 3. Build it (15–20 minutes)

Pick the route that fits your piece:

- **Reading a text start to finish:** [/voice/script](/voice/script). Put your text and `[[cue]]` marks in `nextjs/lib/voice/script.js`. [How it works](/docs/voice).
- **A few words that can come at any time:** [/voice](/voice). Put your words in `nextjs/lib/voice/triggers.js`.
- **The operator runs it in order:** [/launch/cue-list](/launch/cue-list). Put your cues in `nextjs/lib/launch/cue-list.json`; `Space` is Go.
- **Backups on keys or pads:** [/launch](/launch) and [/launch/midi](/launch/midi). Put the same cues in `nextjs/lib/launch/buttons.js` so every voice cue has a key.
- **Optional, if your core sequence already works:** a hand or a gesture from [/track](/track) or [/track/instruments](/track/instruments), or a clip in a drawn box from [/draw-a-box](/draw-a-box).

Stuck? [Prompts for Claude Code](/prompts) has one for setting up a group piece.

## 4. Rehearse (twice)

Before the first run:

- [ ] [/stage](/stage) open on the projector computer, clicked once (sound on), full screen (`F`).
- [ ] Controller pages open **in the same Chrome profile on the same computer** as the stage.
- [ ] Mic allowed; say a cue word and watch it fire. Check the volume through the room speakers.
- [ ] Every voice cue also has a key or pad. The operator knows them, and keeps them out of the way of key `9` (blackout).
- [ ] Blackout works: key `9` on [/launch](/launch), `Esc` on the cue list or in the stage window.

Run it once all the way through without stopping. Then talk: which cues fired late, early, or not at all? Change a cue word, move a mark, or give that cue to the operator. Run it again.

## 5. Perform

Each piece starts with an **output check** (picture on the projector, sound in the room) and ends in **blackout**. If a voice cue misses, the operator presses its key: the audience won't know. That's how theaters do it: the stage manager calls, the operator presses Go, and there's always a way to run the show by hand.

Afterward, save the small files you changed (`git add` them and `git commit`), so the piece can be run again.
