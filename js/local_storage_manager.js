window.fakeStorage = {
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
    this.bestScoreKey = "bestScore";
    this.gameStateKey = "gameState";

    const supported = this.localStorageSupported();
    this.storage = supported ? window.localStorage : window.fakeStorage;
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
  getBestScore() {
    return this.storage.getItem(this.bestScoreKey) || 0;
  }

  setBestScore(score) {
    this.storage.setItem(this.bestScoreKey, score);
  }

  // Game state getters/setters and clearing
  getGameState() {
    const stateJSON = this.storage.getItem(this.gameStateKey);
    if (!stateJSON) return null;
    try {
      return JSON.parse(stateJSON);
    } catch (error) {
      // Corrupted state — clear it so the game starts fresh instead of crashing
      this.clearGameState();
      return null;
    }
  }

  setGameState(gameState) {
    try {
      this.storage.setItem(this.gameStateKey, JSON.stringify(gameState));
    } catch (error) {
      // Quota exceeded or storage disabled — silently drop the save
      this.clearGameState();
    }
  }

  clearGameState() {
    this.storage.removeItem(this.gameStateKey);
  }
}
