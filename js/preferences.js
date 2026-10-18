/* exported Preferences, preferences */

/**
 * Player preferences that are not part of the game state: dark mode,
 * animations, animated ambience, tile patterns and end-of-game
 * celebrations.
 *
 * Dark mode is three-state — "off" / "on" / "auto" — where "auto" follows
 * the OS `prefers-color-scheme` and reacts to changes live. The resolved
 * boolean stays on `dark` so the CSS contract (body.dark) is unchanged.
 *
 * Persisted under namespaced `2048-<name>` flags (see
 * LocalStorageManager.getFlag/setFlag/getFlagValue); applied to the page
 * as body classes so the CSS does the actual work. All visual effects
 * default OFF — the page is calm until the player opts in; only `motion`
 * defaults ON (animations are the baseline experience).
 */
class Preferences {
  constructor() {
    this.storage = null;
    this.darkMode = "off";
    this.dark = false;
    this.systemDark = false;
    this.mediaQuery = null;
    this.motion = true;
    this.ambience = false;
    this.celebrate = false;
    this.patterns = false;
  }

  /** Wire in the storage manager so preferences persist across reloads. */
  attachStorage(storageManager) {
    this.storage = storageManager;
    // Read defensively (mirrors soundManager): a storage manager that
    // predates the flags leaves the defaults in place.
    if (typeof storageManager.getFlag === "function") {
      const storedDark =
        typeof storageManager.getFlagValue === "function"
          ? storageManager.getFlagValue("dark", "off")
          : "off";
      this.darkMode = this.normalizeDarkMode(storedDark);
      this.motion = storageManager.getFlag("motion", true);
      this.ambience = storageManager.getFlag("ambience", false);
      this.celebrate = storageManager.getFlag("celebrate", false);
      this.patterns = storageManager.getFlag("patterns", false);
    }
    this.watchSystem();
    this.resolveDark();
  }

  /** Migrate the old boolean flags ("1"/"0") into the three-state model. */
  normalizeDarkMode(value) {
    if (value === "auto") return "auto";
    if (value === "1" || value === "on" || value === true) return "on";
    return "off";
  }

  /** Track the OS colour scheme so "auto" can follow it live. */
  watchSystem() {
    if (this.mediaQuery || typeof matchMedia === "undefined") return;
    try {
      this.mediaQuery = matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return; // exotic environments without matchMedia
    }
    const update = () => {
      this.systemDark = Boolean(this.mediaQuery.matches);
      if (this.darkMode === "auto") {
        this.resolveDark();
        this.apply();
      }
    };
    update();
    if (typeof this.mediaQuery.addEventListener === "function") {
      this.mediaQuery.addEventListener("change", update);
    } else if (typeof this.mediaQuery.addListener === "function") {
      this.mediaQuery.addListener(update);
    }
  }

  /** Recompute the resolved dark flag from the three-state setting. */
  resolveDark() {
    this.dark = this.darkMode === "on" || (this.darkMode === "auto" && this.systemDark);
    return this.dark;
  }

  /** True when the player turned animations off. */
  reduceMotion() {
    return !this.motion;
  }

  /** Switch dark mode between off / on / auto, persist and apply it. */
  setDarkMode(mode) {
    this.darkMode = ["off", "on", "auto"].includes(mode) ? mode : "off";
    if (this.storage && typeof this.storage.setFlagValue === "function") {
      const stored = this.darkMode === "on" ? "1" : this.darkMode === "off" ? "0" : "auto";
      this.storage.setFlagValue("dark", stored);
    }
    this.resolveDark();
    this.apply();
  }

  /** Flip one boolean preference, persist it and mirror it onto the page. */
  set(name, value) {
    if (name === "dark") {
      // Backwards-compatible boolean entry point (tests, older callers).
      this.setDarkMode(value ? "on" : "off");
      return;
    }
    if (!["motion", "ambience", "celebrate", "patterns"].includes(name)) return;
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
    body.classList.toggle("patterns", this.patterns);
    // Keep the browser/OS chrome (address bar, task switcher) in step.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", this.dark ? "#17171f" : "#faf8ef");
  }
}

/** Single shared instance — the Settings panel and the game must agree. */
const preferences = new Preferences();
