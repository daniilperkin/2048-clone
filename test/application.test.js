import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGameFiles, loadApplication } from "./setup.js";

loadGameFiles();

/**
 * Bootstrap smoke tests for js/application.js — the one game file that runs
 * immediately on load, so test/setup.js deliberately leaves it out of
 * GAME_FILES. We mount the real index.html markup, fake rAF (jsdom has no
 * rendering loop) and then evaluate the bootstrap against it.
 */
function mountRealMarkup() {
  const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  document.body.innerHTML = indexHtml
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
}

describe("application bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    themeManager.listeners = [];
    themeManager.set("classic");
    // Preferences mirror onto body classes; reset them so tests that flip
    // dark mode can't leak into the next bootstrap.
    document.body.className = "";
    mountRealMarkup();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  it("fills the theme picker from the theme registry", () => {
    loadApplication();
    const options = document.querySelectorAll(".theme-options .theme-option");
    expect(options.length).toBe(Object.keys(themeManager.themes).length);
    const selected = document.querySelector('.theme-option[aria-selected="true"]');
    expect(selected.dataset.themeKey).toBe(themeManager.getKey());
    expect(document.querySelector(".theme-name").textContent).toBe(themeManager.get().name);
  });

  it("selects a theme from the picker", () => {
    loadApplication();
    document.querySelector(".theme-select").click();
    expect(document.querySelector(".theme-options").hasAttribute("hidden")).toBe(false);

    const options = [...document.querySelectorAll(".theme-option")];
    const target = options[1];
    target.click();

    expect(themeManager.getKey()).toBe(target.dataset.themeKey);
    expect(document.querySelector(".theme-options").hasAttribute("hidden")).toBe(true);
    expect(document.querySelector(".theme-name").textContent).toBe(themeManager.get().name);
  });

  it("supports keyboard navigation in the picker", () => {
    loadApplication();
    document.querySelector(".theme-select").click(); // opens and focuses the selected option

    const list = document.querySelector(".theme-options");
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const focused = document.activeElement;
    expect(focused.classList.contains("theme-option")).toBe(true);

    list.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(themeManager.getKey()).toBe(focused.dataset.themeKey);
  });

  it("sound toggle mirrors and flips the stored preference", () => {
    loadApplication();
    const toggle = document.querySelector(".sound-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    toggle.click();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(new LocalStorageManager().getSoundEnabled()).toBe(true);
    toggle.click();
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("stats panel opens, renders the stored numbers, and closes", () => {
    localStorage.setItem(
      "2048-stats",
      JSON.stringify({ played: 4, won: 1, bestTile: 128, streak: 0, bestStreak: 1 })
    );
    localStorage.setItem(
      "2048-leaderboard-classic",
      JSON.stringify([
        { score: 512, moves: 20, bestTile: 128, date: "2026-10-10", at: 1 },
        { score: 300, moves: 15, bestTile: 64, date: "2026-10-09", at: 2 },
      ])
    );
    localStorage.setItem("2048-daily-streak", JSON.stringify({ count: 3, lastDate: "2026-10-10" }));
    loadApplication();
    const button = document.querySelector(".stats-button");
    const panel = document.querySelector(".stats-panel");
    expect(panel.hasAttribute("hidden")).toBe(true);

    button.click();
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel.querySelector(".stat-played").textContent).toBe("4");
    expect(panel.querySelector(".stat-won").textContent).toBe("1");
    expect(panel.querySelector(".stat-rate").textContent).toBe("25%");
    expect(panel.querySelector(".stat-best-tile").textContent).toBe("128");
    expect(panel.querySelector(".stat-best-streak").textContent).toBe("1");
    expect(panel.querySelector(".stat-daily-streak").textContent).toBe("3");
    const rows = panel.querySelectorAll(".leaderboard li");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("512");

    button.click();
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("settings panel opens and its controls flip and persist preferences", () => {
    loadApplication();
    const button = document.querySelector(".settings-button");
    const panel = document.querySelector(".settings-panel");
    expect(panel.hasAttribute("hidden")).toBe(true);

    button.click();
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    // Three-state dark mode.
    const onOption = panel.querySelector('[data-dark-mode="on"]');
    expect(onOption.getAttribute("aria-checked")).toBe("false");
    onOption.click();
    expect(onOption.getAttribute("aria-checked")).toBe("true");
    expect(document.body.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("2048-dark")).toBe("1");

    const autoOption = panel.querySelector('[data-dark-mode="auto"]');
    autoOption.click();
    expect(autoOption.getAttribute("aria-checked")).toBe("true");
    expect(onOption.getAttribute("aria-checked")).toBe("false");
    expect(localStorage.getItem("2048-dark")).toBe("auto");

    const motionSwitch = panel.querySelector(".switch-motion");
    expect(motionSwitch.getAttribute("aria-checked")).toBe("true");
    motionSwitch.click();
    expect(motionSwitch.getAttribute("aria-checked")).toBe("false");
    expect(document.body.classList.contains("reduced-motion")).toBe(true);

    const ambienceSwitch = panel.querySelector(".switch-ambience");
    ambienceSwitch.click();
    expect(document.body.classList.contains("ambience-on")).toBe(true);

    const patternsSwitch = panel.querySelector(".switch-patterns");
    patternsSwitch.click();
    expect(document.body.classList.contains("patterns")).toBe(true);
    expect(localStorage.getItem("2048-patterns")).toBe("1");

    button.click();
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the moves and timer boxes from the live game", () => {
    loadApplication();
    expect(document.querySelector(".moves-container").textContent).toBe("0");
    expect(document.querySelector(".timer-container").textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it("registers the service worker when the manifest is linked", () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });
    document.head.insertAdjacentHTML(
      "beforeend",
      '<link rel="manifest" href="manifest.webmanifest">'
    );
    loadApplication();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("sw.js");
  });
});
