import { describe, it, expect, beforeEach } from "vitest";

import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("Preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#faf8ef");
    document.head.appendChild(meta);
  });

  it("defaults to calm: no dark mode, no ambience, no celebrations, motion on", () => {
    const prefs = new Preferences();
    expect(prefs.dark).toBe(false);
    expect(prefs.motion).toBe(true);
    expect(prefs.ambience).toBe(false);
    expect(prefs.celebrate).toBe(false);
    expect(prefs.reduceMotion()).toBe(false);
  });

  it("reads the persisted flags on attach", () => {
    localStorage.setItem("2048-dark", "1");
    localStorage.setItem("2048-motion", "0");
    localStorage.setItem("2048-ambience", "1");

    const prefs = new Preferences();
    prefs.attachStorage(new LocalStorageManager());

    expect(prefs.dark).toBe(true);
    expect(prefs.motion).toBe(false);
    expect(prefs.reduceMotion()).toBe(true);
    expect(prefs.ambience).toBe(true);
    expect(prefs.celebrate).toBe(false);
  });

  it("keeps the defaults when the storage manager has no flag support", () => {
    const prefs = new Preferences();
    prefs.attachStorage({}); // a manager that predates the flags
    expect(prefs.dark).toBe(false);
    expect(prefs.motion).toBe(true);
  });

  it("persists and applies a flipped preference", () => {
    const prefs = new Preferences();
    prefs.attachStorage(new LocalStorageManager());

    prefs.set("dark", true);
    expect(localStorage.getItem("2048-dark")).toBe("1");
    expect(document.body.classList.contains("dark")).toBe(true);
    expect(document.head.querySelector('meta[name="theme-color"]').getAttribute("content")).toBe(
      "#17171f"
    );

    prefs.set("dark", false);
    expect(localStorage.getItem("2048-dark")).toBe("0");
    expect(document.body.classList.contains("dark")).toBe(false);
    expect(document.head.querySelector('meta[name="theme-color"]').getAttribute("content")).toBe(
      "#faf8ef"
    );
  });

  it("mirrors motion and ambience onto body classes", () => {
    const prefs = new Preferences();
    prefs.attachStorage(new LocalStorageManager());

    prefs.set("motion", false);
    expect(document.body.classList.contains("reduced-motion")).toBe(true);
    prefs.set("motion", true);
    expect(document.body.classList.contains("reduced-motion")).toBe(false);

    prefs.set("ambience", true);
    expect(document.body.classList.contains("ambience-on")).toBe(true);
    prefs.set("ambience", false);
    expect(document.body.classList.contains("ambience-on")).toBe(false);
  });

  it("ignores unknown preference names", () => {
    const prefs = new Preferences();
    prefs.attachStorage(new LocalStorageManager());
    prefs.set("nonsense", true);
    expect(prefs.nonsense).toBeUndefined();
    expect(localStorage.getItem("2048-nonsense")).toBeNull();
  });

  it("stores flags as namespaced 1/0 values with a fallback", () => {
    const storage = new LocalStorageManager();
    expect(storage.getFlag("dark", true)).toBe(true); // missing → fallback
    storage.setFlag("dark", false);
    expect(localStorage.getItem("2048-dark")).toBe("0");
    expect(storage.getFlag("dark", true)).toBe(false); // stored value beats fallback
    localStorage.setItem("2048-dark", "garbage");
    expect(storage.getFlag("dark")).toBe(false); // anything but "1" reads as false
  });
});
