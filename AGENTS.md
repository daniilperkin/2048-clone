# AGENTS.md — 2048-clone

Modernized, single-page 2048 game fork: five themes with a swatch picker, three-state dark mode,
colour-blind tile patterns, 3×3 / 4×4 / 5×5 boards with per-size saves and records, a local top-5
leaderboard and daily streak, undo, a daily seeded challenge, shareable results, lifetime stats,
moves counter and timer, offline (PWA) support, a single-file HTML bundle, and a
Vitest + Playwright suite with type-checking, ESLint, stylelint and Prettier all enforced in CI.
Public: https://github.com/daniilperkin/2048-clone · play: https://daniilperkin.github.io/2048-clone/

## Tech Stack & Architecture

- **Runtime**: Vanilla JavaScript (plain `<script>` tags, shared global scope — no ES modules; Node 22.22.2+ for tooling — the jsdom test environment requires it)
- **Testing**: Vitest (`vitest run`) for logic and DOM under jsdom, plus one Playwright Chromium smoke test (`npm run test:e2e`) for what jsdom cannot see — layout, timing, real browser APIs
- **Type-checking**: `tsc -p config/jsconfig.json` (`checkJs`, strict off) over the plain-JS sources; they are classic scripts, so one program sees every global class and no ambient declarations are needed
- **Tooling configs**: everything lives in `config/` (eslint, vitest, playwright, jsconfig, prettier, stylelint) and each npm script passes an explicit `--config` path — add the flag when invoking a tool directly
- **Linting & Formatting**: ESLint 10 (`npm run lint`), stylelint (`npm run lint:css`), Prettier 3 (`npm run format` / `npm run format:check`)
- **Bundler**: `build-bundle.js` (inlines all CSS, JS, and assets into standalone `2048.html`; `test/bundle.test.js` enforces a 200 KB budget)
- **Coverage**: `npm run coverage` gates lines/functions/statements ≥ 90 and branches ≥ 85
- **Release**: pushing a `v*` tag runs `release.yml` (gate + build) and attaches `2048.html` to a GitHub Release; Pages deploys `main` automatically

The game files intentionally avoid ESM imports: `index.html` loads them via
`<script>` tags in dependency order, they communicate through a shared global
scope, and `test/setup.js` replicates that by evaluating the sources. Do not
"modernize" to ES modules without reworking all three of those pieces together.

Adding a game script means registering it in **four** places, each in a valid
dependency order (the lists currently differ in order; `test/setup.js` omits
`js/application.js`): `index.html`, `JS_FILES` in `build-bundle.js`,
`GAME_FILES` in `test/setup.js` (plus `GLOBAL_CLASSES` there if tests need to
reach its class or instance), and `APP_SHELL` in `sw.js` — the offline
precache list, which `test/pwa.test.js` fails on when a file referenced by
`index.html` is missing there.

`build-bundle.js` extracts the page shell (the `<body>` markup) from
`index.html` at build time — `index.html` is the single source of truth, so a
control added there reaches the bundle automatically. The bundle's `<head>` is
hand-written and must stay free of external references (favicon, apple-touch
icons, manifest). `test/bundle.test.js` guards both properties: every class
used in `index.html`'s body must appear in the built shell, and the shell must
make no external requests.

`manifest.webmanifest` + `sw.js` make the multi-file build installable and
offline-capable after the first visit; the page registers the worker only when
the manifest link is present, so the single-file bundle stays untouched. `sw.js`
is **cache-first** for the shell: bump `CACHE_VERSION` (currently `v5`) whenever
a shell file changes, or browsers keep serving the old JS/CSS. The committed PWA
icons (`meta/icon-*.png`) are regenerated with `npm run icons`
(`tools/make-icons.mjs`, a zlib-only PNG writer — no image dependencies).

### State that lives in localStorage

Every key is prefixed `2048-`. Board size is the axis that changes key names:

- `2048-size` (`3` | `4` | `5`), and `sizeSuffix()` appends `-3` / `-5` to the
  per-size keys; 4×4 keeps the original unsuffixed names, so old saves and
  records survive untouched.
- Per-size: `2048-best-score[-N]`, `2048-daily-best[-N]`, `2048-game-state[-N]`,
  `2048-daily-state[-N]`, `2048-leaderboard-classic[-N]`, `2048-leaderboard-daily[-N]`.
- Global: `2048-mode`, `2048-sound`, `2048-stats`, `2048-daily-streak`,
  `2048-hint-seen`, `2048-theme`, and the preference flags `2048-dark`
  (`0`/`1`/`auto`), `2048-motion`, `2048-ambience`, `2048-patterns`, `2048-celebrate`.

`GameManager.applySnapshot()` throws on a save whose grid size differs from the
live board, so a hand-edited or cross-size save starts a fresh game instead of
loading mismatched geometry.

### Behaviour contracts worth keeping

- **Undo is undo-aware for records**: `GameManager` stores `statsPrevious` and
  `leaderboardPrevious` in each snapshot, so taking back the move that ended a
  game rolls the stat, the streak and the leaderboard entry back.
- **Game keys never fight the UI**: `KeyboardInputManager` ignores move/undo/
  restart keys while focus is inside `[role="listbox"]`, `.settings-panel` or
  `.stats-panel`. The theme picker is a listbox (not a `<select>`), so this guard
  is what stops an open dropdown from moving tiles.
- **The page zoom is fitted at runtime** (`fitPageZoom()` in `application.js`):
  the CSS `zoom: 1.25` is only the no-JS default and the upper bound; the fit
  measures the body's scroll box and the widest in-flow child, then corrects
  against `documentElement.scrollHeight`. Phones opt out below 540px and use
  `--board-scale` instead.
- **Panels and the picker**: Escape closes, clicking outside closes, focus
  returns to the toggle; radiogroups use a roving tabindex with arrow-key focus
  (selection stays on Enter/Space because changing the board size starts a game).

### Commands

```bash
npm install          # deps
npm start            # dev server on 8080 (runs the tile-art generator first)
npm test             # Vitest + jsdom (261 tests)
npm run coverage     # tests + coverage thresholds
npm run typecheck    # tsc -p config/jsconfig.json
npm run lint         # ESLint 10 (flat config in config/)
npm run lint:css     # stylelint
npm run format       # Prettier (config/.prettierrc.json)
npm run build        # regenerate 2048.html
npm run test:e2e     # Playwright Chromium smoke test (port 8090)
npm run verify       # format:check + lint + lint:css + typecheck + test + build
```
