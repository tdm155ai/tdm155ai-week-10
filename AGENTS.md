# tdm155ai-week-10: instructions for agents

TDM 155AI week 10 (class Wednesday 2026-11-11, noon): installations. Read `README.md`, then `nextjs/CLAUDE.md` for the app and who owns which route on class day.

- Students run this locally in Chrome. The first four Hello Worlds need no model API key. Optional OpenAI voice routes read the repo-root `.env` on the server through `nextjs/lib/keys.mjs`. Permanent keys never reach the browser and are never printed or committed; the live speech route mints a short-lived client credential.
- Use pnpm, never npm or yarn. Don't hard-wrap Markdown prose.
- Every mechanic gets a Hello World version a student can understand and change in a few minutes, and a fuller version for the performance. Write the how-to in `nextjs/content/docs/` as you build.
- No student names or student work in this repo. Media goes in the gitignored `_media/`.
- Commit by path to `main` and push. Several agents share this checkout: stay in your own paths.

## Class-day ownership (November 11)

- TL: this README and AGENTS, `nextjs/content/README.md`, `nextjs/app/page.jsx`, `nextjs/app/layout.jsx`, `nextjs/app/components/Chrome.jsx`; integration checks and the one shared dev server at http://localhost:3000.
- RS: `nextjs/content/pro-apps/` and `nextjs/content/inspiration/`.
- TR: `nextjs/app/launch/`, `voice/`, `stage/`, `media/`; `nextjs/lib/launch/`, `voice/`, `stage/`; `nextjs/public/samples/`; launch, voice, and stage guides in `nextjs/content/docs/`.
- CV: `nextjs/app/track/`, `draw-a-box/`; `nextjs/lib/cv/`; `nextjs/public/cv/`; tracking and draw-a-box guides in `nextjs/content/docs/`.

All mechanics use `fireCue` and `setParam` from `nextjs/lib/stage/stage.js`; read `nextjs/lib/stage/README.md` before adding a controller. Keep the projector stage and controllers on the same browser origin/profile/computer. Do not start a second development server. Announce package/lockfile changes and serialize production builds. Run `pnpm build` before pushing; check your route in Chrome, distinguishing simulated input from physical hardware tests.

Priorities: working student Hello Worlds (keys/buttons, MIDI, spoken word, raised hand), shared stage, script follower, then draw-a-box and extensions. No student names/work, keys, or copyrighted media in this public repo. Generated sample assets carry their license; personal media stays in gitignored `_media/`.
