/* exported GameManager */
/* global Grid, Tile, SeededRandom, themeManager, DIRECTIONS, soundManager, ViewTransitions */
class GameManager {
  constructor(size, InputManager, Actuator, StorageManager) {
    this.size = size; // Size of the grid
    this.inputManager = new InputManager();
    this.storageManager = new StorageManager();
    this.actuator = new Actuator(themeManager);

    // Hand the shared sound instance its storage manager so the player's
    // mute preference is read on boot and written on every change.
    soundManager.attachStorage(this.storageManager);

    this.startTiles = 2;
    this.winThreshold = themeManager.get().winThreshold;
    // Undo depth. Snapshots are persisted with the game, so the cap also
    // bounds how much localStorage one save uses.
    this.maxUndo = 10;
    // "classic" (Math.random) or "daily" (seeded from today's date).
    this.mode = this.storageManager.getMode ? this.storageManager.getMode() : "classic";

    this.inputManager.on("move", this.move.bind(this));
    this.inputManager.on("restart", this.restart.bind(this));
    this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
    this.inputManager.on("undo", this.undo.bind(this));
    this.inputManager.on("toggleDaily", this.toggleDaily.bind(this));

    themeManager.onChange((theme) => {
      this.winThreshold = theme.winThreshold;
      // Recompute the won state against the new threshold so the win
      // overlay doesn't linger (or fail to appear) after a theme
      // switch. If the player already chose to keep playing, preserve
      // the existing won flag — the overlay is gated by
      // keepPlayingEnabled in that case.
      if (!this.keepPlayingEnabled) {
        this.won = this.hasWinningTile();
      }
      this.actuate();
    });

    this.setup();
  }

  // Restart the game
  restart() {
    // A New Game replaces the whole board, which is exactly what a view
    // transition is for (see js/view_transitions.js). Merges are not.
    ViewTransitions.run(() => {
      this.storageManager.clearGameState(this.mode);
      this.actuator.continueGame(); // Clear the game won/lost message
      this.setup();
    });
  }

  // Keep playing after winning (allows going over 2048)
  keepPlaying() {
    this.keepPlayingEnabled = true;
    // Persist the new state so the win overlay doesn't reappear on
    // refresh before the next move. actuate() serializes (with
    // keepPlayingEnabled now true) and re-renders; continueGame()
    // clears the overlay immediately.
    this.actuate();
    this.actuator.continueGame();
  }

  // Return true if the game is lost, or has won and the user hasn't kept playing
  isGameTerminated() {
    return this.over || (this.won && !this.keepPlayingEnabled);
  }

  // Set up the game
  setup() {
    this.date = SeededRandom.dateKey();
    this.history = [];
    this.rng = null;
    let previousState = this.storageManager.getGameState(this.mode);
    // A Daily save from an earlier day is stale: today has a new board.
    if (previousState && this.mode === "daily" && previousState.date !== this.date) {
      this.storageManager.clearGameState(this.mode);
      previousState = null;
    }

    // Reload the game from a previous game if present
    if (previousState) {
      try {
        this.applySnapshot(previousState);
        this.history = Array.isArray(previousState.history) ? previousState.history : [];
      } catch (_e) {
        // Malformed persisted state — start a fresh game instead of crashing
        this.storageManager.clearGameState(this.mode);
        this.startFresh();
      }
    } else {
      this.startFresh();
    }

    // Update the actuator
    this.actuate();
  }

  startFresh() {
    this.history = [];
    this.rng = this.mode === "daily" ? new SeededRandom(SeededRandom.seedFor(this.date)) : null;
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlayingEnabled = false;
    this.addStartTiles();
  }

  applySnapshot(s) {
    this.grid = new Grid(s.grid.size, s.grid.cells);
    this.score = s.score;
    this.over = s.over;
    this.won = s.won;
    this.keepPlayingEnabled = s.keepPlayingEnabled || s.keepPlaying || false;
    this.rng = this.mode === "daily" ? new SeededRandom(s.rngState) : null;
  }

  // Set up the initial tiles to start the game with
  addStartTiles() {
    for (let i = 0; i < this.startTiles; i++) {
      this.addRandomTile();
    }
  }

  // Adds a tile in a random position
  addRandomTile() {
    if (this.grid.cellsAvailable()) {
      const random = this.rng ? () => this.rng.next() : Math.random;
      const value = random() < 0.9 ? 2 : 4;
      const tile = new Tile(this.grid.randomAvailableCell(random), value);
      this.grid.insertTile(tile);
    }
  }

  // Sends the updated grid to the actuator
  actuate() {
    const bestArgs = [this.mode, this.date];
    if (this.storageManager.getBestScore(...bestArgs) < this.score) {
      this.storageManager.setBestScore(this.score, ...bestArgs);
    }

    // Clear the state when the game is over (game over only, not win)
    if (this.over) {
      this.storageManager.clearGameState(this.mode);
    } else {
      this.storageManager.setGameState(this.serialize(), this.mode);
    }

    this.actuator.actuate(this.grid, {
      score: this.score,
      over: this.over,
      won: this.won,
      bestScore: this.storageManager.getBestScore(...bestArgs),
      terminated: this.isGameTerminated(),
      canUndo: this.canUndo(),
      mode: this.mode,
      date: this.date,
    });
  }

  // Switch between Classic and the Daily Challenge. Each mode keeps its
  // own save, so toggling back resumes where the player left off.
  toggleDaily() {
    ViewTransitions.run(() => {
      this.mode = this.mode === "daily" ? "classic" : "daily";
      if (this.storageManager.setMode) this.storageManager.setMode(this.mode);
      this.actuator.continueGame();
      this.setup();
    });
  }

  // Represent the current game as an object
  serialize() {
    return {
      grid: this.grid.serialize(),
      score: this.score,
      over: this.over,
      won: this.won,
      keepPlayingEnabled: this.keepPlayingEnabled,
      mode: this.mode,
      date: this.date,
      rngState: this.rng ? this.rng.state : null,
      history: this.history,
    };
  }

  // One undo step: the board as it was, plus the RNG position so the
  // Daily Challenge replays the same spawn (undo can't re-roll tiles).
  snapshot() {
    return {
      grid: this.grid.serialize(),
      score: this.score,
      over: this.over,
      won: this.won,
      keepPlayingEnabled: this.keepPlayingEnabled,
      rngState: this.rng ? this.rng.state : null,
    };
  }

  canUndo() {
    return this.history.length > 0;
  }

  // Step back one move. Works after game over too, so a losing move can
  // be taken back.
  undo() {
    const snap = this.history.pop();
    if (!snap) return;
    this.applySnapshot(snap);
    this.actuator.continueGame(); // Clear a win/lose overlay
    this.actuate();
  }

  // Save all tile positions and remove merger info
  prepareTiles() {
    this.grid.eachCell((x, y, tile) => {
      if (tile) {
        tile.mergedFrom = null;
        tile.savePosition();
      }
    });
  }

  // Move a tile and its representation
  moveTile(tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  }

  // Move tiles on the grid in the specified direction
  move(direction) {
    // 0: up, 1: right, 2: down, 3: left
    if (this.isGameTerminated()) return; // Don't do anything if the game's over

    // Snapshot before mutating; only kept if the move actually changes the board.
    const before = this.snapshot();
    const vector = this.getVector(direction);
    const traversals = this.buildTraversals(vector);
    let moved = false;
    // Values this move produced, in the order they merged, so the sound
    // layer can play one blip per merge instead of a single louder one.
    const mergedValues = [];

    // Save the current tile positions and remove merger information
    this.prepareTiles();

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach((x) => {
      traversals.y.forEach((y) => {
        const cell = { x, y };
        const tile = this.grid.cellContent(cell);

        if (tile) {
          const positions = this.findFarthestPosition(cell, vector);
          const next = this.grid.cellContent(positions.next);

          // Only one merger per row traversal?
          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];

            this.grid.insertTile(merged);
            this.grid.removeTile(tile);

            // Converge the two tiles' positions
            tile.updatePosition(positions.next);

            // Update the score
            this.score += merged.value;
            mergedValues.push(merged.value);

            // Reaching or exceeding the theme's win threshold wins the
            // game. `>=` keeps custom themes with non-power-of-2 thresholds
            // winnable (a merge can jump past, e.g. Fibonacci 144 -> 233).
            if (merged.value >= this.winThreshold) this.won = true;
          } else {
            this.moveTile(tile, positions.farthest);
          }

          if (!this.positionsEqual(cell, tile)) {
            moved = true; // The tile moved from its original cell!
          }
        }
      });
    });

    if (moved) {
      this.history.push(before);
      if (this.history.length > this.maxUndo) this.history.shift();
      this.addRandomTile();

      if (!this.movesAvailable()) {
        this.over = true; // Game over!
      }

      // Sound follows the move that just happened: the game-over motif
      // replaces the merge/move blips rather than layering on top of them.
      if (this.over) {
        soundManager.gameOver();
      } else if (mergedValues.length > 0) {
        soundManager.merge(mergedValues);
      } else {
        soundManager.move();
      }

      this.actuate();
    }
  }

  // Get the vector representing the chosen direction
  getVector(direction) {
    // Vectors representing tile movement, keyed by the shared
    // DIRECTIONS contract (see js/directions.js).
    const map = {
      [DIRECTIONS.UP]: { x: 0, y: -1 },
      [DIRECTIONS.RIGHT]: { x: 1, y: 0 },
      [DIRECTIONS.DOWN]: { x: 0, y: 1 },
      [DIRECTIONS.LEFT]: { x: -1, y: 0 },
    };
    return map[direction];
  }

  // Build a list of positions to traverse in the right order
  buildTraversals(vector) {
    const traversals = { x: [], y: [] };
    for (let pos = 0; pos < this.size; pos++) {
      traversals.x.push(pos);
      traversals.y.push(pos);
    }

    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();

    return traversals;
  }

  findFarthestPosition(cell, vector) {
    let previous;
    let current = cell;

    // Progress towards the vector direction until an obstacle is found
    do {
      previous = current;
      current = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(current) && this.grid.cellAvailable(current));

    return {
      farthest: previous,
      next: current, // Used to check if a merge is required
    };
  }

  movesAvailable() {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable();
  }

  // Check whether any tile on the board meets the current winThreshold.
  // Used to recompute this.won after a theme switch changes the threshold.
  hasWinningTile() {
    let hasWin = false;
    this.grid.eachCell((_x, _y, tile) => {
      if (tile && tile.value >= this.winThreshold) hasWin = true;
    });
    return hasWin;
  }

  // Check for available matches between tiles (more expensive check)
  tileMatchesAvailable() {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.grid.cellContent({ x, y });

        if (tile) {
          for (let direction = 0; direction < 4; direction++) {
            const vector = this.getVector(direction);
            const cell = { x: x + vector.x, y: y + vector.y };
            const other = this.grid.cellContent(cell);

            if (other && other.value === tile.value) {
              return true; // These two tiles can be merged
            }
          }
        }
      }
    }
    return false;
  }

  positionsEqual(first, second) {
    return first.x === second.x && first.y === second.y;
  }
}
