// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager, themeManager */
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
      themeManager.set(select.value);
    });
  }
});
