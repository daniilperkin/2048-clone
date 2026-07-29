import { describe, it, expect } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("Tile", () => {
  it("constructs with position and value", () => {
    const tile = new Tile({ x: 1, y: 2 }, 4);
    expect(tile.x).toBe(1);
    expect(tile.y).toBe(2);
    expect(tile.value).toBe(4);
  });

  it("defaults value to 2 when not provided", () => {
    const tile = new Tile({ x: 0, y: 0 });
    expect(tile.value).toBe(2);
  });

  it("initializes previousPosition and mergedFrom as null", () => {
    const tile = new Tile({ x: 0, y: 0 }, 2);
    expect(tile.previousPosition).toBeNull();
    expect(tile.mergedFrom).toBeNull();
  });

  it("savePosition captures current position", () => {
    const tile = new Tile({ x: 1, y: 2 }, 4);
    tile.savePosition();
    expect(tile.previousPosition).toEqual({ x: 1, y: 2 });
  });

  it("updatePosition changes x and y", () => {
    const tile = new Tile({ x: 0, y: 0 }, 2);
    tile.updatePosition({ x: 3, y: 1 });
    expect(tile.x).toBe(3);
    expect(tile.y).toBe(1);
  });

  it("serialize returns position and value", () => {
    const tile = new Tile({ x: 2, y: 3 }, 8);
    expect(tile.serialize()).toEqual({
      position: { x: 2, y: 3 },
      value: 8,
    });
  });
});
