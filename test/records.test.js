import { describe, it, expect, beforeEach, vi } from "vitest";

import { loadGameFiles } from "./setup.js";

loadGameFiles();

class MockInput {
  constructor() {
    this.events = {};
  }
  on(event, callback) {
    (this.events[event] = this.events[event] || []).push(callback);
  }
}

function mountFixture() {
  document.body.innerHTML =
    '<div class="score-container"></div><div class="best-container"></div>' +
    '<div class="moves-container"></div><div class="timer-container"></div>' +
    '<div class="game-message"><p></p><div class="run-details"></div>' +
    '<span class="new-best-chip" hidden></span><div class="lower"></div></div>' +
    '<div class="grid-container"></div><div class="tile-container"></div>';
}

function losingGrid() {
  // Full board, no merges; only (3,3) is empty. RIGHT fills it.
  const layout = [
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [4, 2, 4, null],
  ];
  const grid = new Grid(4);
  layout.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) grid.insertTile(new Tile({ x, y }, value));
    });
  });
  return grid;
}

describe("Leaderboard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    const board = new Leaderboard(new LocalStorageManager());
    expect(board.get("classic")).toEqual([]);
  });

  it("keeps the five best runs, highest score first", () => {
    const board = new Leaderboard(new LocalStorageManager());
    for (const score of [100, 300, 200, 500, 50, 400]) {
      board.record("classic", { score, moves: 10, bestTile: 64, date: "2026-10-10", at: score });
    }
    const entries = board.get("classic");
    expect(entries.map((entry) => entry.score)).toEqual([500, 400, 300, 200, 100]);
  });

  it("keeps modes separate", () => {
    const board = new Leaderboard(new LocalStorageManager());
    board.record("classic", { score: 100, date: "2026-10-10" });
    board.record("daily", { score: 50, date: "2026-10-10" });
    expect(board.get("classic")).toHaveLength(1);
    expect(board.get("daily")).toHaveLength(1);
    expect(localStorage.getItem("2048-leaderboard-classic")).toContain("100");
    expect(localStorage.getItem("2048-leaderboard-daily")).toContain("50");
  });

  it("restores the previous list after an undo", () => {
    const board = new Leaderboard(new LocalStorageManager());
    board.record("classic", { score: 100, date: "2026-10-10" });
    const previous = board.record("classic", { score: 200, date: "2026-10-10" });
    expect(board.get("classic")).toHaveLength(2);

    board.restore("classic", previous);
    expect(board.get("classic").map((entry) => entry.score)).toEqual([100]);
  });

  it("reads corrupted storage as empty", () => {
    localStorage.setItem("2048-leaderboard-classic", "{not json");
    const board = new Leaderboard(new LocalStorageManager());
    expect(board.get("classic")).toEqual([]);
  });
});

describe("DailyStreak", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at zero", () => {
    const streak = new DailyStreak(new LocalStorageManager());
    expect(streak.get()).toEqual({ count: 0, lastDate: null });
  });

  it("counts the first day as 1 and same-day touches as no-op", () => {
    const streak = new DailyStreak(new LocalStorageManager());
    expect(streak.touch("2026-10-10").count).toBe(1);
    expect(streak.touch("2026-10-10").count).toBe(1);
    expect(localStorage.getItem("2048-daily-streak")).toContain("2026-10-10");
  });

  it("extends on consecutive days and resets after a gap", () => {
    const streak = new DailyStreak(new LocalStorageManager());
    streak.touch("2026-10-10");
    expect(streak.touch("2026-10-11").count).toBe(2);
    expect(streak.touch("2026-10-12").count).toBe(3);
    expect(streak.touch("2026-10-15").count).toBe(1); // gap resets
  });

  it("computes the previous calendar day across month and year bounds", () => {
    expect(DailyStreak.previousDate("2026-10-01")).toBe("2026-09-30");
    expect(DailyStreak.previousDate("2026-01-01")).toBe("2025-12-31");
    expect(DailyStreak.previousDate("2024-03-01")).toBe("2024-02-29"); // leap year
  });
});

describe("GameManager records integration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    themeManager.listeners = [];
    themeManager.set("classic");
    mountFixture();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  it("records the finished run on the leaderboard", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = losingGrid();
    game.move(DIRECTIONS.RIGHT);

    expect(game.over).toBe(true);
    const entries = game.leaderboard.get("classic");
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(game.score);
    expect(entries[0].moves).toBe(game.moves);
    vi.restoreAllMocks();
  });

  it("removes the run again when the ending move is undone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = losingGrid();
    game.move(DIRECTIONS.RIGHT);
    expect(game.leaderboard.get("classic")).toHaveLength(1);

    game.undo();
    expect(game.over).toBe(false);
    expect(game.leaderboard.get("classic")).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("touches the daily streak when a daily game is set up", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    expect(game.dailyStreak.get().count).toBe(0);

    game.toggleDaily();
    expect(game.mode).toBe("daily");
    expect(game.dailyStreak.get().count).toBe(1);
    expect(game.dailyStreak.get().lastDate).toBe(game.date);
  });
});
