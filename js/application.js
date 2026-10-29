// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions, preferences */
window.requestAnimationFrame(() => {
  // Board size (3 | 4 | 5) comes from storage so every size keeps its own
  // save, best score and records.
  const bootStorage = new LocalStorageManager();
  const boardSize = bootStorage.getSize();
  buildGridCells(boardSize);

  // Player preferences (dark mode, animations, ambience, celebrations) are
  // applied before the game renders: a dark-mode player must not see a flash
  // of the light theme on every reload.
  preferences.attachStorage(new LocalStorageManager());
  preferences.apply();

  const gameManager = new GameManager(
    boardSize,
    KeyboardInputManager,
    HTMLActuator,
    LocalStorageManager
  );

  // Fluid board: the grid is a fixed 500px design (tile positions are
  // absolute pixels), so narrow screens scale the whole board down as one
  // unit — --board-scale feeds the CSS transform and the frame height.
  const board = document.querySelector(".game-container");

  // Page scale: the desktop layout is ~540x730 CSS px at zoom 1 and the
  // stylesheet default is zoom 1.25. A fixed zoom overflows any window
  // shorter than that — which is exactly what happens at 100% browser zoom
  // on a 768px-tall screen, forcing a scrollbar just to reach the board.
  // Fit the page instead: never above 1.25 (keeps the comfortable desktop
  // size), never below MIN_PAGE_ZOOM (past that the text stops being
  // readable and scrolling is the better trade).
  const page = document.body;
  const MAX_PAGE_ZOOM = 1.25;
  const MIN_PAGE_ZOOM = 0.5;

  function fitPageZoom() {
    if (!page) return;
    // Phones fit themselves (fluid container + board scale), so leave the
    // stylesheet's zoom: 1 in charge there.
    if (typeof matchMedia !== "undefined" && matchMedia("(max-width: 540px)").matches) {
      page.style.zoom = "";
      return;
    }
    page.style.zoom = "1"; // measure the natural size, not the fitted one
    // offsetHeight is the body's own layout height (immune to zoom; a
    // getBoundingClientRect() read reports the scaled box and drifted the fit
    // to ~0.99 everywhere). Width is different: a block body stretches to the
    // viewport, so its offsetWidth says nothing about the content — use the
    // widest child plus the body's horizontal padding instead.
    const style = window.getComputedStyle(page);
    const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    let contentWidth = 0;
    for (const child of page.children) {
      // Full-viewport overlays (.ambience, .celebration-layer) are fixed and
      // would report the viewport width; only in-flow children describe the
      // page's real content width.
      const element = /** @type {HTMLElement} */ (child);
      const childStyle = window.getComputedStyle(element);
      if (childStyle.position === "fixed" || childStyle.position === "absolute") continue;
      if (element.offsetWidth > contentWidth) contentWidth = element.offsetWidth;
    }
    const naturalHeight = page.scrollHeight || page.offsetHeight;
    const naturalWidth = contentWidth ? contentWidth + paddingX : page.offsetWidth;
    if (!naturalHeight || !naturalWidth) {
      page.style.zoom = ""; // no layout (jsdom/headless): keep the CSS default
      return;
    }
    const viewport = window.visualViewport;
    const viewportWidth = (viewport && viewport.width) || window.innerWidth;
    const viewportHeight = (viewport && viewport.height) || window.innerHeight;
    let scale = Math.max(
      MIN_PAGE_ZOOM,
      Math.min(
        MAX_PAGE_ZOOM,
        (viewportWidth - 8) / naturalWidth,
        (viewportHeight - 8) / naturalHeight
      )
    );
    const apply = (value) => {
      page.style.zoom = String(Math.round(value * 1000) / 1000);
    };
    // Correct against the real scroll box until it fits. Reads happen after
    // a forced layout, and the loop is repeated on the next frame because a
    // freshly applied zoom can report the previous layout.
    const correct = () => {
      for (let pass = 0; pass < 3; pass += 1) {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollWidth = document.documentElement.scrollWidth;
        if (scrollHeight <= viewportHeight && scrollWidth <= viewportWidth) return;
        const fix = Math.min(
          viewportHeight / Math.max(scrollHeight, 1),
          viewportWidth / Math.max(scrollWidth, 1)
        );
        const next = Math.max(MIN_PAGE_ZOOM, scale * fix * 0.998);
        if (next >= scale - 0.001) return;
        scale = next;
        apply(scale);
      }
    };
    apply(scale);
    correct();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(correct);
  }

  function fitBoard() {
    if (!board) return;
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
  }

  // Page zoom first: the board measures its own top edge against it. The
  // load refit matters because fonts, tiles and the hint change the page
  // height after the first paint.
  fitPageZoom();
  fitBoard();
  const refit = () => {
    fitPageZoom();
    fitBoard();
  };
  window.addEventListener("resize", refit);
  window.addEventListener("load", refit);

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

    // Top-5 runs for the mode and board size currently being played.
    const list = statsPanel.querySelector(".leaderboard");
    if (list) {
      list.textContent = "";
      list.setAttribute(
        "aria-label",
        `Best runs · ${gameManager.size}×${gameManager.size} · ${gameManager.mode}`
      );
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
    // The segmented controls are radiogroups: one tab stop per group, arrow
    // keys move focus between the options. Selection stays on Enter/Space —
    // arrowing must not start a new game by changing the board size.
    const radioGroups = [...settingsPanel.querySelectorAll('[role="radiogroup"]')].map((group) => ({
      group,
      items: /** @type {HTMLElement[]} */ ([...group.querySelectorAll('[role="radio"]')]),
    }));

    const syncRadioTabindex = () => {
      for (const { items } of radioGroups) {
        const checked = items.findIndex((item) => item.getAttribute("aria-checked") === "true");
        const stop = checked >= 0 ? checked : 0;
        items.forEach((item, index) => {
          item.setAttribute("tabindex", index === stop ? "0" : "-1");
        });
      }
    };

    for (const { group, items } of radioGroups) {
      group.addEventListener("keydown", (/** @type {KeyboardEvent} */ event) => {
        const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const current = Math.max(
          0,
          items.indexOf(/** @type {HTMLElement} */ (document.activeElement))
        );
        let next;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else {
          const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
          next = (current + delta + items.length) % items.length;
        }
        items[next].focus();
      });
    }

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
      syncRadioTabindex();
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
