import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    '<div class="container">' +
    '<div class="score-container"></div><div class="best-container"></div>' +
    '<div class="moves-container"></div><div class="timer-container"></div>' +
    '<div class="game-message"><p></p><div class="run-details"></div>' +
    '<span class="new-best-chip" hidden>New best!</span><div class="lower"></div></div>' +
    '<div class="grid-container"><div class="grid-row"><div class="grid-cell"></div></div></div>' +
    '<div class="tile-container"></div>' +
    "</div>";
}

function winningGrid() {
  const grid = new Grid(4);
  grid.insertTile(new Tile({ x: 0, y: 0 }, 1024));
  grid.insertTile(new Tile({ x: 1, y: 0 }, 1024));
  return grid;
}

describe("end-of-run overlay summary", () => {
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
  });

  it("reports score, moves, time and best tile on the win overlay", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();
    game.move(DIRECTIONS.LEFT);

    const details = document.querySelector(".run-details");
    expect(game.won).toBe(true);
    expect(details.textContent).toContain("Score 2048");
    expect(details.textContent).toContain("1 moves");
    expect(details.textContent).toContain("best tile 2048");
  });

  it("shows the new-best chip when the run beats the previous record", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();
    game.move(DIRECTIONS.LEFT);

    expect(document.querySelector(".new-best-chip").hidden).toBe(false);
  });

  it("hides the chip when the previous record is higher", () => {
    localStorage.setItem("2048-best-score", "999999");
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();
    game.move(DIRECTIONS.LEFT);

    expect(game.won).toBe(true);
    expect(document.querySelector(".new-best-chip").hidden).toBe(true);
  });

  it("clears the summary when the overlay is dismissed", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();
    game.move(DIRECTIONS.LEFT);
    game.keepPlaying();

    expect(document.querySelector(".run-details").textContent).toBe("");
    expect(document.querySelector(".new-best-chip").hidden).toBe(true);
  });
});

describe("invalid-move feedback", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    mountFixture();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shakes the board when a move changes nothing", () => {
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    const shake = vi.spyOn(game.actuator, "shake");
    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
    game.grid.insertTile(new Tile({ x: 0, y: 2 }, 4));

    game.move(DIRECTIONS.LEFT);

    expect(shake).toHaveBeenCalledTimes(1);
  });

  it("adds and later removes the shake class", () => {
    vi.useFakeTimers();
    const actuator = new HTMLActuator(themeManager);
    actuator.shake();
    const container = document.querySelector(".tile-container");
    expect(container.classList.contains("board-shake")).toBe(true);

    vi.advanceTimersByTime(300);
    expect(container.classList.contains("board-shake")).toBe(false);
  });
});

describe("sound cues", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    mountFixture();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays the win motif on a winning move", () => {
    const win = vi.spyOn(soundManager, "win").mockImplementation(() => {});
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = winningGrid();
    game.move(DIRECTIONS.LEFT);
    expect(win).toHaveBeenCalled();
  });

  it("plays the undo tick when a move is taken back", () => {
    const undo = vi.spyOn(soundManager, "undo").mockImplementation(() => {});
    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    game.grid = new Grid(4);
    game.grid.insertTile(new Tile({ x: 3, y: 0 }, 2));
    game.move(DIRECTIONS.LEFT);
    game.undo();
    expect(undo).toHaveBeenCalled();
  });
});

describe("bootstrap polish (panels, hint, board scaling)", () => {
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

  it("closes the settings panel on Escape and returns focus to the toggle", () => {
    loadApplication();
    const button = document.querySelector(".settings-button");
    const panel = document.querySelector(".settings-panel");
    button.click();
    expect(panel.hasAttribute("hidden")).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it("closes an open panel when clicking outside it", () => {
    loadApplication();
    const button = document.querySelector(".stats-button");
    const panel = document.querySelector(".stats-panel");
    button.click();
    expect(panel.hasAttribute("hidden")).toBe(false);

    document.querySelector(".heading").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(panel.hasAttribute("hidden")).toBe(true);
  });

  it("shows the first-run hint until dismissed, then persists the choice", () => {
    loadApplication();
    const hint = document.querySelector(".first-run-hint");
    expect(hint.hasAttribute("hidden")).toBe(false);

    hint.querySelector(".hint-dismiss").click();
    expect(hint.hasAttribute("hidden")).toBe(true);
    expect(localStorage.getItem("2048-hint-seen")).toBe("1");

    // A later boot respects the stored flag.
    mountRealMarkup();
    loadApplication();
    expect(document.querySelector(".first-run-hint").hasAttribute("hidden")).toBe(true);
  });

  it("scales the fixed board down to the available width", () => {
    const frame = document.querySelector(".board-frame");
    Object.defineProperty(frame, "clientWidth", { value: 250, configurable: true });
    loadApplication();
    expect(document.documentElement.style.getPropertyValue("--board-scale")).toBe("0.5");
  });
});

describe("page zoom fitting", () => {
  function mountRealMarkup() {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    document.body.innerHTML = indexHtml
      .match(/<body>([\s\S]*)<\/body>/)[1]
      .replace(/<script[\s\S]*?<\/script>/g, "");
  }

  // jsdom has no layout engine: hand the fitting code a body box and a
  // viewport so the arithmetic can be exercised.
  function stubLayout(bodyHeight, bodyWidth, viewportWidth, viewportHeight) {
    Object.defineProperty(document.body, "offsetHeight", {
      value: bodyHeight,
      configurable: true,
    });
    Object.defineProperty(document.body, "offsetWidth", {
      value: bodyWidth,
      configurable: true,
    });
    Object.defineProperty(window, "innerWidth", { value: viewportWidth, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: viewportHeight, configurable: true });
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

  afterEach(() => {
    Object.defineProperty(document.body, "offsetHeight", { value: 0, configurable: true });
    Object.defineProperty(document.body, "offsetWidth", { value: 0, configurable: true });
  });

  it("caps the desktop zoom at 1.25 on a roomy screen", () => {
    stubLayout(700, 540, 1400, 1000);
    loadApplication();
    expect(Number(document.body.style.zoom)).toBe(1.25);
  });

  it("shrinks the page so a 768px-tall screen needs no scrollbar", () => {
    stubLayout(700, 540, 1366, 768);
    loadApplication();
    const zoom = Number(document.body.style.zoom);
    expect(zoom).toBeCloseTo((768 - 8) / 700, 3);
    expect(700 * zoom).toBeLessThanOrEqual(768);
  });

  it("refits when the window shrinks", () => {
    stubLayout(700, 540, 1400, 1000);
    loadApplication();
    expect(Number(document.body.style.zoom)).toBe(1.25);

    Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
    window.dispatchEvent(new Event("resize"));

    expect(Number(document.body.style.zoom)).toBeCloseTo((600 - 8) / 700, 3);
  });

  it("leaves the mobile layout alone", () => {
    window.matchMedia = (query) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
    stubLayout(700, 540, 390, 844);
    loadApplication();
    expect(document.body.style.zoom).toBe("");
    delete window.matchMedia;
  });
});
