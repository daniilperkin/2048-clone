import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { loadGameFiles } from "./setup.js";

loadGameFiles();

/** Minimal WebAudio stand-in — jsdom has no audio backend at all. */
class FakeParam {
  constructor() {
    this.calls = [];
  }

  setValueAtTime(value, time) {
    this.calls.push(["setValueAtTime", value, time]);
  }

  exponentialRampToValueAtTime(value, time) {
    this.calls.push(["exponentialRampToValueAtTime", value, time]);
  }
}

class FakeOscillator {
  constructor() {
    this.type = "";
    this.frequency = new FakeParam();
    this.connected = [];
    this.startedAt = null;
    this.stoppedAt = null;
    this.start = (time) => {
      this.startedAt = time;
    };
    this.stop = (time) => {
      this.stoppedAt = time;
    };
  }

  connect(node) {
    this.connected.push(node);
    return node;
  }
}

class FakeGain {
  constructor() {
    this.gain = new FakeParam();
  }

  connect(node) {
    return node;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.state = "running";
    this.destination = { name: "destination" };
    this.oscillators = [];
    this.createdGains = 0;
    this.resumed = false;
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    this.createdGains += 1;
    return new FakeGain();
  }

  resume() {
    this.resumed = true;
  }
}

FakeAudioContext.instances = [];

const frequencyOf = (osc) => osc.frequency.calls[0][1];

describe("SoundManager", () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    window.localStorage.clear();
    FakeAudioContext.instances = [];
    window.AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    if (originalAudioContext === undefined) delete window.AudioContext;
    else window.AudioContext = originalAudioContext;
  });

  it("is silent until the player opts in", () => {
    const sound = new SoundManager();

    expect(sound.isEnabled()).toBe(false);
    expect(sound.context()).toBeNull();

    sound.merge([8]);
    sound.move();
    sound.gameOver();

    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("stays a no-op when the browser has no WebAudio", () => {
    delete window.AudioContext;

    const sound = new SoundManager();
    sound.setEnabled(true);

    expect(sound.context()).toBeNull();
    expect(() => sound.merge([8])).not.toThrow();
    expect(() => sound.gameOver()).not.toThrow();
  });

  it("synthesises one note per merged tile, pitched by value", () => {
    const sound = new SoundManager();
    sound.setEnabled(true);

    sound.merge([8]);

    const ctx = FakeAudioContext.instances[0];
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0].startedAt).toBe(10);
    // Two semitones per doubling above a 4-merge.
    expect(frequencyOf(ctx.oscillators[0])).toBeCloseTo(330 * 2 ** (2 / 12), 5);
  });

  it("pitches bigger merges higher and staggers simultaneous ones", () => {
    const sound = new SoundManager();
    sound.setEnabled(true);

    sound.merge([8]);
    sound.merge([64]);
    sound.merge([8, 16]);

    const ctx = FakeAudioContext.instances[0];
    const [small, large, first, second] = ctx.oscillators;

    expect(frequencyOf(large)).toBeGreaterThan(frequencyOf(small));
    expect(second.startedAt).toBeGreaterThan(first.startedAt);
  });

  it("clamps the pitch so huge merges never get shrill", () => {
    const sound = new SoundManager();
    sound.setEnabled(true);

    sound.merge([8192]);

    const ctx = FakeAudioContext.instances[0];
    expect(frequencyOf(ctx.oscillators[0])).toBeLessThanOrEqual(330 * 2 ** (15 / 12));
  });

  it("plays a three-note motif on game over", () => {
    const sound = new SoundManager();
    sound.setEnabled(true);

    sound.gameOver();

    const ctx = FakeAudioContext.instances[0];
    expect(ctx.oscillators).toHaveLength(3);
    expect(ctx.oscillators[1].startedAt).toBeGreaterThan(ctx.oscillators[0].startedAt);
  });

  it("persists the preference through the storage manager", () => {
    const storage = new LocalStorageManager();
    const sound = new SoundManager();
    sound.attachStorage(storage);

    // Default off, and an absent key stays off after a reload.
    expect(sound.isEnabled()).toBe(false);
    expect(storage.getSoundEnabled()).toBe(false);

    sound.setEnabled(true);
    expect(window.localStorage.getItem("2048-sound")).toBe("1");

    const reloaded = new SoundManager();
    reloaded.attachStorage(new LocalStorageManager());
    expect(reloaded.isEnabled()).toBe(true);

    reloaded.setEnabled(false);
    expect(window.localStorage.getItem("2048-sound")).toBe("0");
    expect(new SoundManager().isEnabled()).toBe(false);
  });
});
