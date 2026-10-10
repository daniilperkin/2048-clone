#!/usr/bin/env node
/**
 * Generates the PWA icons (meta/icon-192.png, meta/icon-512.png) — the
 * classic gold 2048 tile on the cream page background, drawn from code
 * with a tiny PNG encoder (zlib only, no image dependencies).
 *
 * Usage:  node tools/make-icons.mjs
 *
 * The generated PNGs are committed, so builds don't depend on running
 * this script; re-run it after changing the palette or the numeral below.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BG = [250, 248, 239]; // #faf8ef — page background
const TILE = [237, 194, 46]; // #edc22e — the 2048 tile
const INK = [255, 255, 255]; // white numeral

// 5x7 pixel numerals, one string per row, "1" = ink.
const FONT = {
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
};
const WORD = "2048";
const SS = 2; // supersampling factor (render 2x, then box-downsample)

function renderIcon(size) {
  const s = size * SS;
  const inset = s * 0.085;
  const radius = s * 0.12;
  const lo = inset;
  const hi = s - inset;

  const inTile = (x, y) => {
    if (x < lo || x >= hi || y < lo || y >= hi) return false;
    const nx = Math.min(Math.max(x, lo + radius), hi - radius);
    const ny = Math.min(Math.max(y, lo + radius), hi - radius);
    const dx = x - nx;
    const dy = y - ny;
    return dx * dx + dy * dy <= radius * radius;
  };

  const cell = Math.round((s * 0.24) / 7);
  const glyphW = 5 * cell;
  const gap = cell;
  const textW = 4 * glyphW + 3 * gap;
  const textH = 7 * cell;
  const tx = Math.round((s - textW) / 2);
  const ty = Math.round((s - textH) / 2);

  const inInk = (x, y) => {
    if (x < tx || x >= tx + textW || y < ty || y >= ty + textH) return false;
    const gx = x - tx;
    const gy = y - ty;
    const col = Math.floor(gx / (glyphW + gap));
    const within = gx % (glyphW + gap);
    if (col > 3 || within >= glyphW) return false;
    const row = Math.floor(gy / cell);
    const colIdx = Math.floor(within / cell);
    return FONT[WORD[col]][row][colIdx] === "1";
  };

  const px = new Uint8Array(s * s * 3);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const tile = inTile(x, y);
      const color = tile && inInk(x, y) ? INK : tile ? TILE : BG;
      const i = (y * s + x) * 3;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
    }
  }

  // Box-downsample the supersampled buffer.
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * s + (x * SS + sx)) * 3;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = path.join(ROOT, "meta", `icon-${size}.png`);
  fs.writeFileSync(file, encodePNG(size, renderIcon(size)));
  console.log(`wrote ${path.relative(ROOT, file)}`);
}
