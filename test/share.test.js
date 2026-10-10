import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

function makeGrid(tiles) {
  const grid = new Grid(4);
  for (const [x, y, v] of tiles) grid.insertTile(new Tile({ x, y }, v));
  return grid;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  themeManager.listeners = [];
  themeManager.set("classic");
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

describe("ShareResult.buildText", () => {
  it("renders a classic header, a score line and a 4x4 emoji grid", () => {
    const grid = makeGrid([
      [0, 0, 2],
      [1, 0, 128],
      [3, 3, 2048],
    ]);
    const text = ShareResult.buildText({ grid, score: 42, mode: "classic", date: "2026-10-10" });
    const lines = text.split("\n");
    expect(lines[0]).toBe("2048");
    expect(lines[1]).toBe("Score 42 · Best tile 2048");
    expect(lines).toHaveLength(6);
    expect(lines[2]).toBe("⬜🟨⬛⬛"); // y=0: 2, 128, empty, empty
    expect(lines[5]).toBe("⬛⬛⬛🟩"); // y=3: 2048 in the corner
  });

  it("includes the date in the header for daily games", () => {
    const text = ShareResult.buildText({
      grid: makeGrid([]),
      score: 0,
      mode: "daily",
      date: "2026-10-10",
    });
    expect(text.split("\n")[0]).toBe("2048 Daily — 2026-10-10");
  });

  it("steps the shading with tile value", () => {
    expect(ShareResult.emojiFor(0)).toBe("⬛");
    expect(ShareResult.emojiFor(2)).toBe("⬜");
    expect(ShareResult.emojiFor(8)).toBe("⬜");
    expect(ShareResult.emojiFor(16)).toBe("🟧");
    expect(ShareResult.emojiFor(64)).toBe("🟧");
    expect(ShareResult.emojiFor(128)).toBe("🟨");
    expect(ShareResult.emojiFor(512)).toBe("🟩");
    expect(ShareResult.emojiFor(2048)).toBe("🟩");
  });
});

describe("ShareResult.copy", () => {
  it("uses the async clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await expect(ShareResult.copy("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await expect(ShareResult.copy("x")).resolves.toBe(false);
  });

  it("falls back to execCommand when the async API is missing", async () => {
    document.execCommand = vi.fn().mockReturnValue(true);
    await expect(ShareResult.copy("x")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    // The helper textarea must not be left behind.
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("share button wiring", () => {
  it("routes the Share button click through the input manager", () => {
    document.body.innerHTML = `
      <div class="game-container">
        <div class="game-message"><button class="share-button" type="button">Share</button></div>
      </div>`;
    const manager = new KeyboardInputManager();
    const handler = vi.fn();
    manager.on("share", handler);
    document.querySelector(".share-button").click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("HTMLActuator share feedback", () => {
  it("swaps the label and accessible name, then restores both", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="game-message"><p></p>
        <button class="share-button" type="button" aria-label="Share result">Share</button>
      </div>`;
    const actuator = new HTMLActuator(themeManager);
    const button = document.querySelector(".share-button");

    actuator.shareFeedback(true);
    expect(button.textContent).toBe("Copied!");
    expect(button.getAttribute("aria-label")).toBe("Result copied to clipboard");

    actuator.shareFeedback(false);
    expect(button.textContent).toBe("Copy failed");
    expect(button.getAttribute("aria-label")).toBe("Could not copy result");

    vi.advanceTimersByTime(1600);
    expect(button.textContent).toBe("Share");
    expect(button.getAttribute("aria-label")).toBe("Share result");
    vi.useRealTimers();
  });

  it("is a no-op when the button is absent", () => {
    document.body.innerHTML = "<div></div>";
    const actuator = new HTMLActuator(themeManager);
    expect(() => actuator.shareFeedback(true)).not.toThrow();
  });
});

describe("GameManager.share", () => {
  class MockInput {
    constructor() {
      this.events = {};
    }
    on(e, cb) {
      (this.events[e] = this.events[e] || []).push(cb);
    }
  }

  it("copies the current summary and reports the outcome to the actuator", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const feedback = vi.fn();
    class MockActuator {
      actuate() {}
      continueGame() {}
      shareFeedback(ok) {
        feedback(ok);
      }
    }
    const gm = new GameManager(4, MockInput, MockActuator, LocalStorageManager);
    gm.share();
    await vi.waitFor(() => expect(feedback).toHaveBeenCalledWith(true));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0];
    expect(text.split("\n")[0]).toBe("2048");
    expect(text).toContain("Score 0 · Best tile");
  });
});
