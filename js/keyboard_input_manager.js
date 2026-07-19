/* exported KeyboardInputManager */
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
    // Map KeyboardEvent.key values to game directions:
    // 0: up, 1: right, 2: down, 3: left
    const keyMap = {
      ArrowUp: 0,
      ArrowRight: 1,
      ArrowDown: 2,
      ArrowLeft: 3,
      k: 0,
      l: 1,
      j: 2,
      h: 3, // Vim keys
      K: 0,
      L: 1,
      J: 2,
      H: 3,
      w: 0,
      d: 1,
      s: 2,
      a: 3, // WASD
      W: 0,
      D: 1,
      S: 2,
      A: 3,
    };

    // Respond to direction keys
    document.addEventListener("keydown", (event) => {
      const modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      const mapped = keyMap[event.key];

      if (!modifiers) {
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

      if (Math.max(absDx, absDy) > 10) {
        // (right : left) : (down : up)
        this.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
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
    button.addEventListener("click", fn.bind(this));
    button.addEventListener(this.eventTouchend, fn.bind(this));
  }
}
