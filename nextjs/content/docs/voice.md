---
title: Voice cues
description: Say a word and a cue fires; or read a sonnet aloud and the cues come at the words they're marked on.
order: 3
---

**Open:** [/voice/hello](/voice/hello) (Hello World), then [/voice](/voice), [/voice/words](/voice/words), and [/voice/script](/voice/script). Use Chrome, allow the microphone, and open the [stage](/docs/stage) first.

## What it does

Chrome has speech recognition built in (the **Web Speech API**): no key, no install, and it hands back words while you're still talking. They arrive first as guesses (grey on the page) that firm up when you pause. These pages watch that stream of words and fire cues.

Chrome sends the audio to Google's recognizer, so it needs the internet, and it works best with a decent mic close to the speaker. It restarts itself after a silence.

## Pick your mic first

Every voice page has a **Mic** menu at the top of the Listen panel: every input Chrome sees, remembered in this browser. Press **Check** and watch the **level meter**: "Hearing you" means the sound is getting in; "Open, but quiet" means move closer or pick another mic. The meter is the **raw audio signal**, before any words are recognized (see [inputs and outputs](/repertoire)).

- **If Web Speech seems to hear the wrong mic**, set the Mac's input in System Settings › Sound › Input. The page hands Web Speech the chosen mic, but some versions of Chrome ignore it and use the Mac's default; the page says so when that happens.
- **A quiet voice getting swallowed?** Tick **raw (no cleanup)**: it turns off echo cancellation, noise suppression, and automatic gain.

## 0. Hello World: one word, one cue

[/voice/hello](/voice/hello) is the whole idea in one short file: press listen, say "hello", and "Hello, world" comes up on the stage. Read `nextjs/app/voice/hello/Hello.jsx` top to bottom, then change `WORD` and `CUE` at the top.

## 1. Say a word

Press **Start listening** and say "hello world", then "moon". Each **trigger word** fires its cue the moment it shows up, usually before you finish the sentence. The **Fired** list says which word fired what, and whether it fired from a guess ("interim", fastest) or the settled text ("final").

No mic, or a noisy room? Type a line in the box and press Enter: it goes through the same matcher.

**The one file to change:** `nextjs/lib/voice/triggers.js`:

```js
{ say: "moon", cue: { id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg" } },
```

Pick words that the recognizer gets right and that don't come up by accident. "Moon" is good; "the" fires all the time; names and invented words often come back spelled some other way. Test your words out loud in the room you'll perform in.

## 1b. Your own trigger words, on the page

[/voice/words](/voice/words) is the same word matching as [/voice](/voice), with the list editable on the page: no file to open. Each row is a word or phrase and the cue it fires (any cue from [/launch](/launch) or [/voice](/voice), or "show the words" as text on the stage).

- **Add a row**, type a word, pick a cue. Turn rows on and off; **Test** fires a row by hand. Each row shows how many times it fired and when; the **last match** is shown large.
- **Re-arm after** (0.3–6 s): how long before the same word can fire again.
- **Wait for the end of the phrase**: fire on the settled text instead of the guess (slower, fewer false hits).
- Matching is by **whole words**: "full moon" fires on "and the full moon rises" but not on "the moon is full", and "blackout" doesn't fire on "blackouts"; punctuation and capitals don't matter. No model, no key.
- Type a line to test without a mic; pick your mic at the top.
- Your list is saved in this browser. To keep it in the project, press **Copy as code** and paste it over the list in `nextjs/lib/voice/triggers.js`.

## 2. Follow a script

Read Sonnet 18 aloud from the top. The page **keeps your place** (the surtitle box lights up the words you've read) and fires each cue when you reach the word it's marked on. It matches each word it hears to the next few words of the text, loosely, so a misheard word ("thee" as "the", "winds" as "wins") or a skipped one doesn't lose the place.

- **If it loses the place** (you skip a line, or the recognizer drops a stretch), keep reading: once it hears three or four words in a row that match the text further on (up to about 60 words ahead), it jumps there. The words it jumped over are struck through, and their cues are **skipped, not fired** (dashed outline, and a line in the log saying why), so nothing stale flashes up when it catches up. If several cues are passed at once, only the latest fires. Runs of little words ("and in the") never cause a jump.
- **Simulate a reader** reads the sonnet in the page, with a few mistakes, so you can see it work without a mic. With **skip stretches** ticked, it also loses nine words every third line, to show the recovery.
- **Go: next cue by hand** (`Space`) is the operator's backup: it fires the next cue now and moves the place there.
- **Click any word** to jump there (cues before it count as done).
- Tick **surtitles on the stage** to send each line to the projector as you reach it.
- **Paste or edit the text** to read something else.

**The one file to change:** `nextjs/lib/voice/script.js`: the text, with `[[name]]` after a word to mark a cue, and below it what each named cue does.

```
Rough winds [[wind]] do shake the darling buds of May,
```

Put cues on words that are clearly said and clearly recognized (nouns, stressed words), not on "thee" or "and".

The menu next to **Start listening** picks the engine: **Web Speech** (free) or **OpenAI** (needs an OpenAI key in the repo-root `.env`, and costs a little per minute; the cue words and the text are sent along as hints, so it tends to get them right).

## 3. Compare engines

[/voice/compare](/voice/compare) runs two listeners on the same voice at once: Chrome's **Web Speech** and OpenAI's **`gpt-live-transcribe`**, a streaming model that sends words back while you talk. Both watch for the trigger words, and a table shows which heard each word first and by how many milliseconds. You can fire cues from whichever hears a word first (two listeners racing is one way to cut the delay), from one engine, or from neither.

- **OpenAI delay**: `minimal` is fastest; `medium` waits for more of the sentence and is more accurate.
- **OpenAI listens to a recording**: put an audio file in `_media/` and type `/media/your-file.mp3` to test without talking.
- How it works: the page asks this app's server for a short-lived token (`app/voice/token/route.js`: the real key never leaves the server), then streams the mic straight to OpenAI over WebRTC (`lib/voice/openai-live.js`). OpenAI's model doesn't decide when you've stopped talking, so the page does: when the mic goes quiet for about half a second, it tells OpenAI to finish that phrase.

It costs a little per minute of audio, so stop it when you're not using it.

## 4. Cues by topic (with AI)

[/voice/semantic](/voice/semantic) drops the magic words. You talk freely (a lecture, an improvised scene), and at each pause the last few sentences go to a small, fast AI model (through `app/voice/decide/route.js`) along with a list of **topics**. It answers in a fixed JSON shape: which topic you're on now, how sure it is, and which topic seems to be coming next. A confident new topic fires its cue. That takes a second or two, so there's also a fast lane: when the model **arms** a topic ("this is coming"), the first of that topic's words to show up in the live transcript fires it immediately.

- **The model:** through **OpenRouter** when there's an `OPENROUTER_API_KEY` in `nextjs/.env.local` (or the repo-root `.env`); otherwise OpenAI's `gpt-6-luna` with an `OPENAI_API_KEY`. The page says which is answering ("Via OpenRouter") and has a model menu; the default is `anthropic/claude-haiku-5.5` (about a second per decision). Every call in the log names its model. Each call costs a little.
- **No mic?** Play the sample lecture: it wanders from night to the sea to fractals to evolution to a love poem, mostly without naming the topics.
- **fire above**: how sure the model has to be before the cue changes.
- **The one file to change:** `nextjs/lib/voice/topics.js`. Describe each topic the way you'd brief a human operator; the model reads your description.

## Ask Claude Code

> On /voice, add a "confidence" display and only fire a trigger word if Chrome's confidence is above a threshold I can set with a slider.

> In `nextjs/lib/voice/ScriptFollower.jsx`, show the next cue coming up ("standing by: Moon, 6 words away") under the surtitles.

> Add a mode to /voice/script for two readers taking alternate lines, each with a different color on the surtitles.
