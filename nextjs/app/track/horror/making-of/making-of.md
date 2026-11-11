# Making of: the live horror scene

## In short

[/track/horror](/track/horror) turns one Chrome tab into a small horror-film set that works live and records itself. One person says a one-minute monologue into a mic and hears it come back out of the speakers as a ghost, something possessed, or a demon. The camera cuts them out of the room, paints a horror mask onto their face that moves with it, and floats a glowing ghost behind them that a second person steers with their hand. The operator switches the voices and fires the scares, or the monologue does it itself, followed by ear. **Record** saves the picture and the sound as a video that plays back on the same page.

Everything runs in the tab: no server, no API key, no recorded sound or video files. It was built with Claude Code on November 11, 2026, in about two hours, from the plain-language prompts quoted below.

What's in it:

- **A mask that follows the face.** There are four masks: pale ghost, skull, broken doll, and no face. Each is painted onto MediaPipe's face map. The eyes can be black holes or burning pupils that follow your gaze, and the mouth opens into a black hole.
- **A ghost behind you.** React Bits' GhostCursor, the same ghost as [/track/effects/ghost](/track/effects/ghost), is steered by whoever's hand is in the picture; a pinch makes it flare. The performers are cut out of the room, so only the ghost is behind them.
- **Five voices on the mic:** my own voice, ghost, possessed, demon, and broken radio.
- **Catch and speak back.** Say a phrase quietly; when you pause, it plays the phrase back loud in the chosen voice.
- **A monologue that cues itself.** There are 14 lines, each with its voice, mask, and scare. Chrome's speech recognition follows along and fires each cue as its line starts.
- **Ambience and scares, all synthesized:** a drone with wind, a heartbeat, whispers, a stinger, and a boom.
- **Recording and playback.** After a countdown, it records an MP4 (or WebM) with the picture and everything you heard. You can play, download, or delete each take.
- **A USB audio interface.** A Focusrite Scarlett works on either input.

## The prompts

Every prompt from the session, quoted exactly as it was typed or dictated, with the time it was sent (Eastern time, Wednesday, November 11, 2026) and what it added.

**12:05 pm**

> can you pull all changes

This brought the local copy of the class repo up to date before the work started.

**1:33 pm**

> So we want to combine a couple of features. We want to put voice filter on whatever we're saying. Do we want to record a video? Yeah, right? Mm-hmm. We want to record a video with the ghost background from the repo. And what else? In a ghost mask. Or some sort of mask that goes into your face that's horror movie-esque. Yes. And then we want to be able to watch the video. So we'll say something, you'll put the mask on us, you'll put the ghost background and the voice filter and produce the video that we can play in the same HTML where we have this whole feature. It's like a scary horror movie setup. So the goal is to have like a very scary horror movie-like video.

This made the first version of the page. It had the camera, a mask painted onto the face, the repo's ghost behind the performers, a voice filter, **Record**, and a list of takes to watch below the stage.

**1:38 pm**

> Is there a way to build like a real-time based voice filter into the mic, so the mic goes into the computer and we can speak into the mic? And then is it possible for the sound that we speak to automatically be filtered and made into a different sound, so like the scary sound, and then have someone's hand correspond to, I don't know, some, the ghost background, because it has to be a live performance. We want to do the same thing that we're going to code up, but we want to do it live. And then one person would be making the sound with whatever, able to add something. Can we do it, and how can we do it? Is it possible for it to be web-based at all?

The answer was yes, all in the browser, and the page became something you can perform live:

- The filtered voice goes out of the speakers as you speak.
- The ghost follows whoever's hand is in the picture.
- The operator has keys to switch voices and fire scares.

**1:40 pm**

> Can you also write a monologue that's about a minute long, so the person who is reciting it has the filtered voice?

> We want the person who's saying the monologue to seem very spooked out because of all the effects that we have in the background. So, make like a minute long monologue that a super scared person would be saying.

These added `script.js`, a monologue called "Is somebody there?". Its 14 lines move from nervous joking to possession. Each line has a cue (a voice, a mask, or a scare) that fires as the line starts.

**1:57 pm**

> Okay, now give us instructions on how to perform. Please make it concise. Another question, how do we test the mic? How do we connect it and how do we make sure that the sound that comes out is actually filtered?

The answer was a short run-through for the performer, the person moving the ghost, and the operator, plus a mic check. The level meter should move when you speak. Then switching between key 1 (your own voice) and key 3 (possessed) lets you hear the filter.

**2:00 pm**

> i just plugged in a scarlet

The voice now listens to every input channel, so a mic on the Scarlett's input 2 works. The mic menu also picks up an interface as soon as it's plugged in.

**2:05 pm**

> Can you build in a feature to the web app that catches the voice, like catches the words that we say them quietly into the mic, and then it processes them, and then it on the output speaker, it plays the possessed voice or ghost voice or whatever it's supposed to play. Also trigger different types of voices depending on the script that we say. So it can be delayed a little bit, but make sure that it's relatively real time. So like as quickly after we say it as possible, just play it and have the video as it is right now.

This added two features:

- **Catch mode:** a quiet phrase comes back loud in the chosen voice about half a second after you stop.
- **Following by ear:** Chrome's speech recognition follows the monologue, switching voices and firing cues as each line starts.

**2:06 pm**

> make sure that the voice is also displayed in the live preview and not just the recorded version.

Live out now starts on, so the voice is heard in the room, not only in the recording. The preview also shows what the catcher is doing and the words it heard.

**3:27 pm**

> can we make this the kja branch

The work moved to its own branch, `kja`, and `main` was left as it was.

**3:28 pm**

> now can you please create a summary of the work we've done in on the current project and create a "making of" page that unpacks it, then push both the making of and the horror route to gh

This page.

**3:31 pm**

> i want the making of to also include our prompts with timestamps if you have them

The prompts above.

## How it works

Four chains run side by side in the tab. The picture and the voice are what the audience sees and hears. The ear follows the script, and the recorder catches both.

<!-- pipeline -->

### The picture

Each camera frame is drawn, mirrored, into a 1280 × 720 canvas. Three of Google's MediaPipe models then look at it, all inside the tab:

- **Face Landmarker:** 478 points on the face, and expressions such as how far the jaw is open.
- **Hand Landmarker:** 21 points per hand. The page uses the index fingertip and the thumb tip.
- **Image Segmenter** (selfie): which pixels are a person.

To keep the frame rate up, the trackers look at smaller copies of the frame: 640 pixels wide for the face and hands, 256 for the cutout. When hand tracking and the cutout are both on, they take turns, one frame each.

three.js then builds the picture in three layers:

1. **The backdrop.** The person is cut out of the room, drained of color, raised in contrast, and tinted a cold green-grey. The ghost sits behind them, and a little of it drifts in front.
2. **The mask.** A 3D mesh of the face, the same 468-point face MediaPipe uses, moves to the face's points every frame.
   - Its texture is the painted mask, shaded by the brightness of the real face underneath, so it reads as skin, not a sticker.
   - Black shapes cover the outlines of the eyes and the inside of the lips for the "void" eyes and mouth.
   - Small glowing sprites sit on the irises for burning pupils.
3. **The film.** A last pass goes over the whole frame. It adds flickering light, tearing and color-split glitches, a vignette, grain, and scanlines. Open your mouth wide and the picture tears.

**The ghost** is React Bits' GhostCursor, which draws in its own WebGL canvas and follows a pointer. The page drives that pointer with the tracked fingertip, eased so it trails behind. GhostCursor got one new optional prop, `onRender`, which hands the page the ghost's canvas right after each frame. The page copies it into the picture, which is how the ghost gets into the recording.

### The masks

A mask is painted once, in 2D, on a flat 1024 × 1024 "unwrap" of the face, with the forehead at the top and the chin at the bottom. The mesh then stretches it over the face.

`paint.js` has the brushes: skin, sockets, lips, tears, cracks, veins, blotches, stitches, teeth, a skull's nose, and cheek hollows. Each brush finds the eyes, lips, and face outline from MediaPipe's point numbers. Its "random" is seeded, so a mask looks the same every time.

`masks.js` lists the masks. For each one it says which brushes to use, in what order and color, and what the eyes and mouth do.

### The voice

The voice is a Web Audio graph:

```
mic → catch → gate → pitch A ┐
                   → pitch B ┴→ low cut → high cut → growl → wobble ┬→ dry ────┐
                                                                    ├→ echo ───┼→ speakers and the recording
                                                                    └→ reverb ─┘
drone, wind, and scares ──────────────────────────────────────────────────────┘
```

- **Pitch.** There are two pitch shifters, written as AudioWorklets. Each one reads its own copy of the last fraction of a second of sound, at a different speed. It uses two read heads and crossfades between them, so the jumps don't click. The delay stays at a few tens of milliseconds, and the slight warble left behind suits a ghost. The second shifter is the "double", a second voice under the first.
- **The effects:**
  - **Growl** is distortion, from a wave-shaper.
  - **Wobble** multiplies the voice by a wave. At 5 Hz it trembles; at 40 Hz and up it sounds like a broken radio.
  - **Echo** is a delay that feeds back into itself.
  - **Reverb** is a convolver whose "room" is three and a half seconds of fading noise, generated on the spot.
- **The gate** shuts out sound below a set level, so the room's hum doesn't rumble through the filter between words. It adds up every input channel, so a mic on a Scarlett's input 2 isn't lost.
- **Ambience and scares** are synthesized too:
  - **Drone:** two low saw waves a half step apart through a slowly moving filter, plus filtered noise for wind.
  - **Heartbeat:** pairs of falling low thumps.
  - **Whispers:** bursts of filtered noise scattered left and right.
  - **Stinger:** six clashing saw waves and a hit.
  - **Boom:** a falling sub-bass with a rumble.

The five voices in `settings.js` are just different settings of the same knobs.

### Catch and speak back

A live voice has two problems in a room: the speakers feed back into the mic, and a quiet voice through a pitch shifter comes out thin. Catch mode solves both by not being live:

1. **Listening.** It keeps the last 0.15 seconds of sound, so the first syllable isn't lost.
2. **Hearing you.** Sound above the threshold starts a phrase.
3. **Speaking.** A 0.3-second pause ends the phrase. The phrase is trimmed, boosted to a set loudness (up to 40 times louder), and played through the voice, with tiny fades so it doesn't click. Anything with less than 0.15 seconds of voice in it, such as a cough or a click, is thrown away.
4. **Deaf.** While it plays, and for 0.6 seconds after, it ignores the mic, so it never catches its own echo.

The wait is the pause plus a little, so playback starts about half a second after you stop. **K** switches to live mode, which has no wait but can feed back if the speakers face the mic.

### Following the script by ear

With **Follow the script by ear** on, a copy of the mic goes to Chrome's speech recognition (the Web Speech API). The repo's script follower, `lib/voice/follow.js`, matches the words it hears against the monologue:

- A line counts as started once two of its words are heard (one, for a very short line). Then its cue fires: the voice, the mask, the scare.
- If a line was skipped, its voice, mask, and ambience are applied anyway, so the scene catches up.
- While catch mode is speaking, recognition results are ignored, so the page doesn't follow its own voice.

The words it hears show as a caption on the preview. Chrome's recognizer runs on Google's servers, so this needs the internet. → still steps through the lines by hand.

### Recording

**Record** counts down, then records the picture at 30 frames a second, with everything that goes to the speakers, at 8 Mbps. It saves MP4 where Chrome can and WebM otherwise. Each take appears below the stage to play, download, or delete.

Takes are kept only in the tab, so download the ones you want to keep. While a take plays, the voice is turned off at the speakers, so you don't hear the take and the mic at once.

## Problems along the way

- **No camera to test with.** The test browser couldn't open a camera or mic, so the page was tested with stand-ins: a canvas drawing a face from the mesh's own map, and a tone for a voice. They went in where the camera and mic would be, which made it possible to check the whole chain, from tracking to recording.
- **Sound needs a real click.** Browsers only start sound after a person clicks, and a click made by a script doesn't count. That's why everything begins with the **Start** button.
- **A ghost too bright.** Over a face, the ghost's glow washed out the mask, so its bloom and brightness came down.
- **Slow trackers.** In testing, each of the three models took 30–60 ms. Giving them smaller copies of the frame and taking turns brought the frame rate back up. Once the browser window was visible, the stage showed 30 frames a second. A hidden browser window runs slow on purpose, which had made the first measurements look worse than they were.
- **Keys that stopped working.** After clicking a checkbox, R no longer recorded, because the page ignored keys whenever a control had focus. Now it ignores them only while you type in a text field or choose from a menu.
- **A silent input 2.** The voice filter read only the first channel of the interface, so a mic on input 2 would have been silent. The gate now adds the channels together.
- **Feedback.** A live voice through speakers next to the mic howls. Catch mode never listens while it plays.
- **A voice only in the recording.** Live out now starts on, and the preview shows what the catcher is doing and the words it heard. Both are hidden in full screen and never recorded.

## Change it

- **`settings.js`** is the file to change. It sets:
  - the starting mask and voice;
  - the five voices and their knobs;
  - catch or live mode, and how catching listens;
  - following by ear;
  - the gate and the ambience;
  - the ghost's color, what it follows, and its trail;
  - the look of the picture, and the countdown.
- **`masks.js`:** copy a mask, rename it, change a color or a brush, and save. It shows up in the Mask menu.
- **`script.js`** is the monologue. Each line has what to say, a stage note, and `do`: a voice, a mask, a scare, a blackout, a glitch, a flare, or an ambience level.

The page updates when you save.

## Before the first performance

Everything else was checked in the browser with the stand-in camera and mic, and the production build passes. These need checking for real, in the room:

- The camera finds the face, and the mask fits it.
- The Scarlett shows in the mic menu, and the meter moves when you speak.
- Catch mode catches a quiet phrase. If it doesn't, lower `threshold` in `settings.js`. If it cuts phrases in the middle, raise `pause`.
- Chrome's speech recognition follows the monologue at the volume you'll use. Speak softly rather than whisper, with the Scarlett's gain up.
- The speakers and mic are placed so the room's echo doesn't start new phrases. If it does, raise `deafAfter`.
- A test recording plays back with sound.

## The files

| File | What it does |
|---|---|
| `app/track/horror/settings.js` | Everything to change: the file students edit |
| `app/track/horror/masks.js` | The masks |
| `app/track/horror/script.js` | The monologue and its cues |
| `app/track/horror/Horror.jsx` | The page: camera, mic, trackers, keys, the script, recording, takes |
| `app/track/horror/scene.js` | The picture: the three.js layers and the film pass |
| `app/track/horror/paint.js` | The brushes the masks are painted with |
| `app/track/horror/voice.js` | The sound: the voice filter, catch, the gate, ambience, scares |
| `app/track/horror/horror.css` | The page's look |
| `app/track/horror/making-of/` | This page |
| `lib/cv/react-bits/GhostCursor.jsx` | The ghost, now with `onRender` |
| `lib/voice/speech.js`, `lib/voice/follow.js` | Speech recognition and the script follower, shared with the rest of the site |

## Credits

- **The ghost:** GhostCursor from React Bits (MIT + Commons Clause).
- **Face, hand, and person tracking, and the face mesh:** Google's MediaPipe (Apache 2.0).
- **The picture:** three.js (MIT).
- **The monologue** was written for this class.
- **Every sound** is synthesized in the browser; there are no recorded sound or video files.
