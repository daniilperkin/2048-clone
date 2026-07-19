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
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Load order matters: each file's classes are referenced by later files.
const JS_FILES = [
  "js/themes.js",
  "js/keyboard_input_manager.js",
  "js/grid.js",
  "js/tile.js",
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

  // Swap Clear Sans for the system font stack.
  css = css.replace(
    /font-family:\s*"Clear Sans",\s*"Helvetica Neue",\s*Arial,\s*sans-serif;/g,
    'font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;',
  );

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
    <div class="container">
      <div class="heading">
        <h1 class="title">2048</h1>
        <div class="scores-container" role="group" aria-label="Scores">
          <div class="score-container" role="status" aria-label="Current score">0</div>
          <div class="best-container" role="status" aria-label="Best score">0</div>
        </div>
      </div>

      <div class="above-game">
        <p class="game-intro">Join the numbers and get to the <strong>2048 tile!</strong></p>
        <div class="above-game-controls">
          <select class="theme-select" aria-label="Change tile theme"></select>
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

        <div class="tile-container" aria-hidden="true"></div>
      </div>

      <p class="game-explanation">
        <strong class="important">How to play:</strong> Use your <strong>arrow keys</strong> to move the tiles. When two tiles with the same number touch, they <strong>merge into one!</strong>
      </p>
    </div>

    <script>
${js}
    </script>
  </body>
</html>
`;
}

const html = buildHtml();
const outPath = path.join(ROOT, "2048.html");
fs.writeFileSync(outPath, html, "utf8");

const sizeKb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`✓ Built 2048.html (${sizeKb} KB)`);
