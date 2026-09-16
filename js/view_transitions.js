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
 * HTMLActuator renders the board inside requestAnimationFrame, so the
 * update callback has to outlive that frame. Without the extra frame the
 * transition snapshots the old board twice and the new one only appears
 * after the fade has already finished.
 *
 * Falls back to a plain synchronous call when the API is missing (Firefox
 * before 144, older Safari) or when the user asked for reduced motion.
 */
const ViewTransitions = {
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
   * Returns the ViewTransition object, or null when it ran synchronously.
   */
  run(callback) {
    if (!this.supported() || this.prefersReducedMotion()) {
      callback();
      return null;
    }

    return document.startViewTransition(() => {
      callback();
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      });
    });
  },
};
