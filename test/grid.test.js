import { describe, it, expect, beforeEach } from "vitest";
import { loadGameFiles } from "./setup.js";

loadGameFiles();

describe("Grid", () => {
  let grid;

  beforeEach(() => {
    grid = new Grid(4);
  });

  describe("constructor", () => {
    it("creates a 4x4 empty grid", () => {
      expect(grid.size).toBe(4);
      expect(grid.cells.length).toBe(4);
      expect(grid.cells[0].length).toBe(4);
      expect(grid.cells[0][0]).toBeNull();
      expect(grid.cells[3][3]).toBeNull();
    });

    it("builds from a previous state", () => {
      const state = [
        [null, { position: { x: 0, y: 1 }, value: 4 }, null, null],
        [null, null, null, null],
        [{ position: { x: 2, y: 0 }, value: 2 }, null, null, null],
        [null, null, null, null],
      ];
      const g = new Grid(4, state);
      expect(g.cellContent({ x: 0, y: 1 }).value).toBe(4);
      expect(g.cellContent({ x: 2, y: 0 }).value).toBe(2);
      expect(g.cellContent({ x: 0, y: 0 })).toBeNull();
    });
  });

  describe("insertTile / removeTile", () => {
    it("inserts a tile at its position", () => {
      const tile = new Tile({ x: 1, y: 1 }, 2);
      grid.insertTile(tile);
      expect(grid.cellContent({ x: 1, y: 1 })).toBe(tile);
    });

    it("removes a tile from its position", () => {
      const tile = new Tile({ x: 1, y: 1 }, 2);
      grid.insertTile(tile);
      grid.removeTile(tile);
      expect(grid.cellContent({ x: 1, y: 1 })).toBeNull();
    });
  });

  describe("availableCells", () => {
    it("returns all 16 cells for an empty grid", () => {
      expect(grid.availableCells().length).toBe(16);
    });

    it("returns 15 cells after inserting one tile", () => {
      grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
      expect(grid.availableCells().length).toBe(15);
    });
  });

  describe("cellsAvailable / cellAvailable", () => {
    it("cellsAvailable is true for empty grid", () => {
      expect(grid.cellsAvailable()).toBe(true);
    });

    it("cellsAvailable is false when grid is full", () => {
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          grid.insertTile(new Tile({ x, y }, 2));
        }
      }
      expect(grid.cellsAvailable()).toBe(false);
    });

    it("cellAvailable returns true for empty cell", () => {
      expect(grid.cellAvailable({ x: 0, y: 0 })).toBe(true);
    });

    it("cellAvailable returns false for occupied cell", () => {
      grid.insertTile(new Tile({ x: 0, y: 0 }, 2));
      expect(grid.cellAvailable({ x: 0, y: 0 })).toBe(false);
    });
  });

  describe("withinBounds", () => {
    it("returns true for in-bounds positions", () => {
      expect(grid.withinBounds({ x: 0, y: 0 })).toBe(true);
      expect(grid.withinBounds({ x: 3, y: 3 })).toBe(true);
    });

    it("returns false for out-of-bounds positions", () => {
      expect(grid.withinBounds({ x: -1, y: 0 })).toBe(false);
      expect(grid.withinBounds({ x: 4, y: 0 })).toBe(false);
      expect(grid.withinBounds({ x: 0, y: -1 })).toBe(false);
      expect(grid.withinBounds({ x: 0, y: 4 })).toBe(false);
    });
  });

  describe("cellContent", () => {
    it("returns null for out-of-bounds cell", () => {
      expect(grid.cellContent({ x: 10, y: 10 })).toBeNull();
    });
  });

  describe("serialize / fromState round-trip", () => {
    it("serialize returns size and cells array", () => {
      const serialized = grid.serialize();
      expect(serialized.size).toBe(4);
      expect(serialized.cells.length).toBe(4);
      expect(serialized.cells[0][0]).toBeNull();
    });

    it("serialize -> fromState preserves tile values", () => {
      grid.insertTile(new Tile({ x: 1, y: 2 }, 8));
      grid.insertTile(new Tile({ x: 3, y: 0 }, 16));
      const state = grid.serialize();

      const restored = new Grid(4, state.cells);
      expect(restored.cellContent({ x: 1, y: 2 }).value).toBe(8);
      expect(restored.cellContent({ x: 3, y: 0 }).value).toBe(16);
      expect(restored.cellContent({ x: 0, y: 0 })).toBeNull();
    });
  });
});
