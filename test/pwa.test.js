import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("PWA manifest", () => {
  it("parses and carries the install metadata", () => {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(fs.existsSync(path.join(ROOT, icon.src))).toBe(true);
    }
  });

  it("ships icons at the exact sizes it claims", () => {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    for (const icon of manifest.icons) {
      const buf = fs.readFileSync(path.join(ROOT, icon.src));
      // PNG magic number, then IHDR width/height at bytes 16-24.
      expect(buf.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
      expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });
});

describe("service worker shell", () => {
  const sw = read("sw.js");

  it("precaches every same-origin file index.html references", () => {
    const html = read("index.html");
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter(
        (ref) =>
          !ref.startsWith("#") &&
          !ref.startsWith("data:") &&
          !ref.startsWith("http") &&
          fs.existsSync(path.join(ROOT, ref))
      );
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      expect(sw, `${ref} is missing from sw.js APP_SHELL`).toContain(`"./${ref}"`);
    }
  });

  it("has a versioned cache name and prunes old caches", () => {
    expect(sw).toMatch(/CACHE_VERSION = "v\d+"/);
    expect(sw).toContain("caches.delete");
  });
});
