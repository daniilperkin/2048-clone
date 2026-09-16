// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager, soundManager, ViewTransitions */
window.requestAnimationFrame(() => {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

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
});
