/* exported Leaderboard, DailyStreak */
/* global SeededRandom */

/**
 * Local records that sit beside the lifetime stats (js/stats.js):
 *
 * - Leaderboard: the five best finished runs per mode, highest score
 *   first. Ties keep the earlier run on top.
 * - DailyStreak: consecutive-calendar-day participation in the Daily
 *   Challenge. Playing on the day after the last recorded date extends
 *   the streak; any gap resets it to 1.
 *
 * Both persist through the storage manager (keys under the "2048-"
 * namespace) and both are undo-aware: GameManager stores the previous
 * value in its snapshots and restores it when the ending move is taken
 * back — see recordOutcomeIfEnded()/undo().
 */
class Leaderboard {
  constructor(storageManagerRef) {
    this.storageManager = storageManagerRef;
    this.maxEntries = 5;
  }

  /** Top runs for a mode, highest score first (never null). */
  get(mode) {
    const raw = this.storageManager.getLeaderboard
      ? this.storageManager.getLeaderboard(mode)
      : null;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => entry && Number.isFinite(entry.score)).slice(0, this.maxEntries);
  }

  /**
   * Insert one finished run. Returns the list as it was before the insert,
   * so the caller can hand it back to restore() if the ending move is
   * undone.
   */
  record(mode, entry) {
    const previous = this.get(mode);
    const candidate = {
      score: Number(entry.score) || 0,
      moves: Number(entry.moves) || 0,
      bestTile: Number(entry.bestTile) || 0,
      date: entry.date || "",
      at: Number(entry.at) || Date.now(),
    };
    const next = [...previous, candidate]
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, this.maxEntries);
    if (this.storageManager.setLeaderboard) this.storageManager.setLeaderboard(mode, next);
    return previous;
  }

  /** Put back a list returned by record() (undo of the end move). */
  restore(mode, entries) {
    if (this.storageManager.setLeaderboard) this.storageManager.setLeaderboard(mode, entries || []);
  }
}

class DailyStreak {
  constructor(storageManagerRef) {
    this.storageManager = storageManagerRef;
  }

  /** Current streak state, with defaults for a first-ever day. */
  get() {
    const raw = this.storageManager.getDailyStreak ? this.storageManager.getDailyStreak() : null;
    return {
      count: Number(raw && raw.count) || 0,
      lastDate: (raw && raw.lastDate) || null,
    };
  }

  /**
   * Count today's daily participation (called once per daily game setup).
   * Same day: unchanged. Yesterday: extend. Anything older: reset to 1.
   */
  touch(date) {
    const today = date || SeededRandom.dateKey();
    const current = this.get();
    if (current.lastDate === today) return current;

    const count = current.lastDate === DailyStreak.previousDate(today) ? current.count + 1 : 1;
    const next = { count, lastDate: today };
    if (this.storageManager.setDailyStreak) this.storageManager.setDailyStreak(next);
    return next;
  }

  /** "YYYY-MM-DD" minus one calendar day, in local time (matches dateKey). */
  static previousDate(dateKey) {
    const [year, month, day] = String(dateKey).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
