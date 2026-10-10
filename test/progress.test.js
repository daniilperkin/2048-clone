import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
    '<div class="container">' +
    '<div class="score-container"></div><div class="best-container"></div>' +
    '<div class="moves-container"></div><div class="timer-container"></div>' +
    '<div class="game-message"><p></p></div>' +
    '<div class="grid-container"><div class="grid-row"><div class="grid-cell"></div></div></div>' +
    '<div class="tile-container"></div>' +
    "</div>" +
    '<div class="celebration-layer"></div>';
}

/** A board with two 1024 tiles side by side — one LEFT move merges to 2048. */
function winningGrid() {
  const grid = new Grid(4);
  grid.insertTile(new Tile({ x: 0, y: 0 }, 1024));
  grid.insertTile(new Tile({ x: 1, y: 0 }, 1024));
  return grid;
}

describe("moves counter, clock and celebrations", () => {
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    preferences.celebrate = false;
    preferences.motion = true;
  });

  it("counts moves that change the board and renders them", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    expect(game.moves).toBe(0);

    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 3, y: 0 }, 2));
    game.move(DIRECTIONS.LEFT);

    expect(game.moves).toBe(1);
    expect(document.querySelector(".moves-container").textContent).toBe("1");
  });

  it("does not count a move that changes nothing", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = new Grid(4);
    // Fully left-packed, no equal neighbours: LEFT is a no-op.
    game.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
    game.grid.insertTile(new Tile({ x: 0, y: 2 }, 4));
    game.grid.insertTile(new Tile({ x: 0, y: 3 }, 8));

    game.move(DIRECTIONS.LEFT);

    expect(game.moves).toBe(0);
    expect(game.history.length).toBe(0);
  });

  it("takes the moves counter back with an undo", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 3, y: 0 }, 2));
    game.move(DIRECTIONS.LEFT);
    expect(game.moves).toBe(1);

    game.undo();
    expect(game.moves).toBe(0);
    expect(document.querySelector(".moves-container").textContent).toBe("0");
  });

  it("formats elapsed time as MM:SS and H:MM:SS", () => {
    expect(GameManager.formatElapsed(0)).toBe("00:00");
    expect(GameManager.formatElapsed(65 * 1000)).toBe("01:05");
    expect(GameManager.formatElapsed((59 * 60 + 59) * 1000)).toBe("59:59");
    expect(GameManager.formatElapsed(3661 * 1000)).toBe("1:01:01");
    expect(GameManager.formatElapsed(-500)).toBe("00:00");
  });

  it("freezes the clock at game over", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    vi.spyOn(Math, "random").mockReturnValue(0.5); // spawns a 2 into the single gap
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);

    // Full board, no merges anywhere; only (3,3) is empty. RIGHT fills it.
    const layout = [
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [4, 2, 4, null],
    ];
    game.grid = new Grid(4);
    layout.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) game.grid.insertTile(new Tile({ x, y }, value));
      });
    });

    vi.setSystemTime(5000);
    game.move(DIRECTIONS.RIGHT);
    expect(game.over).toBe(true);
    expect(game.endedAt).toBe(5000);

    vi.setSystemTime(9000);
    expect(GameManager.formatElapsed(game.elapsedMs())).toBe("00:04"); // frozen
  });

  it("stops the clock on a win and resumes it on keep playing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();

    vi.setSystemTime(5000);
    game.move(DIRECTIONS.LEFT);
    expect(game.won).toBe(true);
    expect(game.endedAt).toBe(5000);

    vi.setSystemTime(9000);
    expect(GameManager.formatElapsed(game.elapsedMs())).toBe("00:04");

    game.keepPlaying();
    expect(game.endedAt).toBeNull();
    expect(GameManager.formatElapsed(game.elapsedMs())).toBe("00:08");
  });

  it("restores the moves counter and clock position from the persisted save", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 3, y: 0 }, 2));
    game.move(DIRECTIONS.LEFT);
    expect(game.moves).toBe(1);

    // The actuate after the move persisted the whole state; a reload
    // (a fresh manager) must resume the same move count and clock.
    const reloaded = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    expect(reloaded.moves).toBe(1);
    expect(reloaded.startedAt).toBe(game.startedAt);
  });

  it("celebrates a win with confetti when the player opted in", () => {
    vi.useFakeTimers();
    preferences.celebrate = true;
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();

    game.move(DIRECTIONS.LEFT);

    expect(game.won).toBe(true);
    expect(document.querySelectorAll(".celebration-layer .confetti").length).toBe(42);
    expect(document.querySelector(".game-message").classList.contains("celebrate-win")).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(document.querySelectorAll(".celebration-layer .confetti").length).toBe(0);
    expect(document.querySelector(".game-message").classList.contains("celebrate-win")).toBe(false);
  });

  it("does not celebrate while animations are turned off", () => {
    preferences.celebrate = true;
    preferences.motion = false;
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();

    game.move(DIRECTIONS.LEFT);

    expect(game.won).toBe(true);
    expect(document.querySelectorAll(".celebration-layer .confetti").length).toBe(0);
    expect(document.querySelector(".game-message").classList.contains("celebrate-win")).toBe(false);
  });

  it("does not celebrate when the player never opted in", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();

    game.move(DIRECTIONS.LEFT);

    expect(game.won).toBe(true);
    expect(document.querySelectorAll(".celebration-layer .confetti").length).toBe(0);
  });
});
