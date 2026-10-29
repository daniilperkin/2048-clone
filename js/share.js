/* exported ShareResult */

/**
 * Builds the copyable result summary and writes it to the clipboard.
 *
 * The board renders as an emoji grid (one row per row, sized from the
 * board — 3x3, 4x4 or 5x5) so the shape of a run is visible at a glance;
 * shading steps with tile value. Pure text builder + clipboard helper — no
 * DOM state, so both are trivially testable.
 */
class ShareResult {
  static buildText({ grid, score, mode, date }) {
    const header = mode === "daily" ? `2048 Daily — ${date}` : "2048";
    const lines = [header, `Score ${score} · Best tile ${ShareResult.bestTile(grid)}`];
    for (let y = 0; y < grid.size; y++) {
      let row = "";
      for (let x = 0; x < grid.size; x++) {
        const cell = grid.cells[x] && grid.cells[x][y];
        row += ShareResult.emojiFor(cell ? cell.value : 0);
      }
      lines.push(row);
    }
    return lines.join("\n");
  }

  static bestTile(grid) {
    let best = 0;
    grid.eachCell((_x, _y, tile) => {
      if (tile && tile.value > best) best = tile.value;
    });
    return best;
  }

  static emojiFor(value) {
    if (!value) return "⬛";
    if (value < 16) return "⬜";
    if (value < 128) return "🟧";
    if (value < 512) return "🟨";
    return "🟩";
  }

  /** Copy text to the clipboard; resolves true when it landed. */
  static copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => false);
    }
    // Fallback for browsers without the async Clipboard API.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return Promise.resolve(ok);
    } catch (_e) {
      return Promise.resolve(false);
    }
  }
}
