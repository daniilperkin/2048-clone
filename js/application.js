// Wait till the browser is ready to render the game (avoids glitches)
/* global GameManager, KeyboardInputManager, HTMLActuator, LocalStorageManager */
window.requestAnimationFrame(() => {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});
