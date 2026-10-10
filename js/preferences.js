/* exported Preferences, preferences */

/**
 * Player preferences that are not part of the game state: dark mode,
 * animations, animated ambience and end-of-game celebrations.
 *
 * Persisted under namespaced `2048-<name>` flags (see
 * LocalStorageManager.getFlag/setFlag); applied to the page as body
 * classes so the CSS does the actual work. All visual effects default
 * OFF — the page is calm until the player opts in; only `motion`
 * defaults ON (animations are the baseline experience).
 *
 * Loaded before the game scripts whitelist in every list (index.html,
 * build-bundle.js, test/setup.js, sw.js) — a new game file registration
 * situation, see AGENTS.md.
 */
class Preferences {
  constructor() {
    this.storage = null;
    this.dark = false;
    this.motion = true;
    this.ambience = false;
    this.celebrate = false;
  }

  /** Wire in the storage manager so preferences persist across reloads. */
  attachStorage(storageManager) {
    this.storage = storageManager;
    // Read defensively (mirrors soundManager): a storage manager that
    // predates the flags leaves the defaults in place.
    if (typeof storageManager.getFlag === "function") {
      this.dark = storageManager.getFlag("dark", false);
      this.motion = storageManager.getFlag("motion", true);
      this.ambience = storageManager.getFlag("ambience", false);
      this.celebrate = storageManager.getFlag("celebrate", false);
    }
  }

  /** True when the player turned animations off. */
  reduceMotion() {
    return !this.motion;
  }

  /** Flip one preference, persist it and mirror it onto the page. */
  set(name, value) {
    if (!["dark", "motion", "ambience", "celebrate"].includes(name)) return;
    this[name] = Boolean(value);
    if (this.storage && typeof this.storage.setFlag === "function") {
      this.storage.setFlag(name, this[name]);
    }
    this.apply();
  }

  /** Mirror every preference onto the page (body classes + theme-color). */
  apply() {
    if (typeof document === "undefined" || !document.body) return;
    const body = document.body;
    body.classList.toggle("dark", this.dark);
    body.classList.toggle("reduced-motion", !this.motion);
    body.classList.toggle("ambience-on", this.ambience);
    // Keep the browser/OS chrome (address bar, task switcher) in step.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", this.dark ? "#17171f" : "#faf8ef");
  }
}

/** Single shared instance — the Settings panel and the game must agree. */
const preferences = new Preferences();
