# tdm155ai-week-10

TDM 155AI week 10 (class 2026-11-11): **installations**. Launching sound, video, images, and light in a physical space for a live audience. A local Next app in `nextjs/` with one route per mechanic: `/launch` (keys, buttons, MIDI controllers, a cue list with Go), `/voice` (live transcription and voice- or lyric-triggered cues), `/track` (MediaPipe hands, faces, poses as triggers), `/draw-a-box` (draw a box under the overhead camera, a video plays inside it), and `/pro-apps` (the professional show-control and media apps and their maneuvers, Markdown in `nextjs/content/pro-apps/`).

Public (student-facing: nothing private goes in), in the `tdm155ai` org; created 2026-11-11 as mkuzmick and nested in The Notebook at `apps/tdm155ai/tdm155ai-week-10`. The Next base (Markdown site, docs, print) is copied from `tdm155ai-week-9`.

## Run it

Use Node 22 or newer and pnpm. From this repository's root:

```
cd nextjs
pnpm install
pnpm dev -p 3000
```

Open http://localhost:3000 in Chrome (camera, microphone, Web MIDI, and Web Serial need Chrome or Edge).

The first-hour starts—buttons, MIDI, spoken-word matching, and hand tracking—need no model API key. If you use the optional OpenAI speech comparison or semantic cues, copy `.env.example` to `.env` at the repo root and add your own key. These experiments incur API charges. Keys are read on the server through `nextjs/lib/keys.mjs`; never put them in browser code.

## First hour: open, change, try again

Start at `/`. Each mechanic has a small file to change:

| Open | Try | Change |
| --- | --- | --- |
| `/launch` | Click a button, press 1–9; Space = Go | `nextjs/lib/launch/buttons.js` |
| `/launch/midi` | Connect MIDI, hit a pad; or use on-screen pads | `nextjs/lib/launch/midi-map.js` |
| `/voice` | Say “moon”; or type a line | `nextjs/lib/voice/triggers.js` |
| `/track` | Put your fingertip in the top zone | `nextjs/app/track/cues.js` |

Open `/stage` in a separate window, click once to enable sound, and put it on the projector. Stage and controls must use the same origin, Chrome profile, and computer. Other students run their own app and stage on their own computers. `/docs/stage` explains the shared cue contract and blackout.

Then combine manual launching and voice cues into a short performance. `/voice/script` follows Sonnet 18 (or text you paste), `/launch/cue-list` runs a numbered cue list, `/track/instruments` adds continuous controls, and `/draw-a-box` puts a clip inside a rectangle seen by the overhead camera.

## Research and examples

`/pro-apps` renders the comparison of professional apps, with `/pro-apps/tools`, `/pro-apps/mechanics`, and `/pro-apps/build-it-yourself` for individual tools, maneuvers, and implementation ideas. `/inspiration` has concert and theater clips, individual examples, and show case studies. Markdown under `nextjs/content/` renders as routes automatically; folder `README.md` files become folder introductions. These research pages are labeled as AI-assisted and link their sources.

## Equipment and fallbacks

- MIDI: USB controller and cable; on-screen pads work without hardware.
- Voice: mic permission and internet for Chrome Web Speech; typed input and manual Go are available.
- Tracking: camera permission; initial MediaPipe model downloads need internet.
- Draw-a-box: overhead camera, paper, thick dark marker; select clips with buttons or keys if voice is unreliable. Studio lighting needs a physical test.
- Stage: projector and PA for the room; the silent in-page preview works on a laptop.

The physical printing-buttons station is an in-room activity. It is separate from MediaPipe and button-launching rotations.

## Checks and shared development

Run `pnpm build` in `nextjs/` before pushing. The class-day orchestrator runs the one shared development server on port 3000; other panes use it rather than starting another. Build one at a time. Commit only your own files by path. See `AGENTS.md` for ownership.

Media you bring (clips, sounds, concert footage) goes in the gitignored root `_media/`; it stays on the machine that has it.
