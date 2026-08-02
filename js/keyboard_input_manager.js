/* exported KeyboardInputManager */
/* global DIRECTIONS */
class KeyboardInputManager {
  constructor() {
    this.events = {};

    this.eventTouchstart = "touchstart";
    this.eventTouchmove = "touchmove";
    this.eventTouchend = "touchend";

    this.listen();
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, data) {
    const callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  listen() {
    // Map KeyboardEvent.key values to game directions using the shared
    // DIRECTIONS contract (see js/directions.js).
    const keyMap = {
      ArrowUp: DIRECTIONS.UP,
      ArrowRight: DIRECTIONS.RIGHT,
      ArrowDown: DIRECTIONS.DOWN,
      ArrowLeft: DIRECTIONS.LEFT,
      k: DIRECTIONS.UP,
      l: DIRECTIONS.RIGHT,
      j: DIRECTIONS.DOWN,
      h: DIRECTIONS.LEFT, // Vim keys
      K: DIRECTIONS.UP,
      L: DIRECTIONS.RIGHT,
      J: DIRECTIONS.DOWN,
      H: DIRECTIONS.LEFT,
      w: DIRECTIONS.UP,
      d: DIRECTIONS.RIGHT,
      s: DIRECTIONS.DOWN,
      a: DIRECTIONS.LEFT, // WASD
      W: DIRECTIONS.UP,
      D: DIRECTIONS.RIGHT,
      S: DIRECTIONS.DOWN,
      A: DIRECTIONS.LEFT,
    };

    // Respond to direction keys
    document.addEventListener("keydown", (event) => {
      const modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      const mapped = keyMap[event.key];

      // Don't intercept arrow keys while the theme <select> (or any
      // form control) has focus — the user is navigating the dropdown,
      // not playing the game.
      const inFormControl =
        document.activeElement &&
        ["SELECT", "INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

      if (!modifiers && !inFormControl) {
        if (mapped !== undefined) {
          event.preventDefault();
          // Ignore auto-repeat key events so holding an arrow doesn't
          // fire a move on every OS key-repeat tick (which would make
          // the game race forward uncontrollably).
          if (event.repeat) return;
          this.emit("move", mapped);
        }

        // R key restarts the game (also ignore repeats here)
        if ((event.key === "r" || event.key === "R") && !event.repeat) {
          this.restart(event);
        }
      }
    });

    // Respond to button presses
    this.bindButtonPress(".retry-button", this.restart);
    this.bindButtonPress(".restart-button", this.restart);
    this.bindButtonPress(".keep-playing-button", this.keepPlaying);

    // Respond to swipe events
    let touchStartClientX, touchStartClientY;
    const gameContainer = document.getElementsByClassName("game-container")[0];

    gameContainer.addEventListener(this.eventTouchstart, (event) => {
      if (event.touches.length > 1 || event.targetTouches.length > 1) {
        return; // Ignore if touching with more than 1 finger
      }

      touchStartClientX = event.touches[0].clientX;
      touchStartClientY = event.touches[0].clientY;

      event.preventDefault();
    });

    gameContainer.addEventListener(this.eventTouchmove, (event) => {
      event.preventDefault();
    });

    gameContainer.addEventListener(this.eventTouchend, (event) => {
      if (event.touches.length > 0 || event.targetTouches.length > 0) {
        return; // Ignore if still touching with one or more fingers
      }

      const touchEndClientX = event.changedTouches[0].clientX;
      const touchEndClientY = event.changedTouches[0].clientY;

      const dx = touchEndClientX - touchStartClientX;
      const absDx = Math.abs(dx);

      const dy = touchEndClientY - touchStartClientY;
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 30) {
        // (right : left) : (down : up)
        this.emit(
          "move",
          absDx > absDy
            ? dx > 0
              ? DIRECTIONS.RIGHT
              : DIRECTIONS.LEFT
            : dy > 0
              ? DIRECTIONS.DOWN
              : DIRECTIONS.UP
        );
      }
    });
  }

  restart(event) {
    event.preventDefault();
    this.emit("restart");
  }

  keepPlaying(event) {
    event.preventDefault();
    this.emit("keepPlaying");
  }

  bindButtonPress(selector, fn) {
    const button = document.querySelector(selector);

    // On touch devices both 'touchend' and 'click' fire (~300ms apart).
    // Use a flag to prevent the handler from executing twice for a
    // single user interaction.
    let handled = false;

    button.addEventListener("touchend", (event) => {
      handled = true;
      fn.call(this, event);
      // Reset the flag after the click window has passed so the next
      // interaction (mouse or touch) starts clean.
      setTimeout(() => {
        handled = false;
      }, 350);
    });

    button.addEventListener("click", (event) => {
      if (handled) return;
      fn.call(this, event);
    });
  }
}
