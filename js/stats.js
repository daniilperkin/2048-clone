/* exported StatsTracker */

/**
 * Lifetime stats for finished games, persisted through the storage manager
 * under the "2048-" namespace.
 *
 * A game is counted exactly once, at the moment it first ends (win or
 * loss). GameManager keeps the previous numbers alongside its undo
 * snapshots, so taking back the move that ended the game rolls the record
 * back — see record()/restore().
 */
class StatsTracker {
  constructor(storageManagerRef) {
    this.storageManager = storageManagerRef;
  }

  /** Current stats, with defaults for a first-ever run. */
  get() {
    const raw = this.storageManager.getStats ? this.storageManager.getStats() : null;
    return {
      played: Number(raw && raw.played) || 0,
      won: Number(raw && raw.won) || 0,
      bestTile: Number(raw && raw.bestTile) || 0,
      streak: Number(raw && raw.streak) || 0,
      bestStreak: Number(raw && raw.bestStreak) || 0,
    };
  }

  /**
   * Record one finished game. Returns the previous stats so the caller can
   * hand them to restore() if the ending move gets undone.
   */
  record(won, bestTile) {
    const previous = this.get();
    const streak = won ? previous.streak + 1 : 0;
    this.save({
      played: previous.played + 1,
      won: previous.won + (won ? 1 : 0),
      bestTile: Math.max(previous.bestTile, Number(bestTile) || 0),
      streak,
      bestStreak: Math.max(previous.bestStreak, streak),
    });
    return previous;
  }

  /** Put back a stats object returned by record() (undo of the end move). */
  restore(previous) {
    this.save(previous);
  }

  save(stats) {
    if (this.storageManager.setStats) this.storageManager.setStats(stats);
  }
}
