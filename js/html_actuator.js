/* exported HTMLActuator */
class HTMLActuator {
  constructor(themeManagerRef) {
    this.themeManager = themeManagerRef;
    this.tileContainer = document.querySelector(".tile-container");
    this.scoreContainer = document.querySelector(".score-container");
    this.bestContainer = document.querySelector(".best-container");
    this.movesContainer = document.querySelector(".moves-container");
    this.timerContainer = document.querySelector(".timer-container");
    this.messageContainer = document.querySelector(".game-message");
    this.undoButton = /** @type {HTMLButtonElement | null} */ (
      document.querySelector(".undo-button")
    );
    this.dailyButton = document.querySelector(".daily-button");
    this.shareButton = document.querySelector(".share-button");
    this.celebrationLayer = document.querySelector(".celebration-layer");

    this.score = 0;
  }

  actuate(grid, metadata) {
    window.requestAnimationFrame(() => this.renderNow(grid, metadata));
  }

  /*
   * The synchronous DOM work. actuate() defers this to the next frame;
   * the view-transition update phase calls it directly, because rAF is
   * paused while a transition's update callback is pending — waiting on
   * a frame there makes Chromium abort the transition after its 4 s
   * DOM-update timeout (see js/view_transitions.js).
   */
  renderNow(grid, metadata) {
    this.clearContainer(this.tileContainer);

    grid.cells.forEach((column) => {
      column.forEach((cell) => {
        if (cell) this.addTile(cell);
      });
    });

    this.updateScore(metadata.score);
    this.updateBestScore(metadata.bestScore);
    this.updateMoves(metadata.moves);
    this.updateTimer(metadata.elapsed);
    this.updateControls(metadata);
    this.updateCells(grid);

    if (metadata.terminated) {
      if (metadata.over) {
        this.message(false, metadata); // You lose
      } else if (metadata.won) {
        this.message(true, metadata); // You win!
      }
    }
  }

  // Sync the Undo / Daily buttons with game state. Native `disabled` keeps
  // an unavailable Undo out of the tab order and announces it as dimmed.
  updateControls(metadata) {
    if (this.undoButton) this.undoButton.disabled = !metadata.canUndo;
    const daily = metadata.mode === "daily";
    if (this.dailyButton) this.dailyButton.setAttribute("aria-pressed", String(daily));
    document.body.classList.toggle("daily-mode", daily);
    if (this.bestContainer) {
      this.bestContainer.setAttribute(
        "aria-label",
        daily ? `Daily best score for ${metadata.date}` : "Best score"
      );
    }
  }

  // The accessible board is the 4x4 grid of cells (role="gridcell"); the
  // absolutely-positioned tiles are a visual duplicate and are aria-hidden.
  // Each cell announces its content plus 1-indexed row/column, so screen
  // reader grid navigation reads the real board state — including empties.
  updateCells(grid) {
    const cells = document.querySelectorAll(".grid-container .grid-row .grid-cell");
    if (cells.length === 0) return; // minimal test fixtures / older markup
    cells.forEach((cell, index) => {
      const x = index % grid.size;
      const y = Math.floor(index / grid.size);
      const tile = grid.cells[x] && grid.cells[x][y];
      cell.setAttribute(
        "aria-label",
        tile
          ? `${this.themeManager.getLabel(tile.value)}, row ${y + 1} column ${x + 1}`
          : `row ${y + 1} column ${x + 1}, empty`
      );
    });
  }

  // Moves made in the current game (see GameManager.move). Not a live
  // region: it changes on every move, and the score already announces.
  updateMoves(moves) {
    if (this.movesContainer && moves !== undefined) {
      this.movesContainer.textContent = String(moves);
    }
  }

  // Elapsed play time ("MM:SS"), refreshed from the metadata on every
  // render and by the application's interval while the clock runs.
  updateTimer(text) {
    if (this.timerContainer && text !== undefined) {
      this.timerContainer.textContent = text;
    }
  }

  // Feedback for a move that changed nothing (see GameManager.move):
  // a short board shake. Reduced motion turns the animation off in CSS.
  shake() {
    const target = this.tileContainer || document.querySelector(".game-container");
    if (!target) return;
    target.classList.remove("board-shake");
    // Force a reflow so a rapid second invalid move restarts the animation.
    target.getBoundingClientRect();
    target.classList.add("board-shake");
    clearTimeout(this.shakeTimer);
    this.shakeTimer = setTimeout(() => target.classList.remove("board-shake"), 220);
  }

  // Opt-in celebration (see js/preferences.js): a confetti burst plus a
  // glowing overlay on a win, a soft glow on a loss. Never called while
  // animations are off — GameManager checks before invoking.
  celebrate(won) {
    if (!this.messageContainer) return;
    const cls = won ? "celebrate-win" : "celebrate-loss";
    this.messageContainer.classList.add(cls);
    clearTimeout(this.celebrateTimer);
    this.celebrateTimer = setTimeout(() => {
      this.messageContainer.classList.remove(cls);
    }, 1800);

    if (!won || !this.celebrationLayer) return;
    this.celebrationLayer.textContent = "";
    const colors = ["#edc22e", "#f67c5f", "#63b3ed", "#68d391", "#f6ad55", "#e8a0bf"];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--fall-duration", `${(2.2 + Math.random() * 1.6).toFixed(2)}s`);
      piece.style.setProperty("--fall-delay", `${(Math.random() * 0.4).toFixed(2)}s`);
      piece.style.setProperty("--drift", `${(Math.random() * 160 - 80).toFixed(0)}px`);
      this.celebrationLayer.appendChild(piece);
    }
    clearTimeout(this.confettiTimer);
    this.confettiTimer = setTimeout(() => {
      this.celebrationLayer.textContent = "";
    }, 4600);
  }

  // Brief feedback on the Share button: swap the visible label and the
  // accessible name, then restore both after a moment. Only the latest
  // attempt wins — a new copy supersedes a pending revert.
  shareFeedback(copied) {
    if (!this.shareButton) return;
    clearTimeout(this.shareTimer);
    this.shareButton.textContent = copied ? "Copied!" : "Copy failed";
    this.shareButton.setAttribute(
      "aria-label",
      copied ? "Result copied to clipboard" : "Could not copy result"
    );
    this.shareTimer = setTimeout(() => {
      this.shareButton.textContent = "Share";
      this.shareButton.setAttribute("aria-label", "Share result");
    }, 1500);
  }

  // Continues the game (both restart and keep playing)
  continueGame() {
    this.clearMessage();
  }

  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  addTile(tile) {
    const wrapper = document.createElement("div");
    const inner = document.createElement("div");
    const position = tile.previousPosition || { x: tile.x, y: tile.y };
    const positionClass = this.positionClass(position);

    const classes = ["tile", `tile-${tile.value}`, positionClass];

    this.applyClasses(wrapper, classes);

    inner.classList.add("tile-inner");

    const label = this.themeManager.getLabel(tile.value);
    const colors = this.themeManager.getColors(tile.value);
    inner.textContent = label;
    inner.style.backgroundColor = colors.bg;
    inner.style.color = colors.fg;
    inner.style.setProperty("--tile-font-size", `${this.fontSizeForLabel(label)}px`);

    // The tile is the visual layer only — the accessible board state lives
    // on the grid's cells (see updateCells). Hide the duplicate from AT so
    // a screen reader hears each cell once, not the cell plus its tile.
    wrapper.setAttribute("aria-hidden", "true");

    if (tile.previousPosition) {
      // Make sure that the tile gets rendered in the previous position first
      window.requestAnimationFrame(() => {
        classes[2] = this.positionClass({ x: tile.x, y: tile.y });
        this.applyClasses(wrapper, classes); // Update the position
      });
    } else if (tile.mergedFrom) {
      classes.push("tile-merged");
      this.applyClasses(wrapper, classes);

      // Render the tiles that merged
      tile.mergedFrom.forEach((merged) => this.addTile(merged));
    } else {
      classes.push("tile-new");
      this.applyClasses(wrapper, classes);
    }

    // Add the inner part of the tile to the wrapper
    wrapper.appendChild(inner);

    // Put the tile on the board
    this.tileContainer.appendChild(wrapper);
  }

  applyClasses(element, classes) {
    element.setAttribute("class", classes.join(" "));
  }

  /**
   * Pick a font size (in px) that fits the tile width based on label length.
   * Desktop tiles are 107px wide; these sizes are tuned so the longest
   * labels ("Principal", "Deployed", "Principal II") still fit on one line.
   * Mobile scales them down to ~55% via the CSS media query.
   */
  fontSizeForLabel(label) {
    const len = label.length;
    if (len <= 2) return 55; // "2", "64", "Mid", "PR", "13", "21"
    if (len <= 3) return 45; // "128", "256", "512"
    if (len <= 4) return 35; // "1024", "2048"
    if (len <= 5) return 28; // "Staff"
    if (len <= 6) return 24; // "Intern", "Junior", "Senior", "Review", "Merged"
    if (len <= 7) return 20; // "Backlog"
    if (len <= 9) return 18; // "Principal", "Approved", "Deployed"
    return 15; // "Principal II", "Principal III"
  }

  // Convert 0-indexed {x,y} to the 1-indexed form used in CSS class
  // names (.tile-position-1-1, .tile-position-1-2, ...).
  to1Indexed(position) {
    return { x: position.x + 1, y: position.y + 1 };
  }

  positionClass(position) {
    const normalized = this.to1Indexed(position);
    return `tile-position-${normalized.x}-${normalized.y}`;
  }

  updateScore(score) {
    this.clearContainer(this.scoreContainer);

    const difference = score - this.score;
    this.score = score;

    this.scoreContainer.textContent = String(this.score);

    if (difference > 0) {
      const addition = document.createElement("div");
      addition.classList.add("score-addition");
      addition.textContent = `+${difference}`;
      // The animation is decorative; screen readers using role="status"
      // would otherwise announce "4 plus 2" on every move.
      addition.setAttribute("aria-hidden", "true");
      this.scoreContainer.appendChild(addition);
    }
  }

  updateBestScore(bestScore) {
    this.bestContainer.textContent = bestScore;
  }

  message(won, metadata) {
    const type = won ? "game-won" : "game-over";
    const message = won ? "You win!" : "Game over!";

    this.messageContainer.classList.add(type);
    const messageParagraph = this.messageContainer.getElementsByTagName("p")[0];
    messageParagraph.textContent = message;
    this.renderRunDetails(metadata);
    // Ensure the live region re-announces even if the message text is
    // identical to a previous announcement (e.g. game over twice in a row).
    this.messageContainer.setAttribute("aria-live", "assertive");
  }

  // The end overlay carries the run's numbers, not just the verdict:
  // score, moves, clock and best tile, plus a "New best!" chip when this
  // run beat everything before it. Metadata may be missing in older
  // callers (tests, older fixtures) — then the details stay empty.
  renderRunDetails(metadata) {
    const details = /** @type {HTMLElement | null} */ (
      this.messageContainer.querySelector(".run-details")
    );
    const chip = /** @type {HTMLElement | null} */ (
      this.messageContainer.querySelector(".new-best-chip")
    );
    if (details) {
      if (metadata) {
        const tile = metadata.bestTile ? this.themeManager.getLabel(metadata.bestTile) : "—";
        details.textContent = `Score ${metadata.score} · ${metadata.moves || 0} moves · ${
          metadata.elapsed || "00:00"
        } · best tile ${tile}`;
      } else {
        details.textContent = "";
      }
    }
    if (chip) chip.hidden = !(metadata && metadata.newBest);
  }

  clearMessage() {
    this.messageContainer.classList.remove("game-won", "game-over");
    // Drop the assertive live region again: an overlay that is gone should
    // not keep interrupting the screen reader on later updates.
    this.messageContainer.removeAttribute("aria-live");
    const details = /** @type {HTMLElement | null} */ (
      this.messageContainer.querySelector(".run-details")
    );
    if (details) details.textContent = "";
    const chip = /** @type {HTMLElement | null} */ (
      this.messageContainer.querySelector(".new-best-chip")
    );
    if (chip) chip.hidden = true;
  }
}
