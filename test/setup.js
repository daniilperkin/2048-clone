/**
 * Test harness: load game JS files in the correct order into the jsdom
 * global scope so their classes are accessible without ESM imports.
 *
 * The game files use plain <script> tags and share a global scope.
 * We replicate that by reading the source and evaluating it, then
 * explicitly attaching class declarations to globalThis (class
 * declarations are lexically scoped and won't auto-attach to global).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GAME_FILES = ["js/tile.js", "js/grid.js", "js/local_storage_manager.js", "js/themes.js"];

// Class names that should be globally accessible after loading
const GLOBAL_CLASSES = ["Tile", "Grid", "LocalStorageManager", "ThemeManager", "themeManager"];

let loaded = false;

export function loadGameFiles() {
  if (loaded) return;
  for (const file of GAME_FILES) {
    const path = resolve(process.cwd(), file);
    let source = readFileSync(path, "utf-8");
    // Append explicit global assignments so class declarations
    // are accessible from test files via globalThis.
    for (const cls of GLOBAL_CLASSES) {
      source += `\nif (typeof ${cls} !== "undefined") globalThis.${cls} = ${cls};\n`;
    }
    (0, eval)(source);
  }
  loaded = true;
}
