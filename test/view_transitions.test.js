import { describe, it, expect, vi, afterEach } from "vitest";

import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("ViewTransitions", () => {
  const originalSvt = document.startViewTransition;
  const originalMatchMedia = window.matchMedia;

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
});
