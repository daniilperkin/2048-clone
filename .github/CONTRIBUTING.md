# Contributing

Changes and improvements are more than welcome! Feel free to fork and open a pull request.

Please follow the house rules to have a bigger chance of your contribution being merged.

## House rules

### How to make changes

- Create a new branch based on `main` and make your changes there, then open a Pull Request back to `main`.
- If you want to modify the CSS, edit `style/main.css` directly. This file is hand-maintained (flexbox layout, system fonts).
- To generate the single-file bundle (`2048.html`), run `node build-bundle.js`. This inlines all JS and CSS into a standalone HTML file. The bundle is **not** tracked in git — regenerate it at deploy time.
- Please use 2-space indentation when editing the JavaScript.
- All tool configs live in `config/` (ESLint, Vitest, Playwright, tsc, Prettier, stylelint); the npm scripts pass the right `--config` path, so prefer `npm run …` over calling a tool directly.
- Linting, formatting and types are enforced: `npm run lint`, `npm run lint:css`, `npm run format:check` and `npm run typecheck`. Run `npm run format` before `npm run lint` to keep the diff clean.
- Unit tests use **Vitest + jsdom** (`npm test`, coverage gate in `npm run coverage`); one Playwright smoke test covers what jsdom cannot see (`npm run test:e2e`).
- Please test your modification thoroughly before submitting your Pull Request.

### Pre-commit checklist

```bash
npm install
npm run verify      # format:check + lint + lint:css + typecheck + test + build
npm run test:e2e    # Chromium smoke test
```

All of the above must pass cleanly before a PR will be merged. CI runs the same gate on every push.

### Changes that might not be accepted

We have to be conservative with the core game. This means that some modifications won't be merged, or will have to be evaluated carefully before being merged:

- Changes to how the tiles look or their contents
- Changes to the layout
- Changes to the default board size or the 3×3 / 4×4 / 5×5 geometry rules (the sizes themselves are a shipped setting)

### Changes that are welcome

- Bug fixes
- Compatibility improvements
- "Under the hood" enhancements
- New theme definitions (see `js/themes.js`)
- Small changes that don't have an impact on the core gameplay
