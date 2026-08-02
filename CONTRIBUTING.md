# Contributing

Changes and improvements are more than welcome! Feel free to fork and open a pull request.

Please follow the house rules to have a bigger chance of your contribution being merged.

## House rules

### How to make changes

- Create a new branch based on `main` and make your changes there, then open a Pull Request back to `main`.
- If you want to modify the CSS, edit `style/main.css` directly. This file is hand-maintained (flexbox layout, system fonts).
- To generate the single-file bundle (`2048.html`), run `node build-bundle.js`. This inlines all JS and CSS into a standalone HTML file. The bundle is **not** tracked in git — regenerate it at deploy time.
- Please use 2-space indentation when editing the JavaScript.
- Linting and formatting are enforced via **ESLint 10** (flat config) and **Prettier 3**. Run `npm run lint` and `npm run format:check` before submitting.
- Unit tests use **Vitest + jsdom**. Run `npm test` to verify your changes.
- Please test your modification thoroughly before submitting your Pull Request.

### Pre-commit checklist

```bash
npm install
npm run lint
npm run format:check
npm test
node build-bundle.js
```

All of the above must pass cleanly before a PR will be merged.

### Changes that might not be accepted

We have to be conservative with the core game. This means that some modifications won't be merged, or will have to be evaluated carefully before being merged:

- Undo/redo features
- Save/reload features
- Changes to how the tiles look or their contents
- Changes to the layout
- Changes to the grid size

### Changes that are welcome

- Bug fixes
- Compatibility improvements
- "Under the hood" enhancements
- New theme definitions (see `js/themes.js`)
- Small changes that don't have an impact on the core gameplay
