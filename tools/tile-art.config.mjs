/**
 * Doodle tile art palette — the generator's view of the "doodle" theme.
 *
 * WHY THIS FILE EXISTS: `js/themes.js` is a browser script with no exports, so
 * the build-time tile generator cannot read it. This file mirrors the doodle
 * theme's `colors` map; `test/doodle-tiles.test.js` asserts the two stay
 * identical, so `js/themes.js` remains the single source of truth for colour.
 *
 * `fg` doubles as the sketch stroke colour for that value's tile art.
 * Every pair below clears WCAG AA large-text contrast (>= 4.5:1 here, stricter
 * than the 3:1 the project requires for large bold text).
 */
export const TILE_SIZE = 107; // px — matches the desktop tile size in style/main.css

export const DOODLE_TILES = {
  2: { bg: "#f4efe4", fg: "#3b352c" },
  4: { bg: "#efe7d6", fg: "#3b352c" },
  8: { bg: "#e3d7bd", fg: "#332e26" },
  16: { bg: "#d9c9a6", fg: "#2f2a22" },
  32: { bg: "#cdb789", fg: "#2b2620" },
  64: { bg: "#bfa06a", fg: "#241f19" },
  128: { bg: "#6b4f17", fg: "#faf6ee" },
  256: { bg: "#5a4112", fg: "#f9f4ea" },
  512: { bg: "#4a350d", fg: "#f7f1e6" },
  1024: { bg: "#3b2a0a", fg: "#f5efe3" },
  2048: { bg: "#2c1f07", fg: "#f3ecdd" },
  // Overflow tiles (values past 2048) all render with the theme's superColor.
  4096: { bg: "#231806", fg: "#f0e7d5" },
};

/** Page/board paper tone for the doodle theme — used by the CSS layer.
 *  Matches the existing page background so the theme has no seam at the
 *  viewport edge; the board and cards carry the tone shift instead. */
export const DOODLE_PAPER = "#faf8ef";
