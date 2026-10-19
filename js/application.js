// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions, preferences */
window.requestAnimationFrame(() => {
  // Board size (3 | 4 | 5) comes from storage so every size keeps its own
  // save, best score and records.
  const bootStorage = new LocalStorageManager();
  const boardSize = bootStorage.getSize();
  buildGridCells(boardSize);

  const gameManager = new GameManager(
    boardSize,
    KeyboardInputManager,
    HTMLActuator,
    LocalStorageManager
  );

  // Player preferences (dark mode, animations, ambience, celebrations):
  // read the stored flags and mirror them onto the page before anything
  // else renders.
  preferences.attachStorage(new LocalStorageManager());
  preferences.apply();

  // Fluid board: the grid is a fixed 500px design (tile positions are
  // absolute pixels), so narrow screens scale the whole board down as one
  // unit — --board-scale feeds the CSS transform and the frame height.
  const board = document.querySelector(".game-container");
  if (board) {
    const fitBoard = () => {
      const parent = board.parentElement;
      const available = parent ? parent.clientWidth : 0;
      if (!available) return; // hidden/headless: keep the design size
      // Width alone is not enough on phones: the header stack can leave less
      // vertical room than the scaled board needs, and .board-frame clips
      // whatever sticks out. Reserve the space the board really has below its
      // own top edge, using the visual viewport when browser chrome shrinks it.
      const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      const docTop = board.getBoundingClientRect().top + window.scrollY;
      const heightBudget = vh - docTop - 16;
      const widthScale = available / 500;
      const heightScale = heightBudget > 0 ? heightBudget / 500 : widthScale;
      const scale = Math.max(0.45, Math.min(1, widthScale, heightScale));
      document.documentElement.style.setProperty("--board-scale", String(scale));
    };
    fitBoard();
    window.addEventListener("resize", fitBoard);
  }

  // The board markup ships as 4x4; other sizes rebuild the cell grid with
  // the same roles, so screen readers always get the full board.
  function buildGridCells(size) {
    const gridContainer = document.querySelector(".grid-container");
    if (!gridContainer) return;
    const rows = [];
    for (let y = 0; y < size; y++) {
      const cells = [];
      for (let x = 0; x < size; x++) {
        cells.push('<div class="grid-cell" role="gridcell"></div>');
      }
      rows.push(`<div class="grid-row" role="row">${cells.join("")}</div>`);
    }
    gridContainer.innerHTML = rows.join("");
    gridContainer.setAttribute("aria-label", `${size} by ${size} game board`);
    document.body.dataset.size = String(size);
  }

  // Theme picker: a listbox of tile-colour swatches (the native <select>
  // could not preview a theme). Keyboard: arrows/Home/End move, Enter or
  // Space selects, Escape closes and returns focus to the button.
  const picker = document.querySelector(".theme-picker");
  const pickerButton = picker
    ? /** @type {HTMLElement} */ (picker.querySelector(".theme-select"))
    : null;
  const pickerList = picker
    ? /** @type {HTMLElement} */ (picker.querySelector(".theme-options"))
    : null;
  if (picker && pickerButton && pickerList) {
    const swatchValues = [2, 8, 32, 128];
    const colorFor = (theme, value) => (theme.colors[value] || theme.superColor).bg;

    const buildSwatches = (theme) => {
      const row = document.createElement("span");
      row.className = "swatch-row";
      row.setAttribute("aria-hidden", "true");
      for (const value of swatchValues) {
        const dot = document.createElement("span");
        dot.className = "swatch";
        dot.style.background = colorFor(theme, value);
        row.appendChild(dot);
      }
      return row;
    };

    for (const key of Object.keys(themeManager.themes)) {
      const theme = themeManager.themes[key];
      const option = document.createElement("li");
      option.className = "theme-option";
      option.setAttribute("role", "option");
      option.setAttribute("tabindex", "-1");
      option.dataset.themeKey = key;
      option.appendChild(buildSwatches(theme));
      const name = document.createElement("span");
      name.className = "theme-option-name";
      name.textContent = theme.name;
      option.appendChild(name);
      pickerList.appendChild(option);
    }
    const options = /** @type {HTMLElement[]} */ ([
      ...pickerList.querySelectorAll(".theme-option"),
    ]);

    const syncPicker = () => {
      pickerButton.querySelector(".theme-name").textContent = themeManager.get().name;
      const buttonSwatches = pickerButton.querySelector(".theme-swatches");
      buttonSwatches.textContent = "";
      buttonSwatches.appendChild(buildSwatches(themeManager.get()));
      const activeKey = themeManager.getKey();
      for (const option of options) {
        option.setAttribute("aria-selected", String(option.dataset.themeKey === activeKey));
      }
    };

    const closePicker = (returnFocus) => {
      if (pickerList.hasAttribute("hidden")) return;
      pickerList.setAttribute("hidden", "");
      pickerButton.setAttribute("aria-expanded", "false");
      if (returnFocus) pickerButton.focus();
    };

    const openPicker = () => {
      pickerList.removeAttribute("hidden");
      pickerButton.setAttribute("aria-expanded", "true");
      const selected =
        options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];
      if (selected) selected.focus();
    };

    const selectOption = (option) => {
      const key = option.dataset.themeKey;
      closePicker(true);
      if (key && key !== themeManager.getKey()) {
        // A theme switch re-skins the whole board at once; a view
        // transition cross-fades it instead of snapping.
        ViewTransitions.run(() => themeManager.set(key));
      }
      syncPicker();
    };

    pickerButton.addEventListener("click", () => {
      if (pickerList.hasAttribute("hidden")) openPicker();
      else closePicker(true);
    });

    pickerList.addEventListener("keydown", (/** @type {KeyboardEvent} */ event) => {
      const index = options.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        options[(index + delta + options.length) % options.length].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1].focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (index >= 0) selectOption(options[index]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePicker(true);
      }
    });

    pickerList.addEventListener("click", (/** @type {MouseEvent} */ event) => {
      const target = /** @type {Element} */ (event.target);
      const option = target.closest(".theme-option");
      if (option) selectOption(/** @type {HTMLElement} */ (option));
    });

    document.addEventListener("click", (/** @type {MouseEvent} */ event) => {
      if (pickerList.hasAttribute("hidden")) return;
      if (picker.contains(/** @type {Node} */ (event.target))) return;
      closePicker(false);
    });

    themeManager.onChange(() => syncPicker());
    syncPicker();
  }

  // Sound is off until the player opts in. The button mirrors the stored
  // preference, and switching it on plays one tick as confirmation — which
  // also unlocks the AudioContext inside the click gesture.
  const soundToggle = document.querySelector(".sound-toggle");
  if (soundToggle) {
    const syncSoundToggle = () => {
      soundToggle.setAttribute("aria-pressed", String(soundManager.isEnabled()));
    };

    syncSoundToggle();
    soundToggle.addEventListener("click", () => {
      soundManager.setEnabled(!soundManager.isEnabled());
      syncSoundToggle();
      if (soundManager.isEnabled()) soundManager.move();
    });
  }

  // Stats and Settings share one panel behaviour: the toggle owns
  // aria-expanded, opening one panel closes the other, Escape and clicks
  // outside close, and focus returns to the toggle on every close path.
  const panels = [];

  /** @typedef {{ button: HTMLElement, panel: HTMLElement, onOpen?: (() => void) | null }} PanelEntry */

  /**
   * @param {PanelEntry} entry
   */
  function openPanel(entry) {
    for (const other of panels) {
      if (other !== entry) closePanel(other, false);
    }
    if (entry.onOpen) entry.onOpen();
    entry.panel.removeAttribute("hidden");
    entry.button.setAttribute("aria-expanded", "true");
    const first = /** @type {HTMLElement | null} */ (
      entry.panel.querySelector("button, a, input, select")
    );
    if (first) first.focus();
  }

  /**
   * @param {PanelEntry} entry
   * @param {boolean} returnFocus
   */
  function closePanel(entry, returnFocus) {
    if (entry.panel.hasAttribute("hidden")) return;
    entry.panel.setAttribute("hidden", "");
    entry.button.setAttribute("aria-expanded", "false");
    if (returnFocus) entry.button.focus();
  }

  /**
   * @param {Element | null} button
   * @param {Element | null} panel
   * @param {(() => void) | null} onOpen
   * @returns {PanelEntry | null}
   */
  function registerPanel(button, panel, onOpen) {
    if (!button || !panel) return null;
    const entry = {
      button: /** @type {HTMLElement} */ (button),
      panel: /** @type {HTMLElement} */ (panel),
      onOpen,
    };
    panels.push(entry);
    button.addEventListener("click", () => {
      if (panel.hasAttribute("hidden")) openPanel(entry);
      else closePanel(entry, false);
    });
    return entry;
  }

  document.addEventListener("keydown", (/** @type {KeyboardEvent} */ event) => {
    if (event.key !== "Escape") return;
    for (const entry of panels) closePanel(entry, true);
  });

  document.addEventListener("click", (/** @type {MouseEvent} */ event) => {
    const target = /** @type {Node} */ (event.target);
    for (const entry of panels) {
      if (entry.panel.hasAttribute("hidden")) continue;
      if (entry.panel.contains(target) || entry.button.contains(target)) continue;
      closePanel(entry, false);
    }
  });

  // Stats panel: numbers only change when a game ends, so it re-renders on
  // open.
  const statsButton = document.querySelector(".stats-button");
  const statsPanel = document.querySelector(".stats-panel");
  function renderStats() {
    const stats = gameManager.stats.get();
    const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    statsPanel.querySelector(".stat-played").textContent = String(stats.played);
    statsPanel.querySelector(".stat-won").textContent = String(stats.won);
    statsPanel.querySelector(".stat-rate").textContent = `${rate}%`;
    statsPanel.querySelector(".stat-best-tile").textContent = stats.bestTile
      ? String(stats.bestTile)
      : "—";
    statsPanel.querySelector(".stat-best-streak").textContent = String(stats.bestStreak);
    statsPanel.querySelector(".stat-daily-streak").textContent = String(
      gameManager.dailyStreak.get().count
    );

    // Top-5 runs for the mode currently being played.
    const list = statsPanel.querySelector(".leaderboard");
    if (list) {
      list.textContent = "";
      const entries = gameManager.leaderboard.get(gameManager.mode);
      if (entries.length === 0) {
        const empty = document.createElement("li");
        empty.className = "leaderboard-empty";
        empty.textContent = "No finished games yet.";
        list.appendChild(empty);
      } else {
        entries.forEach((entry, index) => {
          const item = document.createElement("li");
          const moves = entry.moves === 1 ? "move" : "moves";
          item.textContent = `${index + 1}. ${entry.score.toLocaleString("en-US")} · ${
            entry.moves
          } ${moves} · ${entry.date}`;
          list.appendChild(item);
        });
      }
    }
  }
  registerPanel(statsButton, statsPanel, renderStats);

  // Settings panel: three-state dark mode plus four switches. Everything
  // visual is opt-in; the panel mirrors the stored state on every open.
  const settingsButton = document.querySelector(".settings-button");
  const settingsPanel = document.querySelector(".settings-panel");
  if (settingsButton && settingsPanel) {
    const toggles = [
      ["motion", ".switch-motion"],
      ["ambience", ".switch-ambience"],
      ["patterns", ".switch-patterns"],
      ["celebrate", ".switch-celebrate"],
    ];
    const darkOptions = /** @type {HTMLElement[]} */ ([
      ...settingsPanel.querySelectorAll("[data-dark-mode]"),
    ]);
    const sizeOptions = /** @type {HTMLElement[]} */ ([
      ...settingsPanel.querySelectorAll("[data-board-size]"),
    ]);

    const syncDarkMode = () => {
      for (const option of darkOptions) {
        option.setAttribute(
          "aria-checked",
          String(option.dataset.darkMode === preferences.darkMode)
        );
      }
    };
    const syncBoardSize = () => {
      for (const option of sizeOptions) {
        option.setAttribute(
          "aria-checked",
          String(Number(option.dataset.boardSize) === gameManager.size)
        );
      }
    };
    const syncSwitches = () => {
      for (const [name, selector] of toggles) {
        const element = settingsPanel.querySelector(selector);
        if (element) element.setAttribute("aria-checked", String(preferences[name]));
      }
      syncDarkMode();
      syncBoardSize();
    };

    for (const option of darkOptions) {
      option.addEventListener("click", () => {
        preferences.setDarkMode(option.dataset.darkMode);
        syncSwitches();
      });
    }
    for (const option of sizeOptions) {
      option.addEventListener("click", () => {
        const size = Number(option.dataset.boardSize);
        if (size === gameManager.size) return;
        buildGridCells(size);
        gameManager.changeSize(size);
        syncSwitches();
      });
    }
    for (const [name, selector] of toggles) {
      const element = settingsPanel.querySelector(selector);
      if (element) {
        element.addEventListener("click", () => {
          preferences.set(name, !preferences[name]);
          syncSwitches();
        });
      }
    }

    syncSwitches();
    registerPanel(settingsButton, settingsPanel, syncSwitches);
  }

  // First-run hint: shown until dismissed (2048-hint-seen). A quiet nudge
  // for new players, not a modal.
  const hint = document.querySelector(".first-run-hint");
  if (hint) {
    const hintStorage = new LocalStorageManager();
    if (!hintStorage.getFlag("hint-seen", false)) hint.removeAttribute("hidden");
    const dismiss = hint.querySelector(".hint-dismiss");
    if (dismiss) {
      dismiss.addEventListener("click", () => {
        hint.setAttribute("hidden", "");
        hintStorage.setFlag("hint-seen", true);
        // The board moves up once the hint is gone: give it the freed height.
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  // Live clock for the timer box: the elapsed time keeps moving between
  // moves, so a light interval refreshes the display; every re-render
  // (moves, undo, mode switches) also refreshes it via the metadata.
  const timerBox = document.querySelector(".timer-container");
  if (timerBox) {
    timerBox.textContent = GameManager.formatElapsed(gameManager.elapsedMs());
    setInterval(() => {
      timerBox.textContent = GameManager.formatElapsed(gameManager.elapsedMs());
    }, 500);
  }

  // Offline support: register the service worker for the multi-file build.
  // Skipped in the single-file bundle (its <head> carries no manifest link)
  // and on file:// where service workers are unavailable.
  if (document.querySelector('link[rel="manifest"]') && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Offline play is a progressive enhancement — ignore failures.
      });
    });
  }
});
