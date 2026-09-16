import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DOODLE_TILES } from "../tools/tile-art.config.mjs";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "style", "main.css"), "utf8");

/** Relative luminance per WCAG 2.1. */
function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * The doodle theme spans three files that must agree:
 *   - tools/tile-art.config.mjs  → the palette the art generator draws with
 *   - js/themes.js               → the colours applied to tiles at runtime
 *   - style/main.css             → the per-value background-image rules
 * These tests keep them from drifting apart, which is the whole risk of
 * generating art at build time.
 */
describe("doodle tile art wiring", () => {
  const theme = new ThemeManager().themes.doodle;
  const values = Object.keys(DOODLE_TILES).map(Number);

  it("palette in tile-art.config.mjs matches the theme in themes.js", () => {
    for (const value of values) {
      const art = DOODLE_TILES[value];
      const themed = value === 4096 ? theme.superColor : theme.colors[value];
      expect(themed, `themes.js has no doodle colour for ${value}`).toBeTruthy();
      expect({ bg: themed.bg, fg: themed.fg }, `doodle colour drift at ${value}`).toEqual({
        bg: art.bg,
        fg: art.fg,
      });
    }
  });

  it("declares every themed value in the theme's colours", () => {
    const themed = Object.keys(theme.colors)
      .map(Number)
      .sort((a, b) => a - b);
    const palette = values.filter((v) => v !== 4096).sort((a, b) => a - b);
    expect(themed).toEqual(palette);
  });

  it("every generated tile clears WCAG AA body-text contrast (4.5:1)", () => {
    for (const value of values) {
      const { bg, fg } = DOODLE_TILES[value];
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `tile ${value} is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("has exactly one background-image rule per themed value, pointing at its own sketch", () => {
    const rules = [...CSS.matchAll(/\.tile\.tile-(\d+)\s+\.tile-inner\s*\{[^}]*url\("([^"]+)"\)/g)];
    const byValue = Object.fromEntries(rules.map(([, value, url]) => [Number(value), url]));

    for (const value of values) {
      const url = byValue[value];
      expect(url, `style/main.css has no doodle art rule for tile-${value}`).toBeTruthy();
      expect(url).toMatch(new RegExp(`tile-${value}\\.svg$`));
    }
    expect(rules.length).toBe(values.length);
  });
});
