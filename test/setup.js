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
import { pathToFileURL } from "node:url";

const GAME_FILES = [
  "js/directions.js",
  "js/tile.js",
  "js/random.js",
  "js/grid.js",
  "js/local_storage_manager.js",
  "js/stats.js",
  "js/share.js",
  "js/preferences.js",
  "js/themes.js",
  "js/view_transitions.js",
  "js/sound_manager.js",
  "js/keyboard_input_manager.js",
  "js/game_manager.js",
  "js/html_actuator.js",
];

// Class names that should be globally accessible after loading
const GLOBAL_CLASSES = [
  "DIRECTIONS",
  "Tile",
  "SeededRandom",
  "Grid",
  "LocalStorageManager",
  "StatsTracker",
  "ShareResult",
  "Preferences",
  "preferences",
  "ThemeManager",
  "themeManager",
  "ViewTransitions",
  "SoundManager",
  "soundManager",
  "KeyboardInputManager",
  "GameManager",
  "HTMLActuator",
];

let loaded = false;

export function loadGameFiles() {
  if (loaded) return;
  for (const file of GAME_FILES) {
    const filePath = resolve(process.cwd(), file);
    let source = readFileSync(filePath, "utf-8");
    // Append explicit global assignments so class declarations
    // are accessible from test files via globalThis.
    for (const cls of GLOBAL_CLASSES) {
      source += `\nif (typeof ${cls} !== "undefined") globalThis.${cls} = ${cls};\n`;
    }
    evalWithSourceUrl(source, filePath);
  }
  loaded = true;
}

/**
 * Evaluate js/application.js — the bootstrap runs immediately on load and
 * needs a mounted DOM, so it is deliberately not part of GAME_FILES; the
 * bootstrap test loads it explicitly after building its fixtures.
 */
export function loadApplication() {
  const filePath = resolve(process.cwd(), "js/application.js");
  evalWithSourceUrl(readFileSync(filePath, "utf-8"), filePath);
}

/**
 * Attribute evaluated code to its real path so V8 coverage
 * (npm run coverage) maps it to js/** instead of an anonymous eval.
 */
function evalWithSourceUrl(source, filePath) {
  source += `\n//# sourceURL=${pathToFileURL(filePath).href}`;
  (0, eval)(source);
}
