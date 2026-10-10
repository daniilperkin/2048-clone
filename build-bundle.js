#!/usr/bin/env node
/**
 * Build script: produces a single self-contained 2048.html with all
 * JS inlined and CSS inlined (vendor prefixes stripped).
 *
 * Usage:  node build-bundle.js
 * Output: 2048.html  (in the repo root)
 *
 * The page shell (the <body> markup) is extracted from index.html — the
 * single source of truth — so a control added there can never be silently
 * missing from the bundle. The <head> stays hand-written here because the
 * bundle must not reference external files (favicon, apple-touch icons),
 * and the CSS/JS are replaced by inlined copies.
 *
 * The generated file is what gets copied into SPRINTSTART's
 * public/easter-eggs/ folder — one file, no external requests.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

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
  "js/stats.js",
  "js/share.js",
  "js/html_actuator.js",
  "js/game_manager.js",
  "js/application.js",
];

// ─── JS: strip ESLint directives, concat ──────────────────────
export function bundleJs() {
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
export function bundleCss() {
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

// ─── Shell: the page markup comes from index.html ─────────────
export function extractShell() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const match = html.match(/<body>([\s\S]*)<\/body>/);
  if (!match) throw new Error("index.html has no <body> — cannot extract the bundle shell");

  // Drop the <script src> tags: the bundle replaces them with one inline
  // <script>. Everything else (noscript, controls, board) ships verbatim.
  const shell = match[1].replace(/[ \t]*<script[\s\S]*?<\/script>\s*/g, "").trim();

  // One file, zero network requests: any external reference is a hard
  // failure here rather than a silent 404 at runtime.
  const external = shell.match(/(?:src|href)="(?!data:|#)[^"]*"/g);
  if (external) {
    throw new Error(`Shell would reference external files: ${external.join(", ")}`);
  }
  return shell;
}

// ─── HTML: the shell with inlined <style> and <script> ────────
export function buildHtml() {
  const js = bundleJs();
  const css = bundleCss();
  const shell = extractShell();

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
${shell}

    <script>
${js}
    </script>
  </body>
</html>
`;
}

export function main() {
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
}

// Run only when executed directly (`node build-bundle.js`); importing the
// functions from tests must not trigger a build.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
