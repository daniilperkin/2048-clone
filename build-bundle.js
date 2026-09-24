#!/usr/bin/env node
/**
 * Build script: produces a single self-contained 2048.html with all
 * JS inlined and CSS inlined (vendor prefixes stripped).
 *
 * Usage:  node build-bundle.js
 * Output: 2048.html  (in the repo root)
 *
 * The generated file is what gets copied into SPRINTSTART's
 * public/easter-eggs/ folder — one file, no external requests.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Load order matters: each file's classes are referenced by later files.
const JS_FILES = [
  "js/directions.js",
  "js/themes.js",
  "js/view_transitions.js",
  "js/sound_manager.js",
  "js/keyboard_input_manager.js",
  "js/tile.js",
  "js/random.js",
  "js/grid.js",
  "js/local_storage_manager.js",
  "js/html_actuator.js",
  "js/game_manager.js",
  "js/application.js",
];

// ─── JS: strip ESLint directives, concat ──────────────────────
function bundleJs() {
  return JS_FILES.map((rel) => {
    const fullPath = path.join(ROOT, rel);
    let src = fs.readFileSync(fullPath, "utf8");
    // Strip `/* exported X */` and `/* global X */` lines — they're
    // ESLint hints for the multi-file setup, meaningless in a bundle.
    src = src.replace(/^\/\*\s*(exported|global)\s+.*?\*\/\s*\n/gm, "");
    // Collapse the file header comment to a section divider.
    return `// ─── ${rel} ─────────────────────────────────────────\n${src.trim()}\n`;
  }).join("\n\n");
}

// ─── CSS: strip vendor prefixes, drop @import, system fonts ───
function bundleCss() {
  const cssPath = path.join(ROOT, "style", "main.css");
  let css = fs.readFileSync(cssPath, "utf8");

  // Drop the @import for the Clear Sans webfont — we use system fonts.
  css = css.replace(/@import\s+url\([^)]+\);\s*/g, "");

  // Strip every line that declares a vendor-prefixed property,
  // keeping only the standard property that follows it.
  // Matches: -webkit-*, -moz-*, -ms-*, -o-* (declarations only, not @-rules).
  css = css.replace(/^\s*-webkit-[^;]+;\s*\n/gm, "");
  css = css.replace(/^\s*-moz-[^;]+;\s*\n/gm, "");
  css = css.replace(/^\s*-ms-[^;]+;\s*\n/gm, "");
  css = css.replace(/^\s*-o-[^;]+;\s*\n/gm, "");

  // Strip vendor-prefixed @keyframes blocks (@-webkit-keyframes, @-moz-keyframes).
  // Keyframe names can contain hyphens (move-up, fade-in), so match [\w-]+.
  // The standard @keyframes block that follows is what we keep.
  css = css.replace(/@-webkit-keyframes\s+[\w-]+\s*\{[\s\S]*?^\}\s*/gm, "");
  css = css.replace(/@-moz-keyframes\s+[\w-]+\s*\{[\s\S]*?^\}\s*/gm, "");

  // Collapse runs of blank lines.
  css = css.replace(/\n{3,}/g, "\n\n");

  // Inline the generated doodle tile sketches as data URIs. The shipped
  // single file must make zero network requests, so a missing tile is a
  // hard failure here rather than a silent 404 at runtime.
  let inlinedTiles = 0;
  css = css.replace(/url\((?:"|')?([^"')]+\.svg)(?:"|')?\)/g, (match, rel) => {
    const file = path.resolve(path.join(ROOT, "style"), rel);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing tile art "${rel}" — run: node tools/generate-tiles.mjs`);
    }
    const svg = fs.readFileSync(file, "utf8");
    inlinedTiles += 1;
    return `url("data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}")`;
  });

  // Nothing may point at an external file once we ship as one document.
  const externalRefs = css.match(/url\((?!["']?data:)[^)]*\)/g);
  if (externalRefs) {
    throw new Error(`Bundle would reference external files: ${externalRefs.join(", ")}`);
  }

  console.error(`  tiles inlined: ${inlinedTiles}`);

  return css.trim();
}

// ─── HTML: the shell with inlined <style> and <script> ────────
function buildHtml() {
  const js = bundleJs();
  const css = bundleCss();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>2048</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <noscript>
      <p style="text-align: center; margin: 2em; font-family: system-ui, sans-serif">
        2048 requires JavaScript to run. Please enable JavaScript in your browser
        settings to play.
      </p>
    </noscript>
    <div class="container">
      <div class="heading">
        <div class="scores-container" role="group" aria-label="Scores">
          <div class="score-container" role="status" aria-label="Current score">0</div>
          <div class="best-container" role="status" aria-label="Best score">0</div>
        </div>
      </div>

      <div class="above-game">
        <div class="above-game-controls">
          <select class="theme-select" aria-label="Change tile theme"></select>
          <button class="sound-toggle" type="button" aria-pressed="false" aria-label="Sound effects"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 9h3.2L11.5 6v12L7.2 15H4z" fill="currentColor"/><path class="sound-waves" d="M15.2 8.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="sound-slash" d="M4.5 19.5 19.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          <a class="restart-button" href="#" role="button" aria-label="Start a new game">New Game</a>
        </div>
      </div>

      <div class="game-container" role="grid" aria-label="2048 game board">
        <div class="game-message" role="alert" aria-live="assertive" aria-atomic="true">
          <p></p>
          <div class="lower">
            <a class="keep-playing-button" href="#" role="button" aria-label="Keep playing after winning">Keep going</a>
            <a class="retry-button" href="#" role="button" aria-label="Start a new game">Try again</a>
          </div>
        </div>

        <div class="grid-container">
          <div class="grid-row" role="row">
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
          </div>
          <div class="grid-row" role="row">
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
          </div>
          <div class="grid-row" role="row">
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
          </div>
          <div class="grid-row" role="row">
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
            <div class="grid-cell" role="gridcell"></div>
          </div>
        </div>

        <div class="tile-container"></div>
      </div>
    </div>

    <script>
${js}
    </script>
  </body>
</html>
`;
}

// The doodle theme's tile art is generated, not committed — regenerate it
// before every bundle so `npm run build` is self-contained and the art can
// never lag behind the palette in tools/tile-art.config.mjs.
execFileSync(process.execPath, [path.join(ROOT, "tools", "generate-tiles.mjs")], {
  stdio: "inherit",
});

const html = buildHtml();
const outPath = path.join(ROOT, "2048.html");
fs.writeFileSync(outPath, html, "utf8");

const sizeKb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`✓ Built 2048.html (${sizeKb} KB)`);
