import { describe, it, expect } from 'vitest';
import { Stopwatch, WALL_CLOCK_CORRECTION_THRESHOLD_MS, type Clocks } from './stopwatch';

function createMockClocks(initialMonotonic = 1000, initialWall = 1700000000000): {
  clocks: Clocks;
  advanceMonotonic: (ms: number) => void;
  advanceWallClock: (ms: number) => void;
  advanceBoth: (ms: number) => void;
} {
  let monotonic = initialMonotonic;
  let wall = initialWall;

  return {
    clocks: {
      nowMonotonic: () => monotonic,
      nowWallClock: () => wall,
    },
    advanceMonotonic: (ms: number) => {
      monotonic += ms;
    },
    advanceWallClock: (ms: number) => {
      wall += ms;
    },
    advanceBoth: (ms: number) => {
      monotonic += ms;
      wall += ms;
    },
  };
}

describe('Stopwatch', () => {
  it('starts at 0 and is not running initially', () => {
    const { clocks } = createMockClocks();
    const sw = new Stopwatch(clocks);
    expect(sw.isRunning()).toBe(false);
    expect(sw.getElapsedMs()).toBe(0);
  });

  it('computes elapsed time monotonically while running', () => {
    const { clocks, advanceBoth } = createMockClocks(1000, 50000);
    const sw = new Stopwatch(clocks);

    sw.start();
    expect(sw.isRunning()).toBe(true);
    expect(sw.getElapsedMs()).toBe(0);

    advanceBoth(1500);
    expect(sw.getElapsedMs()).toBe(1500);

    advanceBoth(2000);
    expect(sw.getElapsedMs()).toBe(3500);
  });

  it('accepts explicit start timestamps for synchronized multi-subsystem starts', () => {
    const { clocks, advanceBoth } = createMockClocks(1000, 50000);
    const sw = new Stopwatch(clocks);

    // Explicit start at wall clock 50000 and monotonic 1000
    sw.start(50000, 1000);
    expect(sw.isRunning()).toBe(true);

    advanceBoth(500);
    expect(sw.getElapsedMs()).toBe(500);
  });

  it('stops and preserves accumulated time, then resumes with INICIAR', () => {
    const { clocks, advanceBoth } = createMockClocks(1000, 50000);
    const sw = new Stopwatch(clocks);

    sw.start();
    advanceBoth(2000);
    expect(sw.getElapsedMs()).toBe(2000);

    sw.stop();
    expect(sw.isRunning()).toBe(false);
    expect(sw.getElapsedMs()).toBe(2000);

    // Time elapses while stopped
    advanceBoth(5000);
    expect(sw.getElapsedMs()).toBe(2000);

    // Resume
    sw.start();
    expect(sw.isRunning()).toBe(true);
    advanceBoth(1000);
    expect(sw.getElapsedMs()).toBe(3000);
  });

  it('resets to 0 and stops', () => {
    const { clocks, advanceBoth } = createMockClocks(1000, 50000);
    const sw = new Stopwatch(clocks);

    sw.start();
    advanceBoth(4000);
    expect(sw.getElapsedMs()).toBe(4000);

    sw.reset();
    expect(sw.isRunning()).toBe(false);
    expect(sw.getElapsedMs()).toBe(0);

    advanceBoth(2000);
    expect(sw.getElapsedMs()).toBe(0);
  });

  it('ignores redundant start and stop calls', () => {
    const { clocks, advanceBoth } = createMockClocks(1000, 50000);
    const sw = new Stopwatch(clocks);

    sw.stop(); // No-op when already stopped
    expect(sw.isRunning()).toBe(false);

    sw.start();
    advanceBoth(1000);
    sw.start(); // No-op when already running
    advanceBoth(1000);
    expect(sw.getElapsedMs()).toBe(2000);
  });

  describe('visibility change and wall-clock correction (250 ms threshold)', () => {
    it('does not correct if drift is <= 250 ms', () => {
      const { clocks, advanceMonotonic, advanceWallClock } = createMockClocks(1000, 50000);
      const sw = new Stopwatch(clocks);

      sw.start();
      advanceMonotonic(1000);
      advanceWallClock(1200); // 200ms diff <= 250ms threshold

      const corrected = sw.onVisibilityChange(true);
      expect(corrected).toBe(false);
      // Monotonic elapsed (1000ms) is preserved
      expect(sw.getElapsedMs()).toBe(1000);
    });

    it('corrects elapsed time when drift exceeds 250 ms on becoming visible', () => {
      const { clocks, advanceMonotonic, advanceWallClock } = createMockClocks(1000, 50000);
      const sw = new Stopwatch(clocks);

      sw.start();
      // Simulate tab throttling / sleeping:
      // Monotonic only advanced 500ms, but wall clock advanced 5000ms
      advanceMonotonic(500);
      advanceWallClock(5000);

      expect(WALL_CLOCK_CORRECTION_THRESHOLD_MS).toBe(250);
      const corrected = sw.onVisibilityChange(true);
      expect(corrected).toBe(true);

      // Now elapsed time should match wall clock (5000ms)
      expect(sw.getElapsedMs()).toBe(5000);

      // Future monotonic progress continues smoothly from the new base
      advanceMonotonic(200);
      advanceWallClock(200);
      expect(sw.getElapsedMs()).toBe(5200);
    });

    it('ignores onVisibilityChange when page is hidden (visible = false)', () => {
      const { clocks, advanceMonotonic, advanceWallClock } = createMockClocks(1000, 50000);
      const sw = new Stopwatch(clocks);

      sw.start();
      advanceMonotonic(500);
      advanceWallClock(5000);

      const corrected = sw.onVisibilityChange(false);
      expect(corrected).toBe(false);
      expect(sw.getElapsedMs()).toBe(500);
    });

    it('ignores onVisibilityChange when stopwatch is not running', () => {
      const { clocks, advanceWallClock } = createMockClocks(1000, 50000);
      const sw = new Stopwatch(clocks);

      advanceWallClock(10000);
      const corrected = sw.onVisibilityChange(true);
      expect(corrected).toBe(false);
      expect(sw.getElapsedMs()).toBe(0);
    });
  });
});
