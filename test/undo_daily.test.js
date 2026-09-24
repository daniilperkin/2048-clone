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
const board = (gm) => JSON.stringify(gm.grid.serialize());

// A board that can definitely move left: one tile on the right edge.
function setBoard(gm, tiles) {
  gm.grid = new Grid(4);
  for (const [x, y, v] of tiles) gm.grid.insertTile(new Tile({ x, y }, v));
}

beforeEach(() => {
  localStorage.clear();
  themeManager.listeners = [];
  themeManager.set("classic");
  vi.useRealTimers();
});

describe("Undo", () => {
  it("starts with nothing to undo", () => {
    const gm = make();
    expect(gm.canUndo()).toBe(false);
    expect(gm.actuator.last.canUndo).toBe(false);
  });

  it("restores the board and score of the previous move", () => {
    const gm = make();
    setBoard(gm, [
      [2, 0, 2],
      [3, 0, 2],
    ]);
    const before = board(gm);
    gm.move(DIRECTIONS.LEFT);
    expect(gm.score).toBe(4);
    expect(gm.actuator.last.canUndo).toBe(true);
    gm.undo();
    expect(board(gm)).toBe(before);
    expect(gm.score).toBe(0);
    expect(gm.canUndo()).toBe(false);
  });

  it("ignores moves that change nothing", () => {
    const gm = make();
    setBoard(gm, [[0, 0, 2]]);
    gm.move(DIRECTIONS.LEFT);
    expect(gm.canUndo()).toBe(false);
  });

  it("caps history at maxUndo steps", () => {
    const gm = make();
    gm.maxUndo = 2;
    for (let i = 0; i < 4; i++) {
      setBoard(gm, [[3, 0, 2]]);
      gm.move(DIRECTIONS.LEFT);
    }
    expect(gm.history.length).toBe(2);
  });

  it("survives a reload via persisted state", () => {
    const gm = make();
    setBoard(gm, [[3, 0, 2]]);
    const before = board(gm);
    gm.move(DIRECTIONS.LEFT);
    const reloaded = make();
    expect(reloaded.canUndo()).toBe(true);
    reloaded.undo();
    expect(board(reloaded)).toBe(before);
  });

  it("can take back a losing move and clears the overlay", () => {
    const gm = make();
    setBoard(gm, [[3, 0, 2]]);
    gm.move(DIRECTIONS.LEFT);
    gm.over = true;
    gm.undo();
    expect(gm.over).toBe(false);
    expect(gm.actuator.continued).toBe(true);
  });

  it("is a no-op when history is empty", () => {
    const gm = make();
    const before = board(gm);
    gm.undo();
    expect(board(gm)).toBe(before);
  });
});

describe("Daily Challenge", () => {
  const daily = () => {
    localStorage.setItem("2048-mode", "daily");
    return make();
  };

  it("deals the same opening board for the same date", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 24, 12) });
    const first = board(daily());
    localStorage.clear();
    expect(board(daily())).toBe(first);
  });

  it("deals a different board on another day", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 24, 12) });
    const a = board(daily());
    localStorage.clear();
    vi.setSystemTime(new Date(2026, 8, 25, 12));
    expect(board(daily())).not.toBe(a);
  });

  it("discards yesterday's save", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 24, 12) });
    const gm = daily();
    gm.score = 500;
    gm.actuate();
    vi.setSystemTime(new Date(2026, 8, 25, 12));
    expect(make().score).toBe(0);
  });

  it("keeps a best score separate from Classic, reset daily", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 24, 12) });
    const gm = daily();
    gm.score = 300;
    gm.actuate();
    const lsm = new LocalStorageManager();
    expect(lsm.getBestScore("daily", "2026-09-24")).toBe(300);
    expect(lsm.getBestScore("daily", "2026-09-25")).toBe(0);
    expect(lsm.getBestScore()).toBe(0);
  });

  it("undo replays the identical spawn (no re-rolling)", () => {
    const gm = daily();
    setBoard(gm, [[3, 0, 2]]);
    gm.move(DIRECTIONS.LEFT);
    const after = board(gm);
    gm.undo();
    gm.move(DIRECTIONS.LEFT);
    expect(board(gm)).toBe(after);
  });

  it("toggling modes persists the choice and resumes each save", () => {
    const gm = make();
    gm.score = 12;
    gm.actuate();
    gm.toggleDaily();
    expect(gm.mode).toBe("daily");
    expect(localStorage.getItem("2048-mode")).toBe("daily");
    expect(gm.actuator.last.mode).toBe("daily");
    gm.toggleDaily();
    expect(gm.mode).toBe("classic");
    expect(gm.score).toBe(12);
  });
});
