import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadGameFiles, loadApplication } from "./setup.js";

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

describe("per-size storage keys", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 4x4 and keeps the classic keys", () => {
    const storage = new LocalStorageManager();
    expect(storage.getSize()).toBe(4);
    expect(storage.sizeSuffix()).toBe("");
    storage.setBestScore(512);
    expect(localStorage.getItem("2048-best-score")).toBe("512");
  });

  it("suffixes saves and records for other sizes", () => {
    const storage = new LocalStorageManager();
    storage.setBestScore(999); // the 4x4 record, under the classic key
    storage.setSize(3);
    expect(storage.getSize()).toBe(3);
    expect(storage.stateKeyFor("classic")).toBe("2048-game-state-3");
    expect(storage.stateKeyFor("daily")).toBe("2048-daily-state-3");
    expect(storage.bestKeyFor("classic")).toBe("2048-best-score-3");
    expect(storage.bestKeyFor("daily")).toBe("2048-daily-best-3");

    storage.setBestScore(300);
    expect(storage.getBestScore()).toBe(300); // the 3x3 record
    expect(localStorage.getItem("2048-best-score")).toBe("999"); // 4x4 untouched
  });

  it("normalizes unknown sizes back to 4", () => {
    const storage = new LocalStorageManager();
    localStorage.setItem("2048-size", "7");
    expect(storage.getSize()).toBe(4);
    storage.setSize("nonsense");
    expect(storage.getSize()).toBe(4);
  });
});

describe("GameManager.changeSize", () => {
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

  it("starts a fresh game on the new board size", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid.insertTile(new Tile({ x: 3, y: 3 }, 2));

    game.changeSize(3);

    expect(game.size).toBe(3);
    expect(game.grid.size).toBe(3);
    expect(game.grid.cells.length).toBe(3);
    expect(game.score).toBe(0);
    expect(game.moves).toBe(0);
    expect(localStorage.getItem("2048-size")).toBe("3");
  });

  it("resumes the save of the size it switches to", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.changeSize(3);
    game.grid.insertTile(new Tile({ x: 2, y: 2 }, 64));
    game.actuate(); // persist the 3x3 state

    const reloaded = new GameManager(3, MockInput, HTMLActuator, LocalStorageManager);
    expect(reloaded.size).toBe(3);
    expect(reloaded.grid.size).toBe(3);
    expect(reloaded.bestTileValue()).toBe(64);
  });

  it("treats a save from another size as malformed", () => {
    const fourByFour = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    fourByFour.actuate();
    const fourState = localStorage.getItem("2048-game-state");
    expect(fourState).not.toBeNull();

    // Hand the 4x4 save to the 3x3 key.
    localStorage.setItem("2048-size", "3");
    localStorage.setItem("2048-game-state-3", fourState);

    const game = new GameManager(3, MockInput, HTMLActuator, LocalStorageManager);
    expect(game.size).toBe(3);
    expect(game.grid.size).toBe(3); // started fresh instead of loading it
  });
});

describe("5x5 rendering", () => {
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

  it("maps 1-indexed positions up to 5", () => {
    const actuator = new HTMLActuator(themeManager);
    expect(actuator.positionClass({ x: 4, y: 4 })).toBe("tile-position-5-5");
  });

  it("labels a 25-cell board by row and column", () => {
    const rows = Array.from(
      { length: 5 },
      () => `<div class="grid-row">${'<div class="grid-cell"></div>'.repeat(5)}</div>`
    ).join("");
    document.querySelector(".grid-container").innerHTML = rows;

    const actuator = new HTMLActuator(themeManager);
    const grid = new Grid(5);
    grid.insertTile(new Tile({ x: 4, y: 4 }, 32));

    actuator.actuate(grid, { score: 0, bestScore: 0, terminated: false });

    const cells = document.querySelectorAll(".grid-container .grid-cell");
    expect(cells.length).toBe(25);
    expect(cells[4 * 5 + 4].getAttribute("aria-label")).toBe(
      `${themeManager.getLabel(32)}, row 5 column 5`
    );
  });
});

describe("board size control (bootstrap)", () => {
  function mountRealMarkup() {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    document.body.innerHTML = indexHtml
      .match(/<body>([\s\S]*)<\/body>/)[1]
      .replace(/<script[\s\S]*?<\/script>/g, "");
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    themeManager.listeners = [];
    themeManager.set("classic");
    mountRealMarkup();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  it("boots the stored size and rebuilds the cell grid", () => {
    localStorage.setItem("2048-size", "5");
    loadApplication();

    expect(document.body.dataset.size).toBe("5");
    expect(document.querySelectorAll(".grid-cell").length).toBe(25);
    expect(document.querySelector(".grid-container").getAttribute("aria-label")).toBe(
      "5 by 5 game board"
    );
  });

  it("switches size from the settings panel", () => {
    loadApplication();
    document.querySelector(".settings-button").click();

    const three = document.querySelector('[data-board-size="3"]');
    expect(three.getAttribute("aria-checked")).toBe("false");
    three.click();

    expect(localStorage.getItem("2048-size")).toBe("3");
    expect(three.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[data-board-size="4"]').getAttribute("aria-checked")).toBe(
      "false"
    );
    expect(document.querySelectorAll(".grid-cell").length).toBe(9);
    expect(document.body.dataset.size).toBe("3");
  });
});
