import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("LocalStorageManager", () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    manager = new LocalStorageManager();
  });

  afterEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  describe("bestScore", () => {
    it("returns 0 when no score is stored", () => {
      expect(manager.getBestScore()).toBe(0);
    });

    it("stores and retrieves best score (coerced to a number)", () => {
      manager.setBestScore(12345);
      // localStorage.setItem coerces to string; getBestScore coerces
      // back to a number so callers always get a consistent numeric type.
      expect(manager.getBestScore()).toBe(12345);
      expect(typeof manager.getBestScore()).toBe("number");
    });
  });

  describe("gameState", () => {
    it("returns null when no state is stored", () => {
      expect(manager.getGameState()).toBeNull();
    });

    it("stores and retrieves game state", () => {
      const state = { size: 4, cells: [[null, null]] };
      manager.setGameState(state);
      expect(manager.getGameState()).toEqual(state);
    });

    it("clears corrupted state and returns null", () => {
      localStorage.setItem("2048-game-state", "{invalid json}}}");
      expect(manager.getGameState()).toBeNull();
      // State should be cleared after corruption
      expect(localStorage.getItem("2048-game-state")).toBeNull();
    });

    it("clearGameState removes stored state", () => {
      manager.setGameState({ size: 4, cells: [] });
      manager.clearGameState();
      expect(manager.getGameState()).toBeNull();
    });
  });

  describe("fakeStorage fallback", () => {
    it("falls back to fakeStorage when localStorage is disabled", () => {
      // Save original and simulate localStorage being unavailable
      const original = window.localStorage;
      Object.defineProperty(window, "localStorage", {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const m = new LocalStorageManager();
      m.setBestScore(999);
      expect(m.getBestScore()).toBe(999);

      // Restore
      Object.defineProperty(window, "localStorage", {
        value: original,
        configurable: true,
        writable: true,
      });
    });
  });
});
