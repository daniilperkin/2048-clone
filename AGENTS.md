# AGENTS.md — 2048-mine

Modernized, single-page 2048 game fork with theme switcher, accessibility (WCAG 2.1 AA), single-file HTML bundler, and Vitest test suite.

## Tech Stack & Architecture

- **Runtime**: Vanilla JavaScript (plain `<script>` tags, shared global scope — no ES modules; Node 20+ for tooling)
- **Testing**: Vitest (`vitest run`)
- **Linting & Formatting**: ESLint 10 (`eslint .`), Prettier 3 (`prettier --check .`)
- **Bundler**: `build-bundle.js` (inlines all CSS, JS, and assets into standalone `2048.html`)

The game files intentionally avoid ESM imports: `index.html` loads them via
`<script>` tags in dependency order, they communicate through a shared global
scope, and `test/setup.js` replicates that by evaluating the sources. Do not
"modernize" to ES modules without reworking all three of those pieces together.

Adding a game script means registering it in **three** places, each in a valid
dependency order (the lists currently differ in order; `test/setup.js` omits
`js/application.js`): `index.html`, `JS_FILES` in `build-bundle.js`, and
`GAME_FILES` in `test/setup.js` (plus `GLOBAL_CLASSES` there if tests need to reach its class or instance).

`build-bundle.js` extracts the page shell (the `<body>` markup) from
`index.html` at build time — `index.html` is the single source of truth, so a
control added there reaches the bundle automatically. The bundle's `<head>` is
hand-written and must stay free of external references (favicon, apple-touch
icons, manifest). `test/bundle.test.js` guards both properties: every class
used in `index.html`'s body must appear in the built shell, and the shell must
make no external requests.
