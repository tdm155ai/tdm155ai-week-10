---
title: Voice cues
description: Say a word and a cue fires; or read a sonnet aloud and the cues come at the words they're marked on.
order: 3
---

**Open:** [/voice](/voice) (Hello World), then [/voice/script](/voice/script). Use Chrome, allow the microphone, and open the [stage](/docs/stage) first.

## What it does

Chrome has speech recognition built in (the **Web Speech API**): no key, no install, and it hands back words while you're still talking. They arrive first as guesses (grey on the page) that firm up when you pause. These pages watch that stream of words and fire cues.

Chrome sends the audio to Google's recognizer, so it needs the internet, and it works best with a decent mic close to the speaker. It restarts itself after a silence.

## 1. Say a word (Hello World)

Press **Start listening** and say "hello world", then "moon". Each **trigger word** fires its cue the moment it shows up, usually before you finish the sentence. The **Fired** list says which word fired what, and whether it fired from a guess ("interim", fastest) or the settled text ("final").

No mic, or a noisy room? Type a line in the box and press Enter: it goes through the same matcher.

**The one file to change:** `nextjs/lib/voice/triggers.js`:

```js
{ say: "moon", cue: { id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg" } },
```

Pick words that the recognizer gets right and that don't come up by accident. "Moon" is good; "the" fires all the time; names and invented words often come back spelled some other way. Test your words out loud in the room you'll perform in.

## 2. Follow a script

Read Sonnet 18 aloud from the top. The page **keeps your place** (the surtitle box lights up the words you've read) and fires each cue when you reach the word it's marked on. It matches each word it hears to the next few words of the text, loosely, so a misheard word ("thee" as "the", "winds" as "wins") or a skipped one doesn't lose the place.

- **Simulate a reader** reads the sonnet in the page, with a few mistakes, so you can see it work without a mic.
- **Go: next cue by hand** (`Space`) is the operator's backup: it fires the next cue now and moves the place there.
- **Click any word** to jump there (cues before it count as done).
- Tick **surtitles on the stage** to send each line to the projector as you reach it.
- **Paste or edit the text** to read something else.

**The one file to change:** `nextjs/lib/voice/script.js`: the text, with `[[name]]` after a word to mark a cue, and below it what each named cue does.

```
Rough winds [[wind]] do shake the darling buds of May,
```

Put cues on words that are clearly said and clearly recognized (nouns, stressed words), not on "thee" or "and".

## Ask Claude Code

> On /voice, add a "confidence" display and only fire a trigger word if Chrome's confidence is above a threshold I can set with a slider.

> In `nextjs/lib/voice/ScriptFollower.jsx`, show the next cue coming up ("standing by: Moon, 6 words away") under the surtitles.

> Add a mode to /voice/script for two readers taking alternate lines, each with a different color on the surtitles.
