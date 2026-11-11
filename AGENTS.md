# tdm155ai-week-10: instructions for agents

TDM 155AI week 10 (class Wednesday 2026-11-11, noon): installations. Read `README.md`, then `nextjs/CLAUDE.md` for the app and who owns which route on class day.

- Students run this locally in Chrome. The first four Hello Worlds need no model API key. Optional OpenAI voice routes read the repo-root `.env` on the server through `nextjs/lib/keys.mjs`. Permanent keys never reach the browser and are never printed or committed; the live speech route mints a short-lived client credential.
- Use pnpm, never npm or yarn. Don't hard-wrap Markdown prose.
- Every mechanic gets a Hello World version a student can understand and change in a few minutes, and a fuller version for the performance. Tell RS what changed, the file students edit, and the route; RS maintains the how-to in `nextjs/content/docs/`.
- No student names or student work in this repo. Media goes in the gitignored `_media/`.
- Commit by path to `main` and push. Several agents share this checkout: stay in your own paths.

## Class-day ownership (November 11)

- TL: this README and AGENTS, app shell (`nextjs/app/page.jsx`, `layout.jsx`, `globals.css`, `components/`, `docs/`, `print/`, `inputs-outputs/`, `experiments/`), `nextjs/lib/content.mjs`, `nextjs/lib/keys.mjs`; integration checks and the one shared dev server at http://localhost:3000.
- RS: all `nextjs/content/`, including the home page, docs, pro apps, inspiration, and new Markdown pages.
- TR: `nextjs/app/launch/`, `voice/`, `stage/`, `media/`; `nextjs/lib/launch/`, `voice/`, `stage/`; `nextjs/public/samples/`.
- CV: `nextjs/app/track/`, `draw-a-box/`; `nextjs/lib/cv/`; `nextjs/public/cv/`.

This is the HUIT workspace's ownership, superseding the morning split and the older ownership notes in `nextjs/CLAUDE.md`. TR and CV report guide changes to RS instead of editing Markdown. New top-level routes require TL to update the shared ownership and plan.
All mechanics use `fireCue` and `setParam` from `nextjs/lib/stage/stage.js`; read `nextjs/lib/stage/README.md` before adding a controller. Keep the projector stage and controllers on the same browser origin/profile/computer. Do not start a second development server. Announce package/lockfile changes and serialize production builds. Run `pnpm build` before pushing; check your route in Chrome, distinguishing simulated input from physical hardware tests.

Priorities: working student Hello Worlds (keys/buttons, MIDI, spoken word, raised hand), shared stage, script follower, then draw-a-box and extensions. No student names/work, keys, or copyrighted media in this public repo. Generated sample assets carry their license; personal media stays in gitignored `_media/`.
