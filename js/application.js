// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions, preferences */
window.requestAnimationFrame(() => {
  const gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

  // Player preferences (dark mode, animations, ambience, celebrations):
  // read the stored flags and mirror them onto the page before anything
  // else renders.
  preferences.attachStorage(new LocalStorageManager());
  preferences.apply();

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

  // Stats panel: numbers only change when a game ends, so it re-renders on
  // open. aria-expanded mirrors the visibility for assistive tech.
  const statsButton = document.querySelector(".stats-button");
  const statsPanel = document.querySelector(".stats-panel");
  if (statsButton && statsPanel) {
    const renderStats = () => {
      const stats = gameManager.stats.get();
      const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
      statsPanel.querySelector(".stat-played").textContent = String(stats.played);
      statsPanel.querySelector(".stat-won").textContent = String(stats.won);
      statsPanel.querySelector(".stat-rate").textContent = `${rate}%`;
      statsPanel.querySelector(".stat-best-tile").textContent = stats.bestTile
        ? String(stats.bestTile)
        : "—";
      statsPanel.querySelector(".stat-best-streak").textContent = String(stats.bestStreak);
    };

    statsButton.addEventListener("click", () => {
      const opening = statsPanel.hasAttribute("hidden");
      if (opening) {
        renderStats();
        statsPanel.removeAttribute("hidden");
      } else {
        statsPanel.setAttribute("hidden", "");
      }
      statsButton.setAttribute("aria-expanded", String(opening));
    });
  }

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

    settingsButton.addEventListener("click", () => {
      const opening = settingsPanel.hasAttribute("hidden");
      if (opening) {
        syncSwitches();
        settingsPanel.removeAttribute("hidden");
      } else {
        settingsPanel.setAttribute("hidden", "");
      }
      settingsButton.setAttribute("aria-expanded", String(opening));
    });
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
