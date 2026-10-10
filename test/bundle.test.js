import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { extractShell } from "../build-bundle.js";

const ROOT = process.cwd();

/** Every class token used in a chunk of markup. */
function classesIn(markup) {
  return new Set([...markup.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
}

describe("single-file bundle", () => {
  it("mirrors every class from index.html's body (drift guard)", () => {
    // Regression: the hand-copied shell once shipped without the Undo and
    // Daily buttons. The shell is now derived from index.html; this test
    // keeps it that way — a control added to index.html must reach the
    // bundle or this fails.
    const indexHtml = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const body = indexHtml
      .match(/<body>([\s\S]*)<\/body>/)[1]
      .replace(/<script[\s\S]*?<\/script>/g, "");

    const shellClasses = classesIn(extractShell());
    const missing = [...classesIn(body)].filter((cls) => !shellClasses.has(cls));
    expect(missing).toEqual([]);
  });

  it("keeps the shell free of scripts, links and external references", () => {
    const shell = extractShell();
    expect(shell).not.toMatch(/<script/i);
    expect(shell).not.toMatch(/<link/i);
    expect(shell).not.toMatch(/(?:src|href)="(?!data:|#)/);
  });

  it("builds a complete single file: inlined CSS + JS, tile art, no external refs", () => {
    // Full pipeline via the real CLI entry (also covers the main() guard).
    execFileSync(process.execPath, ["build-bundle.js"], { cwd: ROOT, stdio: "pipe" });

    const out = readFileSync(resolve(ROOT, "2048.html"), "utf8");

    // The shell ships verbatim…
    expect(out).toContain(extractShell());
    // …the controls that once went missing are present…
    expect(out).toContain('class="undo-button"');
    expect(out).toContain('class="daily-button"');
    // …and the file is truly self-contained.
    expect(out).toMatch(/<style>/);
    expect(out).toMatch(/<script>/);
    expect(out).not.toMatch(/<script\s+src=/);
    expect(out).not.toMatch(/<link\s+rel=/);
    expect(out).toContain("data:image/svg+xml;base64,");
  });
});
