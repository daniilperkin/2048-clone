/* exported HTMLActuator */
class HTMLActuator {
  constructor(themeManagerRef) {
    this.themeManager = themeManagerRef;
    this.tileContainer = document.querySelector(".tile-container");
    this.scoreContainer = document.querySelector(".score-container");
    this.bestContainer = document.querySelector(".best-container");
    this.messageContainer = document.querySelector(".game-message");
    this.undoButton = document.querySelector(".undo-button");
    this.dailyButton = document.querySelector(".daily-button");
    this.shareButton = document.querySelector(".share-button");

    this.score = 0;
  }

  actuate(grid, metadata) {
    window.requestAnimationFrame(() => {
      this.clearContainer(this.tileContainer);

      grid.cells.forEach((column) => {
        column.forEach((cell) => {
          if (cell) this.addTile(cell);
        });
      });

      this.updateScore(metadata.score);
      this.updateBestScore(metadata.bestScore);
      this.updateControls(metadata);
      this.updateCells(grid);

      if (metadata.terminated) {
        if (metadata.over) {
          this.message(false); // You lose
        } else if (metadata.won) {
          this.message(true); // You win!
        }
      }
    });
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

    this.scoreContainer.textContent = this.score;

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

  message(won) {
    const type = won ? "game-won" : "game-over";
    const message = won ? "You win!" : "Game over!";

    this.messageContainer.classList.add(type);
    const messageParagraph = this.messageContainer.getElementsByTagName("p")[0];
    messageParagraph.textContent = message;
    // Ensure the live region re-announces even if the message text is
    // identical to a previous announcement (e.g. game over twice in a row).
    this.messageContainer.setAttribute("aria-live", "assertive");
  }

  clearMessage() {
    this.messageContainer.classList.remove("game-won", "game-over");
  }
}
