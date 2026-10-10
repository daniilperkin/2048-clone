import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { loadGameFiles, loadApplication } from "./setup.js";

expect.extend({ toHaveNoViolations });
loadGameFiles();

/**
 * WCAG 2.1 AA checks (vitest-axe) against the real index.html markup, so the
 * accessibility pillar is enforced by CI instead of convention.
 *
 * color-contrast is disabled: jsdom cannot compute rendered styles, so the
 * rule cannot run meaningfully here — contrast is covered by the manual
 * audits (see the contrast commits) and belongs in a real browser.
 */
const AXE_OPTIONS = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  rules: { "color-contrast": { enabled: false } },
};

// jsdom has no canvas backend and logs a "Not implemented" error whenever
// axe probes getContext (one probe per run). Returning null mirrors jsdom's
// own behaviour without the log noise.
HTMLCanvasElement.prototype.getContext = () => null;

function mountRealMarkup() {
  const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  // Mirror the source's <html lang> onto the jsdom document so the axe
  // context matches what actually ships.
  const lang = indexHtml.match(/<html lang="([^"]+)"/);
  if (lang) document.documentElement.setAttribute("lang", lang[1]);
  document.body.innerHTML = indexHtml
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, "");
}

describe("WCAG 2.1 AA (axe)", () => {
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

  it("declares the page language in the shipped markup", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(indexHtml).toMatch(/<html lang="en">/);
  });

  it("page shell has no violations", async () => {
    const results = await axe(document.body, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it("gameplay state (tiles on the board) has no violations", async () => {
    loadApplication();
    const results = await axe(document.body, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it("win overlay has no violations", async () => {
    loadApplication();
    const actuator = new HTMLActuator(themeManager);
    actuator.message(true);
    const results = await axe(document.body, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });
});
