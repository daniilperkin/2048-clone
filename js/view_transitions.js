/* exported ViewTransitions */

/**
 * Native View Transitions helper — progressive enhancement only.
 *
 * Used for the two moments where the board is replaced wholesale: a theme
 * switch and a New Game. Deliberately NOT used for merges — a view
 * transition snapshots the whole document, which would fight the 100 ms
 * tile slide transition and the `pop` merge animation, so merges would
 * double-animate.
 *
 * While a transition's update callback is pending, Chromium pauses
 * rendering — so requestAnimationFrame callbacks DO NOT fire until the
 * callback settles. Waiting on a frame inside the callback therefore
 * deadlocks until Chromium's 4-second "DOM update timed out" watchdog
 * aborts the transition, making every switch take seconds (observed:
 * 4020 ms per switch, callback itself 2 ms). The callback must do all of
 * its DOM work synchronously; `inUpdate` tells GameManager to take the
 * actuator's synchronous renderNow() path while the update phase runs.
 *
 * Falls back to a plain synchronous call when the API is missing (Firefox
 * before 144, older Safari) or when the user asked for reduced motion.
 */
const ViewTransitions = {
  /** True while a transition's update callback is executing. */
  inUpdate: false,

  supported() {
    return typeof document !== "undefined" && typeof document.startViewTransition === "function";
  },

  prefersReducedMotion() {
    return (
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  },

  /**
   * Run `callback` inside a view transition when the browser supports it.
   * The callback runs synchronously in the update phase: everything it
   * renders is part of the new snapshot.
   * Returns the ViewTransition object, or null when it ran synchronously.
   */
  run(callback) {
    if (!this.supported() || this.prefersReducedMotion()) {
      callback();
      return null;
    }

    return document.startViewTransition(() => {
      ViewTransitions.inUpdate = true;
      try {
        callback();
      } finally {
        ViewTransitions.inUpdate = false;
      }
    });
  },
};
