import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

// ── Mock dependencies ──────────────────────────────────────────
// GameManager is constructed with InputManager, Actuator, and
// StorageManager classes (it calls `new` on each). We inject
// lightweight mocks so the pure logic (vector math, traversals,
// match detection, serialization) can be exercised without a DOM
// or real storage.
//
// A module-level seed lets tests pre-populate the storage state that
// the freshly-constructed MockStorageManager will read.
let seedState = null;

class MockInputManager {
  constructor() {
    this.events = {};
  }
  on(event, cb) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
  }
}

class MockStorageManager {
  constructor() {
    this.state = seedState;
    this.best = 0;
    this.clearCount = 0;
    this.sound = false;
  }
  getGameState() {
    return this.state;
  }
  setGameState(s) {
    this.state = s;
  }
  clearGameState() {
    this.state = null;
    this.clearCount++;
  }
  getBestScore() {
    return this.best;
  }
  setBestScore(s) {
    this.best = s;
  }
  // The real LocalStorageManager also carries the sound preference and
  // GameManager reads it while constructing, so the stub mirrors it.
  getSoundEnabled() {
    return this.sound;
  }
  setSoundEnabled(enabled) {
    this.sound = Boolean(enabled);
  }
}

class MockActuator {
  constructor(themeManagerRef) {
    this.themeManager = themeManagerRef;
    this.actuateCalls = [];
    this.continueCalled = false;
  }
  actuate(grid, metadata) {
    this.actuateCalls.push({ grid, metadata });
  }
  continueGame() {
    this.continueCalled = true;
  }
}

describe("GameManager", () => {
  let gm;

  beforeEach(() => {
    localStorage.clear();
    // Each makeGame() registers an onChange listener on the shared
    // global themeManager; clear leftovers so tests stay isolated.
    themeManager.listeners = [];
    themeManager.set("classic");
    seedState = null;
  });

  afterEach(() => {
    localStorage.clear();
    seedState = null;
  });

  function makeGame(size = 4) {
    gm = new GameManager(size, MockInputManager, MockActuator, MockStorageManager);
    return gm;
  }

  describe("constructor / setup", () => {
    it("starts with 2 tiles and score 0 on a fresh game", () => {
      makeGame();
      expect(gm.size).toBe(4);
      expect(gm.score).toBe(0);
      expect(gm.over).toBe(false);
      expect(gm.won).toBe(false);
      expect(gm.keepPlayingEnabled).toBe(false);

      let tileCount = 0;
      gm.grid.eachCell((_x, _y, tile) => {
        if (tile) tileCount++;
      });
      expect(tileCount).toBe(2);
    });

    it("adopts the active theme's winThreshold", () => {
      themeManager.set("developer");
      makeGame();
      expect(gm.winThreshold).toBe(64);
    });

    it("restores from a persisted game state", () => {
      // Build a state by playing a fresh game, then restore it.
      makeGame();
      const state = gm.serialize();
      seedState = state;
      // New manager should reload the state, not add new tiles.
      const gm2 = new GameManager(4, MockInputManager, MockActuator, MockStorageManager);
      expect(gm2.score).toBe(state.score);
      expect(gm2.won).toBe(state.won);
      expect(gm2.keepPlayingEnabled).toBe(state.keepPlayingEnabled);
    });

    it("clears malformed persisted state and starts fresh", () => {
      // A state whose grid is structurally invalid throws inside Grid
      // construction; GameManager should catch and restart cleanly.
      seedState = { grid: { size: 4, cells: "not-an-array" }, score: 100 };
      const gm2 = new GameManager(4, MockInputManager, MockActuator, MockStorageManager);
      expect(gm2.score).toBe(0);
      expect(gm2.storageManager.clearCount).toBeGreaterThan(0);
    });
  });

  describe("getVector", () => {
    it("maps each direction to its movement vector", () => {
      makeGame();
      expect(gm.getVector(0)).toEqual({ x: 0, y: -1 }); // up
      expect(gm.getVector(1)).toEqual({ x: 1, y: 0 }); // right
      expect(gm.getVector(2)).toEqual({ x: 0, y: 1 }); // down
      expect(gm.getVector(3)).toEqual({ x: -1, y: 0 }); // left
    });
  });

  describe("buildTraversals", () => {
    it("reverses x traversal when moving right", () => {
      makeGame(4);
      const traversals = gm.buildTraversals({ x: 1, y: 0 });
      expect(traversals.x).toEqual([3, 2, 1, 0]);
      expect(traversals.y).toEqual([0, 1, 2, 3]);
    });

    it("reverses y traversal when moving down", () => {
      makeGame(4);
      const traversals = gm.buildTraversals({ x: 0, y: 1 });
      expect(traversals.x).toEqual([0, 1, 2, 3]);
      expect(traversals.y).toEqual([3, 2, 1, 0]);
    });

    it("leaves both axes in ascending order when moving up", () => {
      makeGame(4);
      const traversals = gm.buildTraversals({ x: 0, y: -1 });
      expect(traversals.x).toEqual([0, 1, 2, 3]);
      expect(traversals.y).toEqual([0, 1, 2, 3]);
    });

    it("scales with grid size", () => {
      makeGame(3);
      const traversals = gm.buildTraversals({ x: 0, y: 0 });
      expect(traversals.x.length).toBe(3);
      expect(traversals.y.length).toBe(3);
    });
  });

  describe("findFarthestPosition", () => {
    it("returns the last in-bounds cell as farthest in an empty grid", () => {
      makeGame(4);
      // makeGame adds 2 random tiles; reset to a known-empty grid.
      gm.grid = new Grid(4);
      const result = gm.findFarthestPosition({ x: 0, y: 0 }, { x: 1, y: 0 });
      expect(result.farthest).toEqual({ x: 3, y: 0 });
      expect(result.next).toEqual({ x: 4, y: 0 }); // out of bounds
    });

    it("stops at an occupied cell, returning the cell before it as farthest", () => {
      makeGame(4);
      gm.grid = new Grid(4);
      // Place a blocker at (2,0); starting from (0,0) moving right.
      gm.grid.insertTile(new Tile({ x: 2, y: 0 }, 4));
      const result = gm.findFarthestPosition({ x: 0, y: 0 }, { x: 1, y: 0 });
      expect(result.farthest).toEqual({ x: 1, y: 0 });
      expect(result.next).toEqual({ x: 2, y: 0 });
    });
  });

  describe("positionsEqual", () => {
    it("returns true for matching positions", () => {
      makeGame();
      expect(gm.positionsEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    });

    it("returns false for differing positions", () => {
      makeGame();
      expect(gm.positionsEqual({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
      expect(gm.positionsEqual({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
    });
  });

  describe("movesAvailable", () => {
    it("returns true when empty cells exist", () => {
      makeGame(4);
      expect(gm.movesAvailable()).toBe(true);
    });

    it("returns false when the grid is full with no merges", () => {
      makeGame(4);
      // Fill the grid with a checkerboard of 2s and 4s so no two
      // orthogonally-adjacent tiles share a value.
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          gm.grid.insertTile(new Tile({ x, y }, (x + y) % 2 === 0 ? 2 : 4));
        }
      }
      expect(gm.movesAvailable()).toBe(false);
    });

    it("returns true when the grid is full but a merge is possible", () => {
      makeGame(4);
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          gm.grid.insertTile(new Tile({ x, y }, 2));
        }
      }
      // Every tile is 2, so adjacent merges exist.
      expect(gm.movesAvailable()).toBe(true);
    });
  });

  describe("tileMatchesAvailable", () => {
    it("returns false for a single tile", () => {
      makeGame(4);
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
      expect(gm.tileMatchesAvailable()).toBe(false);
    });

    it("returns true when two adjacent tiles share a value", () => {
      makeGame(4);
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
      gm.grid.insertTile(new Tile({ x: 1, y: 0 }, 2));
      expect(gm.tileMatchesAvailable()).toBe(true);
    });

    it("returns false when adjacent tiles differ", () => {
      makeGame(4);
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
      gm.grid.insertTile(new Tile({ x: 1, y: 0 }, 4));
      expect(gm.tileMatchesAvailable()).toBe(false);
    });
  });

  describe("serialize", () => {
    it("captures grid, score, over, won, and keepPlayingEnabled", () => {
      makeGame();
      gm.score = 42;
      gm.won = true;
      gm.keepPlayingEnabled = true;
      const s = gm.serialize();
      expect(s.score).toBe(42);
      expect(s.won).toBe(true);
      expect(s.over).toBe(false);
      expect(s.keepPlayingEnabled).toBe(true);
      expect(s.grid.size).toBe(4);
    });
  });

  describe("keepPlaying", () => {
    it("sets keepPlayingEnabled and clears the overlay", () => {
      makeGame();
      gm.won = true;
      gm.keepPlaying();
      expect(gm.keepPlayingEnabled).toBe(true);
      expect(gm.actuator.continueCalled).toBe(true);
    });

    it("persists keepPlayingEnabled=true so the overlay doesn't reappear on refresh", () => {
      // Regression: previously keepPlaying() only cleared the overlay
      // without persisting, so a refresh showed "You win!" again.
      makeGame();
      gm.won = true;
      gm.keepPlaying();
      // The persisted state must reflect keepPlayingEnabled now.
      const persisted = gm.storageManager.state;
      expect(persisted).not.toBeNull();
      expect(persisted.keepPlayingEnabled).toBe(true);

      // Simulate a refresh: a new manager restores the persisted state.
      seedState = persisted;
      const gm2 = new GameManager(4, MockInputManager, MockActuator, MockStorageManager);
      expect(gm2.keepPlayingEnabled).toBe(true);
      expect(gm2.won).toBe(true);
      // Won but keepPlaying enabled → game is NOT terminated.
      expect(gm2.isGameTerminated()).toBe(false);
    });
  });

  describe("isGameTerminated", () => {
    it("returns false during normal play", () => {
      makeGame();
      expect(gm.isGameTerminated()).toBe(false);
    });

    it("returns true when the game is over", () => {
      makeGame();
      gm.over = true;
      expect(gm.isGameTerminated()).toBe(true);
    });

    it("returns true when won but keepPlaying not enabled", () => {
      makeGame();
      gm.won = true;
      gm.keepPlayingEnabled = false;
      expect(gm.isGameTerminated()).toBe(true);
    });

    it("returns false when won and keepPlaying is enabled", () => {
      makeGame();
      gm.won = true;
      gm.keepPlayingEnabled = true;
      expect(gm.isGameTerminated()).toBe(false);
    });
  });

  describe("hasWinningTile", () => {
    it("returns false when no tile meets the threshold", () => {
      makeGame();
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 512));
      gm.winThreshold = 2048;
      expect(gm.hasWinningTile()).toBe(false);
    });

    it("returns true when a tile meets the threshold", () => {
      makeGame();
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 2048));
      gm.winThreshold = 2048;
      expect(gm.hasWinningTile()).toBe(true);
    });

    it("returns true when a tile exceeds the threshold", () => {
      makeGame();
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 4096));
      gm.winThreshold = 2048;
      expect(gm.hasWinningTile()).toBe(true);
    });
  });

  describe("theme switch recomputes won state", () => {
    it("clears won when switching to a higher threshold with no qualifying tile", () => {
      themeManager.set("developer"); // threshold 64
      makeGame();
      // Simulate having won on Developer: a 64 tile exists.
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 64));
      gm.won = true;
      gm.keepPlayingEnabled = false;

      // Switch to Classic (threshold 2048) — no 2048 tile exists.
      themeManager.set("classic");
      expect(gm.winThreshold).toBe(2048);
      expect(gm.won).toBe(false);
    });

    it("sets won when switching to a lower threshold with a qualifying tile", () => {
      themeManager.set("classic"); // threshold 2048
      makeGame();
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 128));
      gm.won = false;
      gm.keepPlayingEnabled = false;

      // Switch to Developer (threshold 64) — 128 >= 64 qualifies.
      themeManager.set("developer");
      expect(gm.winThreshold).toBe(64);
      expect(gm.won).toBe(true);
    });

    it("preserves won when keepPlayingEnabled is true", () => {
      themeManager.set("developer");
      makeGame();
      gm.grid = new Grid(4);
      gm.grid.insertTile(new Tile({ x: 0, y: 0 }, 64));
      gm.won = true;
      gm.keepPlayingEnabled = true;

      themeManager.set("classic");
      expect(gm.winThreshold).toBe(2048);
      expect(gm.won).toBe(true);
    });
  });

  describe("restart", () => {
    it("clears saved state and starts a fresh game", () => {
      makeGame();
      gm.score = 100;
      gm.won = true;
      gm.restart();
      expect(gm.score).toBe(0);
      expect(gm.won).toBe(false);
      expect(gm.over).toBe(false);
      expect(gm.storageManager.clearCount).toBeGreaterThan(0);
    });
  });
});
