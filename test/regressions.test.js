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

function mountRealMarkup() {
  const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  document.body.innerHTML = indexHtml
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
}

/**
 * Regressions found in the QA pass over the shipped code. Each one was a
 * real, user-visible bug; keep them failing loudly if the guards are lost.
 */
describe("QA regressions", () => {
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

  it("does not move tiles when an arrow key is pressed inside the theme picker", () => {
    loadApplication();
    const moves = document.querySelector(".moves-container");
    expect(moves.textContent).toBe("0");

    document.querySelector(".theme-select").click();
    const option = document.querySelectorAll(".theme-option")[1];
    option.focus();
    expect(document.activeElement).toBe(option);

    option.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
    );

    expect(moves.textContent).toBe("0");
  });

  it("keeps game keys out of the open settings panel", () => {
    loadApplication();
    const moves = document.querySelector(".moves-container");
    document.querySelector(".settings-button").click();

    // Focus lands on the first control in the panel.
    expect(document.activeElement.closest(".settings-panel")).not.toBeNull();
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
    );

    expect(moves.textContent).toBe("0");
  });

  it("gives each radiogroup one tab stop and arrow-key navigation", () => {
    loadApplication();
    document.querySelector(".settings-button").click();

    const darkGroup = document.querySelector('[role="radiogroup"][aria-label="Dark mode"]');
    const options = [...darkGroup.querySelectorAll('[role="radio"]')];
    // Only the checked option is tabbable.
    expect(options.filter((option) => option.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(options[0].getAttribute("tabindex")).toBe("0"); // "off" is the default

    options[0].focus();
    darkGroup.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(options[1]);

    // Arrowing must not change the selection (board size would start a game).
    expect(options[1].getAttribute("aria-checked")).toBe("false");
  });

  it("still moves tiles when nothing has focus", () => {
    loadApplication();
    const moves = document.querySelector(".moves-container");
    expect(document.activeElement).toBe(document.body);

    // The start board is random, so try directions until one changes it.
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
      if (moves.textContent !== "0") break;
    }

    expect(moves.textContent).not.toBe("0");
  });
});

describe("leaderboard per board size", () => {
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

  it("does not leak 4x4 runs into the 5x5 board", () => {
    const storage = new LocalStorageManager();
    const four = new Leaderboard(storage);
    four.record("classic", { score: 100, moves: 5, bestTile: 8, date: "2026-10-20" });

    storage.setSize(5);
    const five = new Leaderboard(storage);

    expect(five.get("classic")).toEqual([]);
    expect(localStorage.getItem("2048-leaderboard-classic-5")).toBeNull();
  });

  it("keeps one top-five list per size and mode", () => {
    const storage = new LocalStorageManager();
    const board = new Leaderboard(storage);

    board.record("classic", { score: 100, moves: 5, bestTile: 8, date: "2026-10-20" });
    storage.setSize(3);
    board.record("classic", { score: 40, moves: 3, bestTile: 16, date: "2026-10-20" });
    board.record("daily", { score: 60, moves: 4, bestTile: 32, date: "2026-10-20" });

    expect(board.get("classic").map((entry) => entry.score)).toEqual([40]);
    expect(board.get("daily").map((entry) => entry.score)).toEqual([60]);
    expect(localStorage.getItem("2048-leaderboard-classic-3")).toContain("40");
    expect(localStorage.getItem("2048-leaderboard-daily-3")).toContain("60");
    // The 4x4 record is untouched by the 3x3 runs.
    storage.setSize(4);
    expect(board.get("classic").map((entry) => entry.score)).toEqual([100]);
  });

  it("labels the stats panel list with the size being played", () => {
    localStorage.setItem("2048-size", "3");
    loadApplication();
    document.querySelector(".stats-button").click();

    const list = document.querySelector(".leaderboard");
    expect(list.getAttribute("aria-label")).toContain("3×3");
    expect(list.getAttribute("aria-label")).toContain("classic");
  });
});

describe("overlay live region", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    themeManager.listeners = [];
    themeManager.set("classic");
    document.body.innerHTML =
      '<div class="score-container"></div><div class="best-container"></div>' +
      '<div class="moves-container"></div><div class="timer-container"></div>' +
      '<div class="game-message"><p></p><div class="run-details"></div>' +
      '<span class="new-best-chip" hidden></span><div class="lower"></div></div>' +
      '<div class="grid-container"></div><div class="tile-container"></div>';
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  it("removes the assertive live region when the overlay is dismissed", () => {
    const actuator = new HTMLActuator(themeManager);
    actuator.message(false, { score: 10, moves: 2, elapsed: "00:05", bestTile: 8 });
    expect(document.querySelector(".game-message").getAttribute("aria-live")).toBe("assertive");

    actuator.clearMessage();
    expect(document.querySelector(".game-message").hasAttribute("aria-live")).toBe(false);
  });

  it("keeps the game manager's undo path quiet after an end overlay", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
    game.grid.insertTile(new Tile({ x: 1, y: 0 }, 2));
    game.move(DIRECTIONS.LEFT);
    expect(game.canUndo()).toBe(true);

    // An end overlay sets the assertive region; undoing must clear it.
    game.actuator.message(true, { score: 4, moves: 1, elapsed: "00:01", bestTile: 4 });
    expect(document.querySelector(".game-message").hasAttribute("aria-live")).toBe(true);

    game.undo();
    expect(document.querySelector(".game-message").hasAttribute("aria-live")).toBe(false);
  });
});
