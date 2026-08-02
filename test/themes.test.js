import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("ThemeManager", () => {
  let tm;

  beforeEach(() => {
    localStorage.clear();
    tm = new ThemeManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("constructor", () => {
    it("defaults to 'agile' theme", () => {
      expect(tm.getKey()).toBe("agile");
    });

    it("loads saved theme from localStorage", () => {
      localStorage.setItem("2048-theme", "classic");
      const manager = new ThemeManager();
      expect(manager.getKey()).toBe("classic");
    });

    it("falls back to 'agile' for invalid saved theme", () => {
      localStorage.setItem("2048-theme", "nonexistent");
      const manager = new ThemeManager();
      expect(manager.getKey()).toBe("agile");
    });
  });

  describe("get", () => {
    it("returns the current theme object", () => {
      const theme = tm.get();
      expect(theme.name).toBe("Agile");
      expect(theme.winThreshold).toBe(128);
    });
  });

  describe("set", () => {
    it("changes the current theme", () => {
      tm.set("developer");
      expect(tm.getKey()).toBe("developer");
    });

    it("persists to localStorage", () => {
      tm.set("classic");
      expect(localStorage.getItem("2048-theme")).toBe("classic");
    });

    it("ignores unknown themes", () => {
      tm.set("nonexistent");
      expect(tm.getKey()).toBe("agile");
    });

    it("notifies onChange listeners", () => {
      const listener = vi.fn();
      tm.onChange(listener);
      tm.set("classic");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(tm.get());
    });
  });

  describe("getLabel", () => {
    it("returns defined labels for known values", () => {
      expect(tm.getLabel(2)).toBe("Backlog");
      expect(tm.getLabel(128)).toBe("Deployed");
    });

    it("returns roman-numeral suffix for values past max label", () => {
      // Agile max label is 128 (Deployed). Next is 256 → "Deployed II"
      expect(tm.getLabel(256)).toBe("Deployed ii");
      expect(tm.getLabel(512)).toBe("Deployed iii");
      expect(tm.getLabel(1024)).toBe("Deployed iv");
    });

    it("returns string value for developer theme overflow", () => {
      tm.set("developer");
      // Developer max label is 64 (Principal). 128 → "Principal ii"
      expect(tm.getLabel(128)).toBe("Principal ii");
    });
  });

  describe("getColors", () => {
    it("returns defined colors for known values", () => {
      const colors = tm.getColors(2);
      expect(colors.bg).toBe("#e5e7eb");
      expect(colors.fg).toBe("#374151");
    });

    it("returns superColor for values past max defined color", () => {
      const superColors = tm.getColors(9999);
      expect(superColors).toBe(tm.get().superColor);
    });
  });

  describe("theme definitions", () => {
    it("all themes have name, winThreshold, labels, colors, and superColor", () => {
      const themes = ["classic", "developer", "agile", "fibonacci"];
      for (const key of themes) {
        const theme = tm.themes[key];
        expect(theme.name).toBeTruthy();
        expect(typeof theme.winThreshold).toBe("number");
        expect(Object.keys(theme.labels).length).toBeGreaterThan(0);
        expect(Object.keys(theme.colors).length).toBeGreaterThan(0);
        expect(theme.superColor.bg).toBeTruthy();
        expect(theme.superColor.fg).toBeTruthy();
      }
    });

    it("classic theme has winThreshold of 2048", () => {
      expect(tm.themes.classic.winThreshold).toBe(2048);
    });

    it("developer theme has winThreshold of 64", () => {
      expect(tm.themes.developer.winThreshold).toBe(64);
    });
  });

  describe("WCAG contrast (tile text on background)", () => {
    // Relative luminance per WCAG 2.1. Convert #rrggbb to L.
    function luminance(hex) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    function contrastRatio(fg, bg) {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Tile text is large and bold, so WCAG AA requires >= 3:1.
    // Developer and Agile themes previously used white on -400 shades
    // (~2.3:1); this guards against regressions in those themes.
    it("developer and agile tiles meet WCAG AA large-text contrast (3:1)", () => {
      const themes = ["developer", "agile"];
      for (const key of themes) {
        const theme = tm.themes[key];
        for (const { fg, bg } of Object.values(theme.colors)) {
          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(3);
        }
        // superColor too
        const superRatio = contrastRatio(theme.superColor.fg, theme.superColor.bg);
        expect(superRatio).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
