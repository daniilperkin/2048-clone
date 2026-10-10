import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

class MockInput {
  constructor() {
    this.events = {};
  }
  on(e, cb) {
    (this.events[e] = this.events[e] || []).push(cb);
  }
}
class MockActuator {
  actuate(grid, meta) {
    this.last = meta;
  }
  continueGame() {
    this.continued = true;
  }
}

const make = () => new GameManager(4, MockInput, MockActuator, LocalStorageManager);

function setBoard(gm, tiles) {
  gm.grid = new Grid(4);
  for (const [x, y, v] of tiles) gm.grid.insertTile(new Tile({ x, y }, v));
}

// One move away from a loss: moving left slides the gapped top row into
// place, and the refilled tile (pinned via mocked Math.random) lands as a
// 4 that leaves a full checkerboard with no merges — game over.
const LOSING_BOARD = [
  [1, 0, 2],
  [2, 0, 4],
  [3, 0, 2],
  [0, 1, 4],
  [1, 1, 2],
  [2, 1, 4],
  [3, 1, 2],
  [0, 2, 2],
  [1, 2, 4],
  [2, 2, 2],
  [3, 2, 4],
  [0, 3, 4],
  [1, 3, 2],
  [2, 3, 4],
  [3, 3, 2],
];

const DEFAULTS = { played: 0, won: 0, bestTile: 0, streak: 0, bestStreak: 0 };

beforeEach(() => {
  localStorage.clear();
  themeManager.listeners = [];
  themeManager.set("classic");
});

describe("StatsTracker", () => {
  it("starts at zero defaults", () => {
    const stats = new StatsTracker(new LocalStorageManager());
    expect(stats.get()).toEqual(DEFAULTS);
  });

  it("counts wins, losses, best tile and streaks", () => {
    const stats = new StatsTracker(new LocalStorageManager());
    stats.record(true, 8);
    stats.record(true, 16);
    stats.record(false, 4);
    expect(stats.get()).toEqual({ played: 3, won: 2, bestTile: 16, streak: 0, bestStreak: 2 });
  });

  it("restores a previous record (undo path)", () => {
    const stats = new StatsTracker(new LocalStorageManager());
    const previous = stats.record(false, 4);
    stats.restore(previous);
    expect(stats.get()).toEqual(DEFAULTS);
  });

  it("treats corrupted stored data as a fresh record", () => {
    localStorage.setItem("2048-stats", "{not json");
    const stats = new StatsTracker(new LocalStorageManager());
    expect(stats.get()).toEqual(DEFAULTS);
  });

  it("persists under the 2048- namespace", () => {
    new StatsTracker(new LocalStorageManager()).record(true, 2);
    expect(localStorage.getItem("2048-stats")).toContain('"played":1');
  });
});

describe("GameManager stats integration", () => {
  it("records a loss when a move leaves no moves available", () => {
    const gm = make();
    setBoard(gm, LOSING_BOARD);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.95);
    gm.move(DIRECTIONS.LEFT);
    random.mockRestore();
    expect(gm.over).toBe(true);
    expect(gm.stats.get()).toEqual({ played: 1, won: 0, bestTile: 4, streak: 0, bestStreak: 0 });
  });

  it("records a win when a merge reaches the theme threshold", () => {
    const gm = make();
    gm.winThreshold = 4;
    setBoard(gm, [
      [0, 0, 2],
      [1, 0, 2],
    ]);
    gm.move(DIRECTIONS.RIGHT);
    expect(gm.won).toBe(true);
    expect(gm.stats.get()).toEqual({ played: 1, won: 1, bestTile: 4, streak: 1, bestStreak: 1 });
  });

  it("counts a win once even if the player keeps playing into a loss", () => {
    const gm = make();
    gm.winThreshold = 4;
    setBoard(gm, [
      [0, 0, 2],
      [1, 0, 2],
    ]);
    gm.move(DIRECTIONS.RIGHT);
    gm.keepPlaying();
    setBoard(gm, LOSING_BOARD);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.95);
    gm.move(DIRECTIONS.LEFT);
    random.mockRestore();
    expect(gm.over).toBe(true);
    expect(gm.stats.get().played).toBe(1);
    expect(gm.stats.get().won).toBe(1);
  });

  it("rolls the record back when the ending move is undone", () => {
    const gm = make();
    gm.winThreshold = 4;
    setBoard(gm, [
      [0, 0, 2],
      [1, 0, 2],
    ]);
    gm.move(DIRECTIONS.RIGHT);
    expect(gm.stats.get().played).toBe(1);
    gm.undo();
    expect(gm.stats.get()).toEqual(DEFAULTS);
    // Re-playing the move records again — no double-count, no loss.
    gm.move(DIRECTIONS.RIGHT);
    expect(gm.stats.get().played).toBe(1);
    expect(gm.stats.get().won).toBe(1);
  });

  it("does not count a theme switch that flips the win state", () => {
    const gm = make();
    setBoard(gm, [[0, 0, 128]]);
    themeManager.set("developer"); // threshold 64 → win overlay appears
    expect(gm.won).toBe(true);
    expect(gm.stats.get().played).toBe(0);
  });

  it("survives a reload: stats persist independently of game state", () => {
    const gm = make();
    gm.winThreshold = 4;
    setBoard(gm, [
      [0, 0, 2],
      [1, 0, 2],
    ]);
    gm.move(DIRECTIONS.RIGHT);
    const reloaded = new StatsTracker(new LocalStorageManager());
    expect(reloaded.get().won).toBe(1);
  });
});
