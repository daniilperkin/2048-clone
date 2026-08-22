# GEMINI.md — 2048-mine

> **Single source of truth: [`AGENTS.md`](./AGENTS.md).**
> This file is a bridge for Gemini/Antigravity agents. Read `AGENTS.md` for the full project guide.

## Quick summary for Antigravity

| Topic       | Key info                                                                           |
| ----------- | ---------------------------------------------------------------------------------- |
| **Stack**   | Vanilla JavaScript (plain script tags, shared global scope), CSS, HTML5            |
| **Testing** | Vitest (`npm test`)                                                                |
| **Linting** | ESLint 10 (`eslint .`), Prettier 3 (`prettier --check .`)                          |
| **Build**   | `npm run build` → `build-bundle.js` inlines everything into standalone `2048.html` |
| **Dev**     | `npm start` serves on port 8080                                                    |

## Antigravity notes

- Game logic is in `js/` (decoupled from DOM via `HTMLActuator` in `js/html_actuator.js`).
- Always run `npm test` and `npm run lint` before considering work done.
- After style/JS changes, run `npm run build` to update the standalone bundle.
