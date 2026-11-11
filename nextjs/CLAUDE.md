@AGENTS.md

# TDM 155AI week 10: the app

A Next app that renders the Markdown in `content/` (its README is the home page; `content/a/b.md` is `/a/b`) (`lib/content.mjs`). `/docs` (`app/docs/`) shows `content/docs/` with a sidebar. The header nav (`app/components/Chrome.jsx`) is Docs, Launch, Voice cues, Track, Draw a box, Pro apps. Keys come from the repo's root `.env` through `lib/keys.mjs` and never reach the browser. Every other file and folder renders through the catch-all `app/[...slug]/`, and a light `/print` renders any page. Copied from `tdm155ai-week-9` (the Markdown site only) on 2026-11-11. See the repo `README.md`.

Route ownership on class day (2026-11-11): `app/launch/`, `app/voice/`, `lib/launch/`, `lib/voice/`, `content/docs/launch*`, `content/docs/voice*` belong to the TR pane; `app/track/`, `app/draw-a-box/`, `lib/cv/`, `content/docs/track*`, `content/docs/draw-a-box*` to the CV pane; `content/pro-apps/` to the RS pane; the home page, nav, layout, and repo README to the TL pane.
