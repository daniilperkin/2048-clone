/* exported DIRECTIONS */
/**
 * Shared direction contract for the whole game.
 *
 * Both KeyboardInputManager (key → direction) and GameManager
 * (direction → movement vector) encode directions as these integers.
 * Defining them once here keeps the two sides in sync.
 */
const DIRECTIONS = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
};
