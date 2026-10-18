// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions, preferences */
window.requestAnimationFrame(() => {
  const gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

  // Player preferences (dark mode, animations, ambience, celebrations):
  // read the stored flags and mirror them onto the page before anything
  // else renders.
  preferences.attachStorage(new LocalStorageManager());
  preferences.apply();

  // Fluid board: the grid is a fixed 500px design (tile positions are
  // absolute pixels), so narrow screens scale the whole board down as one
  // unit — --board-scale feeds the CSS transform and the height pull-back.
  const board = document.querySelector(".game-container");
  if (board) {
    const fitBoard = () => {
      const available = board.parentElement ? board.parentElement.clientWidth : 0;
      if (!available) return; // hidden/headless: keep the design size
      const scale = Math.min(1, available / 500);
      document.documentElement.style.setProperty("--board-scale", String(scale));
    };
    fitBoard();
    window.addEventListener("resize", fitBoard);
  }

  const select = document.querySelector(".theme-select");
  if (select) {
    const themes = themeManager.themes;
    for (const key of Object.keys(themes)) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = themes[key].name;
      select.appendChild(option);
    }
    select.value = themeManager.getKey();
    select.addEventListener("change", () => {
      // A theme switch re-skins the whole board at once; a view transition
      // cross-fades it instead of snapping (see js/view_transitions.js).
      ViewTransitions.run(() => themeManager.set(select.value));
    });
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

  function openPanel(entry) {
    for (const other of panels) {
      if (other !== entry) closePanel(other, false);
    }
    if (entry.onOpen) entry.onOpen();
    entry.panel.removeAttribute("hidden");
    entry.button.setAttribute("aria-expanded", "true");
    const first = entry.panel.querySelector("button, a, input, select");
    if (first) first.focus();
  }

  function closePanel(entry, returnFocus) {
    if (entry.panel.hasAttribute("hidden")) return;
    entry.panel.setAttribute("hidden", "");
    entry.button.setAttribute("aria-expanded", "false");
    if (returnFocus) entry.button.focus();
  }

  function registerPanel(button, panel, onOpen) {
    if (!button || !panel) return null;
    const entry = { button, panel, onOpen };
    panels.push(entry);
    button.addEventListener("click", () => {
      if (panel.hasAttribute("hidden")) openPanel(entry);
      else closePanel(entry, false);
    });
    return entry;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const entry of panels) closePanel(entry, true);
  });

  document.addEventListener("click", (event) => {
    for (const entry of panels) {
      if (entry.panel.hasAttribute("hidden")) continue;
      if (entry.panel.contains(event.target) || entry.button.contains(event.target)) continue;
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
  }
  registerPanel(statsButton, statsPanel, renderStats);

  // Settings panel: four switches over the preference flags. Everything
  // visual is opt-in; the panel mirrors the stored state on every open.
  const settingsButton = document.querySelector(".settings-button");
  const settingsPanel = document.querySelector(".settings-panel");
  if (settingsButton && settingsPanel) {
    const toggles = [
      ["dark", ".switch-dark"],
      ["motion", ".switch-motion"],
      ["ambience", ".switch-ambience"],
      ["celebrate", ".switch-celebrate"],
    ];
    const syncSwitches = () => {
      for (const [name, selector] of toggles) {
        const element = settingsPanel.querySelector(selector);
        if (element) element.setAttribute("aria-checked", String(preferences[name]));
      }
    };

    syncSwitches();
    for (const [name, selector] of toggles) {
      const element = settingsPanel.querySelector(selector);
      if (element) {
        element.addEventListener("click", () => {
          preferences.set(name, !preferences[name]);
          syncSwitches();
        });
      }
    }

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
