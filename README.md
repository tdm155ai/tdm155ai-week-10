# tdm155ai-week-10

TDM 155AI week 10 (class 2026-11-11): **installations**. Launching sound, video, images, and light in a physical space for a live audience. A local Next app in `nextjs/` with one route per mechanic: `/launch` (keys, buttons, MIDI controllers, a cue list with Go), `/voice` (live transcription and voice- or lyric-triggered cues), `/track` (MediaPipe hands, faces, poses as triggers), `/draw-a-box` (draw a box under the overhead camera, a video plays inside it), and `/pro-apps` (the professional show-control and media apps and their maneuvers, Markdown in `nextjs/content/pro-apps/`).

Private, in the `tdm155ai` org; created 2026-11-11 as mkuzmick and nested in The Notebook at `apps/tdm155ai/tdm155ai-week-10`. The Next base (Markdown site, docs, print) is copied from `tdm155ai-week-9`.

## Run it

Copy `.env.example` to `.env` at the repo root and add the keys provided in class. Then:

```
cd nextjs
pnpm install
pnpm dev
```

Open http://localhost:3000 in Chrome (camera, microphone, Web MIDI, and Web Serial need Chrome or Edge).

Media you bring (clips, sounds, concert footage) goes in the gitignored root `_media/`; it stays on the machine that has it.
