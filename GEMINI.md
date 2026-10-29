# GEMINI.md — 2048-clone

> **Single source of truth: [`AGENTS.md`](./AGENTS.md).**
> This file is a bridge for Gemini/Antigravity agents. Read `AGENTS.md` for the full project guide.

## Quick summary for Antigravity

| Topic       | Key info                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| **Stack**   | Vanilla JavaScript (plain script tags, shared global scope), CSS, HTML5 — no framework, no bundler for source |
| **Testing** | Vitest + jsdom (`npm test`), coverage gate (`npm run coverage`), Playwright smoke (`npm run test:e2e`)        |
| **Types**   | `npm run typecheck` — `tsc --checkJs` over the plain-JS sources (`config/jsconfig.json`)                      |
| **Linting** | `npm run lint` (ESLint 10), `npm run lint:css` (stylelint), `npm run format` (Prettier 3)                     |
| **Build**   | `npm run build` → `build-bundle.js` inlines everything into standalone `2048.html` (200 KB budget)            |
| **Dev**     | `npm start` serves on port 8080 (runs the Doodle tile-art generator first)                                    |
| **Config**  | all tool configs live in `config/`; every npm script passes an explicit `--config` path                       |

## Antigravity notes

- Game logic is in `js/` (decoupled from DOM via `HTMLActuator` in `js/html_actuator.js`).
- Plain scripts share one global scope: a new game file must be registered in `index.html`, `JS_FILES` in `build-bundle.js`, `GAME_FILES` in `test/setup.js` and `APP_SHELL` in `sw.js`.
- Board size is part of the storage contract: per-size keys carry a `-3` / `-5` suffix (`4x4` keeps the plain names).
- Always run `npm run verify` (format + lint + css + types + tests + build) before considering work done; `npm run test:e2e` catches browser-only regressions.
- After style/JS changes, run `npm run build` to update the standalone bundle and bump `CACHE_VERSION` in `sw.js` (it is cache-first).
