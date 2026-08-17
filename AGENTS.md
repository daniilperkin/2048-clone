# AGENTS.md — 2048-mine

Modernized, single-page 2048 game fork with theme switcher, accessibility (WCAG 2.1 AA), single-file HTML bundler, and Vitest test suite.

## Tech Stack & Architecture

- **Runtime**: Vanilla JavaScript (ES Modules, Node 20+)
- **Testing**: Vitest (`vitest run`)
- **Linting & Formatting**: ESLint 10 (`eslint .`), Prettier 3 (`prettier --check .`)
- **Bundler**: `build-bundle.js` (inlines all CSS, JS, and assets into standalone `2048.html`)

## Directory Layout

```
2048-mine/
├── js/               # Game logic (game_manager.js, grid.js, tile.js, keyboard_input_manager.js, html_actuator.js)
├── style/            # CSS styling and color palettes
├── test/             # Vitest test suite
├── index.html        # Development entrypoint
├── 2048.html         # Self-contained bundled single-file build
├── build-bundle.js   # Single-file HTML bundler script
└── package.json
```

## Commands

| Purpose | Command |
|---|---|
| Run tests | `npm test` |
| Lint code | `npm run lint` |
| Format check | `npm run format:check` |
| Build standalone single-file | `npm run build` |
| Local preview | `npm start` (serves at `http://localhost:8080`) |

## Development Rules

1. Keep game logic decoupled from DOM manipulation (`HTMLActuator`).
2. Run `npm test` and `npm run lint` before committing any changes.
3. After changing styles or JS, run `npm run build` to update the standalone `2048.html` bundle.
