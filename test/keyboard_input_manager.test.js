import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

// ── DOM fixtures ───────────────────────────────────────────────
// KeyboardInputManager's constructor attaches listeners to document
// and the .game-container element, and binds click/touchend on three
// buttons. We set up a minimal DOM that satisfies those queries so
// the manager can be exercised in jsdom.
function mountDom() {
  document.body.innerHTML = `
    <div class="game-container">
      <a class="retry-button" href="#">Try again</a>
      <a class="restart-button" href="#">New Game</a>
      <a class="keep-playing-button" href="#">Keep going</a>
    </div>
  `;
}

// jsdom doesn't ship a real TouchEvent. Build a lightweight stand-in
// that carries the touch-coordinate arrays the manager reads.
function touchEvent(type, { touches = [], changedTouches = [], targetTouches = [] }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: touches, configurable: true },
    changedTouches: { value: changedTouches, configurable: true },
    targetTouches: { value: targetTouches, configurable: true },
  });
  return event;
}

function touch(x, y) {
  return { clientX: x, clientY: y };
}

describe("KeyboardInputManager", () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    mountDom();
    manager = new KeyboardInputManager();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  describe("on / emit", () => {
    it("delivers emitted events to registered callbacks", () => {
      const cb = vi.fn();
      manager.on("move", cb);
      manager.emit("move", 1);
      expect(cb).toHaveBeenCalledWith(1);
    });

    it("supports multiple callbacks per event", () => {
      const a = vi.fn();
      const b = vi.fn();
      manager.on("restart", a);
      manager.on("restart", b);
      manager.emit("restart");
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe("touch swipe", () => {
    function swipe(startX, startY, endX, endY) {
      const container = document.querySelector(".game-container");
      container.dispatchEvent(
        touchEvent("touchstart", {
          touches: [touch(startX, startY)],
          targetTouches: [touch(startX, startY)],
        })
      );
      container.dispatchEvent(
        touchEvent("touchend", {
          touches: [],
          targetTouches: [],
          changedTouches: [touch(endX, endY)],
        })
      );
    }

    it("emits RIGHT when the finger moves rightward beyond the threshold", () => {
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      swipe(0, 0, 60, 0);
      expect(moves).toEqual([DIRECTIONS.RIGHT]);
    });

    it("emits LEFT when the finger moves leftward beyond the threshold", () => {
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      swipe(60, 0, 0, 0);
      expect(moves).toEqual([DIRECTIONS.LEFT]);
    });

    it("emits DOWN when the finger moves downward beyond the threshold", () => {
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      swipe(0, 0, 0, 60);
      expect(moves).toEqual([DIRECTIONS.DOWN]);
    });

    it("emits UP when the finger moves upward beyond the threshold", () => {
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      swipe(0, 60, 0, 0);
      expect(moves).toEqual([DIRECTIONS.UP]);
    });

    it("does not emit a move when the swipe is below the threshold", () => {
      // Threshold is 30px; a 15px jitter must not trigger a move.
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      swipe(0, 0, 10, 10);
      expect(moves).toEqual([]);
    });

    it("ignores multi-finger touchstart", () => {
      const moves = [];
      manager.on("move", (d) => moves.push(d));
      const container = document.querySelector(".game-container");
      // Two fingers down — touchstart returns early, leaving
      // touchStartClient{X,Y} undefined; the subsequent touchend
      // with no start coordinates is a no-op (NaN comparison).
      container.dispatchEvent(
        touchEvent("touchstart", {
          touches: [touch(0, 0), touch(10, 10)],
          targetTouches: [touch(0, 0), touch(10, 10)],
        })
      );
      container.dispatchEvent(
        touchEvent("touchend", {
          touches: [],
          targetTouches: [],
          changedTouches: [touch(60, 0)],
        })
      );
      expect(moves).toEqual([]);
    });
  });

  describe("button double-fire prevention", () => {
    it("fires the handler once even when both touchend and click arrive", () => {
      vi.useFakeTimers();
      const restartSpy = vi.fn();
      manager.on("restart", restartSpy);

      const button = document.querySelector(".retry-button");
      // Provide non-empty touches so the .game-container swipe handler
      // returns early; only the button's own listener should fire.
      button.dispatchEvent(touchEvent("touchend", { touches: [{}], targetTouches: [{}] }));
      button.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(restartSpy).toHaveBeenCalledTimes(1);

      // After the dedup window elapses, a fresh click should fire again.
      vi.advanceTimersByTime(400);
      button.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
      expect(restartSpy).toHaveBeenCalledTimes(2);
    });

    it("fires the handler on a pure click (no touchend)", () => {
      const restartSpy = vi.fn();
      manager.on("restart", restartSpy);

      const button = document.querySelector(".restart-button");
      button.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(restartSpy).toHaveBeenCalledTimes(1);
    });

    it("keep-playing button emits keepPlaying", () => {
      const keepPlayingSpy = vi.fn();
      manager.on("keepPlaying", keepPlayingSpy);

      const button = document.querySelector(".keep-playing-button");
      button.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(keepPlayingSpy).toHaveBeenCalledTimes(1);
    });
  });
});
