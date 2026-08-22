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
