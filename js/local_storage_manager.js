// In-memory fallback used when window.localStorage is unavailable
// (e.g., Safari private mode or quota-exceeded). Declared with
// `const` so it doesn't leak onto `window` as a global property.
const fakeStorage = {
  _data: {},

  setItem(id, val) {
    return (this._data[id] = String(val));
  },

  getItem(id) {
    return Object.prototype.hasOwnProperty.call(this._data, id) ? this._data[id] : undefined;
  },

  removeItem(id) {
    return delete this._data[id];
  },

  clear() {
    return (this._data = {});
  },
};

/* exported LocalStorageManager */
class LocalStorageManager {
  constructor() {
    this.bestScoreKey = "2048-best-score";
    this.gameStateKey = "2048-game-state";
    this.soundKey = "2048-sound";
    this.modeKey = "2048-mode";
    this.statsKey = "2048-stats";
    // Daily Challenge keeps its own save and best score so it never
    // touches the Classic record.
    this.dailyBestKey = "2048-daily-best";
    this.dailyStateKey = "2048-daily-state";

    const supported = this.localStorageSupported();
    this.storage = supported ? window.localStorage : fakeStorage;
  }

  localStorageSupported() {
    const testKey = "test";
    try {
      const storage = window.localStorage;
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Best score getters/setters
  getBestScore(mode = "classic", date) {
    if (mode === "daily") {
      // Stored as {date, score}; yesterday's record reads as 0.
      try {
        const rec = JSON.parse(this.storage.getItem(this.dailyBestKey));
        return rec && rec.date === date ? Number(rec.score) || 0 : 0;
      } catch (_e) {
        return 0;
      }
    }
    // localStorage (and fakeStorage) return strings or null; coerce to
    // a number so callers always get a consistent numeric type.
    return Number(this.storage.getItem(this.bestScoreKey)) || 0;
  }

  setBestScore(score, mode = "classic", date) {
    if (mode === "daily") {
      this.storage.setItem(this.dailyBestKey, JSON.stringify({ date, score }));
      return;
    }
    this.storage.setItem(this.bestScoreKey, score);
  }

  // Game state getters/setters and clearing
  stateKeyFor(mode) {
    return mode === "daily" ? this.dailyStateKey : this.gameStateKey;
  }

  getGameState(mode) {
    const stateJSON = this.storage.getItem(this.stateKeyFor(mode));
    if (!stateJSON) return null;
    try {
      return JSON.parse(stateJSON);
    } catch (error) {
      // Corrupted state — clear it so the game starts fresh instead of crashing
      this.clearGameState(mode);
      return null;
    }
  }

  setGameState(gameState, mode) {
    try {
      this.storage.setItem(this.stateKeyFor(mode), JSON.stringify(gameState));
    } catch (error) {
      // Quota exceeded or storage disabled — silently drop the save
      this.clearGameState(mode);
    }
  }

  clearGameState(mode) {
    this.storage.removeItem(this.stateKeyFor(mode));
  }

  // Last selected mode ("classic" | "daily").
  getMode() {
    return this.storage.getItem(this.modeKey) === "daily" ? "daily" : "classic";
  }

  setMode(mode) {
    this.storage.setItem(this.modeKey, mode);
  }

  // Sound preference. Off by default: an absent key reads as disabled, so
  // the game is silent until the player opts in.
  getSoundEnabled() {
    return this.storage.getItem(this.soundKey) === "1";
  }

  setSoundEnabled(enabled) {
    this.storage.setItem(this.soundKey, enabled ? "1" : "0");
  }

  // Lifetime stats for finished games (see js/stats.js). Stored as JSON;
  // corrupted data reads as a fresh record instead of crashing.
  getStats() {
    const raw = this.storage.getItem(this.statsKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      this.storage.removeItem(this.statsKey);
      return null;
    }
  }

  setStats(stats) {
    try {
      this.storage.setItem(this.statsKey, JSON.stringify(stats));
    } catch (error) {
      // Quota exceeded or storage disabled — silently drop the update
    }
  }

  // Generic boolean flags for UI preferences (dark mode, animations,
  // ambience, celebrations — see js/preferences.js). Stored as "1"/"0"
  // under 2048-<name> keys, so the namespacing rules apply unchanged.
  getFlag(name, fallback = false) {
    const raw = this.storage.getItem(`2048-${name}`);
    if (raw === null || raw === undefined) return fallback;
    return raw === "1";
  }

  setFlag(name, value) {
    try {
      this.storage.setItem(`2048-${name}`, value ? "1" : "0");
    } catch (error) {
      // Quota exceeded or storage disabled — silently drop the update
    }
  }

  // String-valued flag variant: dark mode stores "0" / "1" / "auto" in the
  // same key, so the boolean getFlag keeps working for every other
  // preference while this one can carry three states.
  getFlagValue(name, fallback = null) {
    const raw = this.storage.getItem(`2048-${name}`);
    return raw === null || raw === undefined ? fallback : raw;
  }

  setFlagValue(name, value) {
    try {
      this.storage.setItem(`2048-${name}`, String(value));
    } catch (error) {
      // Quota exceeded or storage disabled — silently drop the update
    }
  }
}
