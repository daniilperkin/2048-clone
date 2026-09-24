import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

function mountDom() {
  document.body.innerHTML = `
    <div class="best-container" aria-label="Best score"></div>
    <button class="undo-button" disabled>Undo</button>
    <button class="daily-button" aria-pressed="false">Daily</button>
    <div class="game-container">
      <a class="retry-button" href="#"></a>
      <a class="restart-button" href="#"></a>
      <a class="keep-playing-button" href="#"></a>
    </div>`;
}

const key = (init) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));

describe("Undo / Daily input", () => {
  let undo, daily;
  beforeEach(() => {
    mountDom();
    const m = new KeyboardInputManager();
    undo = vi.fn();
    daily = vi.fn();
    m.on("undo", undo);
    m.on("toggleDaily", daily);
  });

  it("emits undo for U, Ctrl+Z and Cmd+Z", () => {
    key({ key: "u" });
    key({ key: "z", ctrlKey: true });
    key({ key: "Z", metaKey: true });
    expect(undo).toHaveBeenCalledTimes(3);
  });

  it("ignores Ctrl+Shift+Z and key repeat", () => {
    key({ key: "z", ctrlKey: true, shiftKey: true });
    key({ key: "u", repeat: true });
    expect(undo).not.toHaveBeenCalled();
  });

  it("wires the Undo and Daily buttons", () => {
    document.querySelector(".undo-button").disabled = false;
    document.querySelector(".undo-button").click();
    document.querySelector(".daily-button").click();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(daily).toHaveBeenCalledTimes(1);
  });
});

describe("HTMLActuator.updateControls", () => {
  beforeEach(mountDom);

  it("reflects undo availability and daily mode", () => {
    const a = new HTMLActuator(themeManager);
    a.updateControls({ canUndo: true, mode: "daily", date: "2026-09-24" });
    expect(document.querySelector(".undo-button").disabled).toBe(false);
    expect(document.querySelector(".daily-button").getAttribute("aria-pressed")).toBe("true");
    expect(document.body.classList.contains("daily-mode")).toBe(true);
    expect(a.bestContainer.getAttribute("aria-label")).toContain("2026-09-24");
    a.updateControls({ canUndo: false, mode: "classic" });
    expect(document.querySelector(".undo-button").disabled).toBe(true);
    expect(document.body.classList.contains("daily-mode")).toBe(false);
  });
});
