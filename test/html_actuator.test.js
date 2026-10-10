import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

/**
 * HTMLActuator tests — jsdom with a minimal game-board skeleton.
 *
 * HTMLActuator queries .tile-container / .score-container /
 * .best-container / .game-message at construction time and labels the
 * .grid-container cells at actuate time, so we build that DOM before each
 * test. window.requestAnimationFrame is faked to run synchronously (jsdom
 * has no rendering loop).
 */
function buildBoardDom() {
  const rows = Array.from(
    { length: 4 },
    () => `<div class="grid-row">${'<div class="grid-cell"></div>'.repeat(4)}</div>`
  ).join("");
  document.body.innerHTML = `
    <div class="score-container">0</div>
    <div class="best-container">0</div>
    <div class="tile-container"></div>
    <div class="game-message"><p></p></div>
    <div class="grid-container">${rows}</div>
  `;
}

/** jsdom lacks requestAnimationFrame in this environment. */
function installFakeRaf() {
  window.requestAnimationFrame = (fn) => {
    fn();
    return 0;
  };
}

describe("HTMLActuator", () => {
  let actuator;

  beforeEach(() => {
    buildBoardDom();
    installFakeRaf();
    actuator = new HTMLActuator(globalThis.themeManager);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("fontSizeForLabel", () => {
    it("returns the largest size for short labels", () => {
      expect(actuator.fontSizeForLabel("2")).toBe(55);
      expect(actuator.fontSizeForLabel("64")).toBe(55);
    });

    it("steps down as labels grow", () => {
      const sizes = ["2", "128", "1024", "Staff", "Intern", "Backlog", "Principal"].map((l) =>
        actuator.fontSizeForLabel(l)
      );
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeLessThan(sizes[i - 1]);
      }
    });

    it("returns the smallest size for the longest labels", () => {
      expect(actuator.fontSizeForLabel("Principal II")).toBe(15);
      expect(actuator.fontSizeForLabel("Principal III")).toBe(15);
    });
  });

  describe("positionClass", () => {
    it("converts 0-indexed positions to 1-indexed class names", () => {
      expect(actuator.positionClass({ x: 0, y: 0 })).toBe("tile-position-1-1");
      expect(actuator.positionClass({ x: 3, y: 2 })).toBe("tile-position-4-3");
    });
  });

  describe("updateScore", () => {
    it("renders the current score", () => {
      actuator.updateScore(42);
      expect(document.querySelector(".score-container").textContent).toContain("42");
    });

    it("shows a +difference addition when the score increases", () => {
      actuator.updateScore(10);
      actuator.updateScore(14);
      const addition = document.querySelector(".score-addition");
      expect(addition).not.toBeNull();
      expect(addition.textContent).toBe("+4");
    });

    it("hides the decorative addition from screen readers", () => {
      actuator.updateScore(10);
      actuator.updateScore(14);
      expect(document.querySelector(".score-addition").getAttribute("aria-hidden")).toBe("true");
    });

    it("shows no addition when the score does not increase", () => {
      actuator.updateScore(10);
      actuator.updateScore(10);
      expect(document.querySelector(".score-addition")).toBeNull();
    });
  });

  describe("board accessibility (cells carry state, tiles are visual)", () => {
    it("labels the occupied cell and hides the duplicate tile from AT", () => {
      const tile = new Tile({ x: 1, y: 2 }, 8);
      const grid = new Grid(4);
      grid.insertTile(tile);

      actuator.actuate(grid, { score: 0, bestScore: 0, terminated: false });

      // The accessible board is the cell; it announces content + position.
      const cells = document.querySelectorAll(".grid-container .grid-cell");
      const expected = `${globalThis.themeManager.getLabel(8)}, row 3 column 2`;
      expect(cells[2 * 4 + 1].getAttribute("aria-label")).toBe(expected);
      // Empty cells are announced as empty rather than silent.
      expect(cells[0].getAttribute("aria-label")).toBe("row 1 column 1, empty");
      // The visual tile is a duplicate and stays out of the a11y tree.
      const wrapper = document.querySelector(".tile-container .tile");
      expect(wrapper.getAttribute("aria-hidden")).toBe("true");
      expect(wrapper.hasAttribute("role")).toBe(false);
    });

    it("labels cells with the theme label, not raw values", () => {
      const grid = new Grid(4);
      grid.insertTile(new Tile({ x: 0, y: 0 }, 2048));

      actuator.actuate(grid, { score: 0, bestScore: 0, terminated: false });

      const cell = document.querySelector(".grid-container .grid-cell");
      const expectedLabel = globalThis.themeManager.getLabel(2048);
      expect(cell.getAttribute("aria-label")).toContain(expectedLabel);
    });

    it("is a no-op when the markup has no grid cells (older fixtures)", () => {
      document.querySelector(".grid-container").remove();
      const grid = new Grid(4);
      expect(() =>
        actuator.actuate(grid, { score: 0, bestScore: 0, terminated: false })
      ).not.toThrow();
    });
  });

  describe("message / clearMessage", () => {
    it("announces a win through the live region", () => {
      actuator.message(true);
      const box = document.querySelector(".game-message");
      expect(box.classList.contains("game-won")).toBe(true);
      expect(box.querySelector("p").textContent).toBe("You win!");
      expect(box.getAttribute("aria-live")).toBe("assertive");
    });

    it("announces game over", () => {
      actuator.message(false);
      const box = document.querySelector(".game-message");
      expect(box.classList.contains("game-over")).toBe(true);
      expect(box.querySelector("p").textContent).toBe("Game over!");
    });

    it("clears message classes on continueGame but keeps live region", () => {
      actuator.message(true);
      actuator.continueGame();
      const box = document.querySelector(".game-message");
      expect(box.classList.contains("game-won")).toBe(false);
      expect(box.classList.contains("game-over")).toBe(false);
    });
  });

  describe("actuate termination metadata", () => {
    it("shows the lose message on over", () => {
      const grid = new Grid(4);
      actuator.actuate(grid, {
        score: 12,
        bestScore: 34,
        terminated: true,
        over: true,
        won: false,
      });
      expect(document.querySelector(".game-message").classList.contains("game-over")).toBe(true);
    });

    it("shows the win message on won", () => {
      const grid = new Grid(4);
      actuator.actuate(grid, {
        score: 12,
        bestScore: 34,
        terminated: true,
        over: false,
        won: true,
      });
      expect(document.querySelector(".game-message").classList.contains("game-won")).toBe(true);
    });

    it("updates best score text", () => {
      const grid = new Grid(4);
      actuator.actuate(grid, {
        score: 0,
        bestScore: 512,
        terminated: false,
      });
      expect(document.querySelector(".best-container").textContent).toContain("512");
    });
  });
});
