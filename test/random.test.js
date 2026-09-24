import { describe, it, expect } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("returns floats in [0, 1)", () => {
    const r = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("resumes from a saved state", () => {
    const r = new SeededRandom(1);
    r.next();
    const copy = new SeededRandom(r.state);
    expect(copy.next()).toBe(r.next());
  });

  it("formats local dates as YYYY-MM-DD", () => {
    expect(SeededRandom.dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("derives distinct stable seeds per date", () => {
    const s1 = SeededRandom.seedFor("2026-09-24");
    expect(SeededRandom.seedFor("2026-09-24")).toBe(s1);
    expect(SeededRandom.seedFor("2026-09-25")).not.toBe(s1);
  });
});
