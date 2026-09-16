#!/usr/bin/env node
/**
 * Build-time tile art generator for the "doodle" theme.
 *
 * Emits one hand-drawn SVG per tile value into build/tiles/. The SVGs are
 * plain monochrome paths that the bundled CSS references as background-image;
 * build-bundle.js turns those references into data URIs, so the shipped
 * 2048.html still makes zero network requests.
 *
 * Deterministic: the same tile value always produces the same sketch, so
 * rebuilds are diff-free.
 *
 * Usage:  node tools/generate-tiles.mjs
 * Output: build/tiles/tile-<value>.svg
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { roughRoundedRect, scribbleFill } from "./vendor/rough.js";
import { DOODLE_PAPER, DOODLE_TILES, TILE_SIZE } from "./tile-art.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "build", "tiles");

const INSET = 3;
const STROKE = 2.2;

/** Stable per-value seed — same value, same sketch, on every build. */
function seedFor(value) {
  return (value * 7919 + 104729) >>> 0;
}

/**
 * Shrink a rough.js path for inlining.
 *
 * rough.js emits midpoint-smoothed quadratics with 2-decimal coordinates
 * ("Q17.16 2.06 22.00 2.49"), ~8 KB per tile. Every emitted Q pairs a control
 * point with the on-curve midpoint, so the control point can be dropped and the
 * curve read as a polyline through the same jittered points — visually
 * identical at 107 px, roughly a quarter of the bytes. Coordinates are then
 * rounded to whole pixels, which is invisible in a hand-drawn sketch.
 */
function compactPath(d) {
  return d
    .replace(/Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g, "L$3 $4")
    .replace(/-?\d+(?:\.\d+)?/g, (m) => String(Math.round(Number(m))));
}

function tileSvg(value, fg) {
  const seed = seedFor(value);
  const size = TILE_SIZE;

  // Primary outline. rough.js's own doubleStroke already draws two jittered
  // passes per call, so one call gives the "drawn twice" look.
  const outline = compactPath(
    roughRoundedRect(INSET, INSET, size - INSET * 2, size - INSET * 2, 7, {
      seed,
      roughness: 1.05,
    })
  );

  // Light hatch inside the tile, kept faint so the numeral stays dominant.
  const hatch = compactPath(
    scribbleFill(INSET + 7, INSET + 7, size - (INSET + 7) * 2, size - (INSET + 7) * 2, {
      seed: seed + 7,
      roughness: 1.15,
    })
  );

  const paths = [
    `<path d="${outline}" fill="none" stroke="${fg}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`,
  ];
  if (hatch) {
    paths.push(
      `<path d="${hatch}" fill="none" stroke="${fg}" stroke-width="0.9" stroke-linejoin="round" opacity="0.15"/>`
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="presentation">`,
    ...paths.map((p) => `  ${p}`),
    `</svg>`,
    ``,
  ].join("\n");
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const values = Object.keys(DOODLE_TILES)
    .map(Number)
    .sort((a, b) => a - b);
  let bytes = 0;

  for (const value of values) {
    const svg = tileSvg(value, DOODLE_TILES[value].fg);
    const file = path.join(OUT_DIR, `tile-${value}.svg`);
    fs.writeFileSync(file, svg, "utf8");
    bytes += Buffer.byteLength(svg);
  }

  // Art review page — not shipped, gitignored, for eyeballing the sketches.
  fs.writeFileSync(path.join(ROOT, "build", "tiles-preview.html"), previewHtml(values), "utf8");

  console.log(
    `tiles: ${values.length} sketches → build/tiles (${(bytes / 1024).toFixed(1)} KB raw, ` +
      `${values.join(", ")})`
  );
  console.log("preview: build/tiles-preview.html");
}

/** Grid + a mock board, on the doodle paper tone, for visual review. */
function previewHtml(values) {
  const tile = (value, size = TILE_SIZE) => {
    const { bg, fg } = DOODLE_TILES[value];
    const label = String(value);
    const fontPx = label.length <= 2 ? size * 0.42 : label.length <= 3 ? size * 0.34 : size * 0.27;
    return `<div class="tile" style="--tile-bg:${bg};--tile-fg:${fg};--tile-size:${size}px;--tile-font:${fontPx}px">
      <img src="tiles/tile-${value}.svg" alt="" />
      <span>${label}</span>
    </div>`;
  };

  const board = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2048, 4096],
    [8, 128, 2048, 2],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Doodle tile art — preview</title>
<style>
  body { margin: 0; padding: 32px; background: ${DOODLE_PAPER}; color: #3b352c;
         font-family: "Segoe Print", "Bradley Hand", cursive, system-ui; }
  h2 { font-size: 15px; letter-spacing: .08em; text-transform: uppercase; opacity: .6; margin: 0 0 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 32px; }
  .tile { position: relative; width: var(--tile-size); height: var(--tile-size);
          background: var(--tile-bg); border-radius: 7px;
          display: grid; place-items: center; }
  .tile img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .tile span { position: relative; color: var(--tile-fg); font-size: var(--tile-font);
               font-weight: 700; line-height: 1; }
  .board { display: grid; grid-template-columns: repeat(4, auto); gap: 12px;
           background: #e8e0cf; padding: 12px; border-radius: 10px; width: max-content; }
</style>
</head>
<body>
  <h2>Tiles, smallest → largest</h2>
  <div class="row">${values.map((v) => tile(v)).join("\n    ")}</div>
  <h2>Mock board</h2>
  <div class="board">${board
    .flat()
    .map((v) => tile(v))
    .join("\n    ")}</div>
</body>
</html>
`;
}

main();
