/* exported SoundManager, soundManager */

/**
 * Tiny synthesised sound layer — no audio assets, no dependencies.
 *
 * Off by default and persisted under the LocalStorageManager key
 * "2048-sound": a game that starts making noise the first time you press
 * an arrow key is a bad neighbour, and whatever the player chooses
 * survives a reload.
 *
 * The AudioContext is created lazily on the first effect. Browsers refuse
 * to start audio outside a user gesture, and every effect here is caused
 * by a key press or a tap, so the gesture is always there to unlock it.
 *
 * Every method is a no-op when sound is off or WebAudio is unavailable
 * (jsdom, ancient browsers) — callers never need to guard.
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.storage = null;
    this.enabled = false;
  }

  /** Wire in the storage manager so the preference can persist. */
  attachStorage(storageManager) {
    this.storage = storageManager;
    // Read defensively: a storage manager that predates the sound key
    // leaves sound off rather than throwing during boot.
    this.enabled =
      typeof storageManager.getSoundEnabled === "function"
        ? storageManager.getSoundEnabled()
        : false;
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.storage) this.storage.setSoundEnabled(this.enabled);
    if (this.enabled) this.context();
  }

  /** The live AudioContext, or null when sound is off/unsupported. */
  context() {
    if (!this.enabled) return null;
    const Ctor =
      typeof window !== "undefined" &&
      (window.AudioContext || /** @type {any} */ (window).webkitAudioContext);
    if (!Ctor) return null;
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * One plucked note. `glide` bends the pitch by that factor over the
   * note's life; the gain envelope is a short attack and an exponential
   * tail so nothing ever clicks.
   */
  tone(freq, { duration = 0.12, gain = 0.05, type = "triangle", glide = 1, delay = 0 } = {}) {
    const ctx = this.context();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glide !== 1) {
      osc.frequency.exponentialRampToValueAtTime(freq * glide, start + duration);
    }

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** A move that merged nothing: a soft low tick. */
  move() {
    this.tone(196, { duration: 0.07, gain: 0.03, type: "sine" });
  }

  /**
   * One blip per merged tile, pitched by the merged value, staggered so a
   * double merge reads as two events instead of one louder one.
   */
  merge(values) {
    values.forEach((value, index) => {
      // Two semitones per doubling, so 8 is a step above 4 and 2048 is a
      // scream — clamped to just over an octave so it never gets shrill.
      const step = Math.max(0, Math.min(15, Math.round(Math.log2(value / 4) * 2)));
      this.tone(330 * 2 ** (step / 12), {
        delay: index * 0.045,
        duration: 0.16,
        gain: 0.055,
        glide: 1.02,
      });
    });
  }

  /** Descending three-note motif for game over. */
  gameOver() {
    [440, 330, 220].forEach((freq, index) => {
      this.tone(freq, {
        delay: index * 0.16,
        duration: 0.3,
        gain: 0.05,
        type: "sine",
        glide: 0.98,
      });
    });
  }

  /** Rising four-note fanfare when a game is won. */
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.tone(freq, {
        delay: index * 0.11,
        duration: 0.26,
        gain: 0.05,
        glide: 1.01,
      });
    });
  }

  /** Soft downward tick when a move is taken back. */
  undo() {
    this.tone(330, { duration: 0.09, gain: 0.03, type: "sine", glide: 0.75 });
  }
}

/** Single shared instance: the UI toggle and the game must agree. */
const soundManager = new SoundManager();
