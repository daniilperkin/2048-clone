// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions */
window.requestAnimationFrame(() => {
  const gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

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
});
