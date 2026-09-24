# 2048-mine

A modernized fork of [2048](https://github.com/gabrielecirulli/2048), originally based on [1024](https://play.google.com/store/apps/details?id=com.veewo.a1024) and [Saming's 2048](http://saming.fr/p/2048/), indirectly inspired by [Threes](https://asherv.com/threes/).

## What's different

This fork modernizes the original game with:

- **ES6+ code** — classes, `const`/`let`, arrow functions, template literals
- **Theme system** — five built-in themes (Classic, Developer, Agile, Fibonacci, Doodle) with custom tile labels, colors, and win thresholds. Themes are selectable at runtime and persisted to `localStorage`.
- **Accessibility** — ARIA grid roles, `aria-live` for game messages, `:focus-visible` styles
- **Single-file bundling** — `node build-bundle.js` produces a standalone `2048.html` with all JS and CSS inlined, for embedding as an easter egg in other projects
- **ESLint 10 + Prettier 3** — modern flat config linting and formatting
- **Undo** — take back up to 10 moves (button, **U** or **Ctrl/Cmd+Z**); history survives a reload
- **Daily Challenge** — one seeded board per calendar day, identical for every player, with its own best score
- **Vitest test suite** — 140+ tests covering game logic, input, rendering, storage, sound and the seeded RNG
- **Namespaced localStorage** — keys are prefixed with `2048-` to avoid collisions on host pages

## Playing

```bash
npm install
npm start
```

Then open http://localhost:8080 in your browser.

### Controls

- **Arrow keys** / **WASD** / **Vim keys (hjkl)** — move tiles
- **R** — restart the game
- **U** / **Ctrl+Z** / **Cmd+Z** — undo the last move
- **Touch swipes** — move tiles on mobile devices

### Themes

Use the theme selector at the top of the page. Each theme has unique tile labels and a different win threshold:

| Theme     | Win Threshold | Tile Labels                           |
| --------- | ------------- | ------------------------------------- |
| Classic   | 2048          | Numbers (2, 4, 8, … 2048)             |
| Developer | 64            | Intern → Junior → … → Principal       |
| Agile     | 128           | Backlog → Ticket → … → Deployed       |
| Fibonacci | 128           | Fibonacci sequence (1, 2, 3, 5, … 21) |
| Doodle    | 2048          | Numbers on hand-drawn SVG tile art    |

Tiles past the last defined label get a roman-numeral suffix (e.g. "Deployed ii", "Deployed iii").

## Building the single-file bundle

```bash
node build-bundle.js
```

This produces `2048.html` — a standalone file with all JavaScript and CSS inlined (Doodle tile SVGs embedded as data URIs; the build runs `tools/generate-tiles.mjs` first). The file is gitignored and should be regenerated at deploy time.

## Development

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm

### Setup

```bash
npm install
```

### Available scripts

| Script                 | Description                           |
| ---------------------- | ------------------------------------- |
| `npm start`            | Generate tile art, then serve on 8080 |
| `npm run tiles`        | Generate Doodle tile SVGs in `build/` |
| `npm run build`        | Generate the single-file `2048.html`  |
| `npm run lint`         | Run ESLint                            |
| `npm run lint:fix`     | Run ESLint with auto-fix              |
| `npm run format`       | Format all files with Prettier        |
| `npm run format:check` | Check formatting without writing      |
| `npm test`             | Run the Vitest test suite             |

### Project structure

```
2048-mine/
├── index.html              # Dev entry — loads 12 separate <script> tags
├── build-bundle.js         # Single-file bundler (inlines JS + CSS)
├── js/                     # Game source (plain scripts, shared global scope)
│   ├── directions.js       # Shared direction contract (UP/RIGHT/DOWN/LEFT)
│   ├── themes.js           # ThemeManager + 5 theme definitions
│   ├── keyboard_input_manager.js
│   ├── random.js           # SeededRandom (mulberry32) for the Daily Challenge
│   ├── grid.js             # Grid model
│   ├── tile.js             # Tile value object
│   ├── local_storage_manager.js
│   ├── sound_manager.js    # Opt-in Web Audio merge/win/lose sounds
│   ├── view_transitions.js # View Transitions API wrapper
│   ├── html_actuator.js    # DOM renderer
│   ├── game_manager.js     # Controller: move/merge/win/lose logic
│   └── application.js      # Bootstrap
├── style/                  # main.css (hand-maintained)
├── test/                   # Vitest + jsdom test suite
├── tools/                  # generate-tiles.mjs (Doodle SVG art → build/tiles/, gitignored)
└── .github/workflows/ci.yml
```

## Credits

Original game by [Gabriele Cirulli](https://github.com/gabrielecirulli). See the upstream [repository](https://github.com/gabrielecirulli/2048) for the full contributor list.

## License

MIT — see [LICENSE.txt](LICENSE.txt).
