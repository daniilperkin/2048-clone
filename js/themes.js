/* exported ThemeManager, themeManager */

/**
 * Convert a positive integer to lowercase roman numerals.
 * Used for overflow tiles: "Principal II", "Principal III", etc.
 */
function toRoman(num) {
  const roman = [
    ["m", 1000],
    ["cm", 900],
    ["d", 500],
    ["cd", 400],
    ["c", 100],
    ["xc", 90],
    ["l", 50],
    ["xl", 40],
    ["x", 10],
    ["ix", 9],
    ["v", 5],
    ["iv", 4],
    ["i", 1],
  ];
  let result = "";
  for (const [letter, value] of roman) {
    while (num >= value) {
      result += letter;
      num -= value;
    }
  }
  return result;
}

const THEMES = {
  classic: {
    name: "Classic",
    winThreshold: 2048,
    labels: {
      2: "2",
      4: "4",
      8: "8",
      16: "16",
      32: "32",
      64: "64",
      128: "128",
      256: "256",
      512: "512",
      1024: "1024",
      2048: "2048",
    },
    colors: {
      2: { bg: "#eee4da", fg: "#776e65" },
      4: { bg: "#ede0c8", fg: "#776e65" },
      8: { bg: "#f2b179", fg: "#f9f6f2" },
      16: { bg: "#f59563", fg: "#f9f6f2" },
      32: { bg: "#f67c5f", fg: "#f9f6f2" },
      64: { bg: "#f65e3b", fg: "#f9f6f2" },
      128: { bg: "#edcf72", fg: "#f9f6f2" },
      256: { bg: "#edcc61", fg: "#f9f6f2" },
      512: { bg: "#edc850", fg: "#f9f6f2" },
      1024: { bg: "#edc53f", fg: "#f9f6f2" },
      2048: { bg: "#edc22e", fg: "#f9f6f2" },
    },
    superColor: { bg: "#3c3a32", fg: "#f9f6f2" },
  },

  developer: {
    name: "Developer",
    winThreshold: 64,
    labels: {
      2: "Intern",
      4: "Junior",
      8: "Mid",
      16: "Senior",
      32: "Staff",
      64: "Principal",
    },
    colors: {
      2: { bg: "#dbeafe", fg: "#1e3a8a" },
      4: { bg: "#93c5fd", fg: "#1e3a8a" },
      8: { bg: "#60a5fa", fg: "#1e3a8a" },
      16: { bg: "#818cf8", fg: "#312e81" },
      32: { bg: "#a78bfa", fg: "#4c1d95" },
      64: { bg: "#fbbf24", fg: "#78350f" },
    },
    superColor: { bg: "#1e1b4b", fg: "#fbbf24" },
  },

  agile: {
    name: "Agile",
    winThreshold: 128,
    labels: {
      2: "Backlog",
      4: "Ticket",
      8: "PR",
      16: "Review",
      32: "Approved",
      64: "Merged",
      128: "Deployed",
    },
    colors: {
      2: { bg: "#e5e7eb", fg: "#374151" },
      4: { bg: "#93c5fd", fg: "#1e3a8a" },
      8: { bg: "#818cf8", fg: "#312e81" },
      16: { bg: "#c084fc", fg: "#581c87" },
      32: { bg: "#86efac", fg: "#14532d" },
      64: { bg: "#5eead4", fg: "#134e4a" },
      128: { bg: "#fbbf24", fg: "#78350f" },
    },
    superColor: { bg: "#064e3b", fg: "#fbbf24" },
  },

  fibonacci: {
    name: "Fibonacci",
    winThreshold: 128,
    labels: {
      2: "1",
      4: "2",
      8: "3",
      16: "5",
      32: "8",
      64: "13",
      128: "21",
    },
    colors: {
      2: { bg: "#eee4da", fg: "#776e65" },
      4: { bg: "#ede0c8", fg: "#776e65" },
      8: { bg: "#f2b179", fg: "#f9f6f2" },
      16: { bg: "#f59563", fg: "#f9f6f2" },
      32: { bg: "#f67c5f", fg: "#f9f6f2" },
      64: { bg: "#f65e3b", fg: "#f9f6f2" },
      128: { bg: "#edcf72", fg: "#f9f6f2" },
    },
    superColor: { bg: "#3c3a32", fg: "#f9f6f2" },
  },
};

class ThemeManager {
  constructor() {
    this.themes = THEMES;
    this.storageKey = "2048-theme";
    this.listeners = [];

    const saved = this.loadThemeKey();
    this.currentKey = saved && this.themes[saved] ? saved : "agile";
    this.applyThemeToBody();
  }

  get() {
    return this.themes[this.currentKey];
  }

  getKey() {
    return this.currentKey;
  }

  set(key) {
    if (!this.themes[key]) return;
    this.currentKey = key;
    this.saveThemeKey(key);
    this.applyThemeToBody();
    this.listeners.forEach((fn) => fn(this.get()));
  }

  // Mirror the active theme onto <body data-theme="..."> so CSS can
  // scope theme-specific decorations (e.g., the classic-tile glow)
  // without JS having to inline every decorative property.
  applyThemeToBody() {
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.theme = this.currentKey;
    }
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  /**
   * Get the display label for a tile value under the active theme.
   * Values past the last defined label get a roman-numeral suffix:
   * "Principal II", "Principal III", "Principal IV", ...
   */
  getLabel(value) {
    const theme = this.get();
    if (theme.labels[value]) return theme.labels[value];

    const maxKey = Math.max(...Object.keys(theme.labels).map(Number));
    if (value > maxKey) {
      const multiplier = Math.log2(value / maxKey);
      return `${theme.labels[maxKey]} ${toRoman(multiplier + 1)}`;
    }
    return String(value);
  }

  /**
   * Get { bg, fg } colors for a tile value. Values past the last defined
   * color use the theme's superColor.
   */
  getColors(value) {
    const theme = this.get();
    if (theme.colors[value]) return theme.colors[value];
    return theme.superColor;
  }

  loadThemeKey() {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  saveThemeKey(key) {
    try {
      localStorage.setItem(this.storageKey, key);
    } catch {
      // Storage disabled — theme still works for the session, just won't persist
    }
  }
}

const themeManager = new ThemeManager();
