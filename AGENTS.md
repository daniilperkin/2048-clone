# AGENTS.md — 2048-mine

Modernized, single-page 2048 game fork with theme switcher, accessibility (WCAG 2.1 AA), lifetime stats, shareable results, offline (PWA) support, single-file HTML bundler, and Vitest test suite.

## Tech Stack & Architecture

- **Runtime**: Vanilla JavaScript (plain `<script>` tags, shared global scope — no ES modules; Node 22.22.2+ for tooling — the jsdom test environment requires it)
- **Testing**: Vitest (`vitest run`) for logic and DOM under jsdom, plus one Playwright Chromium smoke test (`npm run test:e2e`) for what jsdom cannot see — layout, timing, real browser APIs
- **Type-checking**: `tsc -p jsconfig.json` (`checkJs`, strict off) over the plain-JS sources; they are classic scripts, so one program sees every global class and no ambient declarations are needed
- **Linting & Formatting**: ESLint 10 (`eslint .`), stylelint (`style/**/*.css`), Prettier 3 (`prettier --check .`)
- **Bundler**: `build-bundle.js` (inlines all CSS, JS, and assets into standalone `2048.html`)

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
the manifest link is present, so the single-file bundle stays untouched. Bump
`CACHE_VERSION` in `sw.js` whenever shell files change. The committed PWA icons
(`meta/icon-*.png`) are regenerated with `npm run icons`
(`tools/make-icons.mjs`, a zlib-only PNG writer — no image dependencies).
