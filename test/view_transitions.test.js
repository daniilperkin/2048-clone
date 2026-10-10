import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

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

describe("ViewTransitions", () => {
  const originalSvt = document.startViewTransition;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    themeManager.listeners = [];
    themeManager.set("classic");
    document.body.innerHTML =
      '<div class="score-container"></div><div class="best-container"></div>' +
      '<div class="game-message"><p></p></div><div class="tile-container"></div>';
  });

  afterEach(() => {
    if (originalSvt === undefined) delete document.startViewTransition;
    else document.startViewTransition = originalSvt;

    if (originalMatchMedia === undefined) delete window.matchMedia;
    else window.matchMedia = originalMatchMedia;

    vi.restoreAllMocks();
  });

  it("runs the callback synchronously when the API is unavailable", () => {
    delete document.startViewTransition;

    let ran = false;
    const result = ViewTransitions.run(() => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(result).toBeNull();
  });

  it("wraps the callback in a view transition when supported", () => {
    const startViewTransition = vi.fn((callback) => {
      callback();
      return { finished: Promise.resolve() };
    });
    document.startViewTransition = startViewTransition;
    window.matchMedia = vi.fn(() => ({ matches: false }));

    let ran = false;
    const result = ViewTransitions.run(() => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });

  it("skips the transition when the user prefers reduced motion", () => {
    const startViewTransition = vi.fn();
    document.startViewTransition = startViewTransition;
    window.matchMedia = vi.fn(() => ({ matches: true }));

    let ran = false;
    const result = ViewTransitions.run(() => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("marks the update phase while the callback runs and clears it after", () => {
    document.startViewTransition = vi.fn((callback) => {
      callback();
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn(() => ({ matches: false }));

    let during = null;
    ViewTransitions.run(() => {
      during = ViewTransitions.inUpdate;
    });

    expect(during).toBe(true);
    expect(ViewTransitions.inUpdate).toBe(false);
  });

  it("does not return a frame-dependent promise from the update callback (the 4 s timeout bug)", () => {
    // While a transition's update callback is pending, Chromium pauses
    // rendering — so a promise that waits on requestAnimationFrame never
    // settles and the browser aborts the transition after its 4-second
    // DOM-update watchdog. The callback must return undefined.
    let updateResult = "not-run";
    document.startViewTransition = vi.fn((callback) => {
      updateResult = callback();
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn(() => ({ matches: false }));

    ViewTransitions.run(() => {});

    expect(updateResult).toBeUndefined();
  });

  it("renders the board without needing any animation frame inside the update phase", () => {
    let updateCallback;
    document.startViewTransition = vi.fn((callback) => {
      updateCallback = callback;
      return { finished: Promise.resolve() };
    });
    window.matchMedia = vi.fn(() => ({ matches: false }));

    // A frame that never runs its callback, like Chromium during the
    // update phase of a view transition.
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);

    const game = new GameManager(4, MockInput, HTMLActuator, LocalStorageManager);
    // The constructor's render is frame-deferred and never ran.
    expect(document.querySelectorAll(".tile-container .tile").length).toBe(0);

    game.toggleDaily(); // the browser would capture the old state…
    const rafCallsBefore = rafSpy.mock.calls.length;
    updateCallback(); // …then run the synchronous update phase

    expect(document.querySelectorAll(".tile-container .tile").length).toBe(2);
    expect(document.body.classList.contains("daily-mode")).toBe(true);
    expect(rafSpy.mock.calls.length).toBe(rafCallsBefore);
    expect(ViewTransitions.inUpdate).toBe(false);
  });

  it("skips the transition when the player turned animations off (Settings)", () => {
    const startViewTransition = vi.fn();
    document.startViewTransition = startViewTransition;
    window.matchMedia = vi.fn(() => ({ matches: false }));
    // Preferences.apply() maintains this class; the OS preference is false,
    // so only the body class can trigger the skip.
    document.body.classList.add("reduced-motion");

    let ran = false;
    const result = ViewTransitions.run(() => {
      ran = true;
    });
    document.body.classList.remove("reduced-motion");

    expect(ran).toBe(true);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
