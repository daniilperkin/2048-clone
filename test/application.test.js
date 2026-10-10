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
    mountRealMarkup();
    window.requestAnimationFrame = (fn) => {
      fn();
      return 0;
    };
  });

  it("fills the theme select from the theme registry", () => {
    loadApplication();
    const select = document.querySelector(".theme-select");
    expect(select.options.length).toBe(Object.keys(themeManager.themes).length);
    expect(select.value).toBe(themeManager.getKey());
  });

  it("applies a theme chosen from the select", () => {
    loadApplication();
    const select = document.querySelector(".theme-select");
    const keys = Object.keys(themeManager.themes);
    select.value = keys[1];
    select.dispatchEvent(new Event("change"));
    expect(themeManager.getKey()).toBe(keys[1]);
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

    button.click();
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
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
