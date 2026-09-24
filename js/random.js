/* exported SeededRandom */
// Deterministic PRNG (mulberry32) for the Daily Challenge. The whole
// generator state is one uint32, so it serializes into the saved game
// and undo snapshots: restoring a snapshot replays the exact same spawn,
// which keeps undo from being used to re-roll tiles.
class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  // Uniform float in [0, 1), same contract as Math.random().
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Local calendar date as "YYYY-MM-DD" (the player's "today").
  static dateKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // FNV-1a hash of the date key -> uint32 seed.
  static seedFor(key) {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}
