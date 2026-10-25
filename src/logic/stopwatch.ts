/**
 * Monotonic and wall-clock time providers for testability.
 */
export interface Clocks {
  nowMonotonic: () => number;
  nowWallClock: () => number;
}

export const defaultClocks: Clocks = {
  nowMonotonic: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  nowWallClock: () => Date.now(),
};

export const WALL_CLOCK_CORRECTION_THRESHOLD_MS = 250;

/**
 * Pure stopwatch model.
 * Elapsed time is computed from a monotonic clock (performance.now)
 * using accumulated time plus the time since the last start.
 *
 * It tracks wall-clock time (Date.now) at start. When the page becomes visible
 * again after being hidden, if monotonic elapsed and wall-clock elapsed differ
 * by more than 250ms, it corrects the elapsed time to the wall-clock value.
 */
export class Stopwatch {
  private accumulatedMs: number = 0;
  private running: boolean = false;
  private startMonotonic: number | null = null;
  private startWallClock: number | null = null;
  private clocks: Clocks;

  constructor(clocks: Clocks = defaultClocks) {
    this.clocks = clocks;
  }

  /**
   * Starts or resumes the stopwatch.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.startMonotonic = this.clocks.nowMonotonic();
    this.startWallClock = this.clocks.nowWallClock();
  }

  /**
   * Stops the stopwatch and keeps accumulated time so INICIAR can resume.
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.accumulatedMs = this.getElapsedMs();
    this.running = false;
    this.startMonotonic = null;
    this.startWallClock = null;
  }

  /**
   * Stops the stopwatch and resets accumulated time to zero.
   */
  reset(): void {
    this.running = false;
    this.accumulatedMs = 0;
    this.startMonotonic = null;
    this.startWallClock = null;
  }

  /**
   * Returns whether the stopwatch is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns current elapsed time in milliseconds.
   */
  getElapsedMs(): number {
    if (!this.running || this.startMonotonic === null) {
      return this.accumulatedMs;
    }
    const currentMonotonic = this.clocks.nowMonotonic();
    const elapsedSinceStart = Math.max(0, currentMonotonic - this.startMonotonic);
    return this.accumulatedMs + elapsedSinceStart;
  }

  /**
   * Handles visibility changes (e.g. document.visibilitychange).
   * When visible is true and the stopwatch is running, compares monotonic elapsed
   * with wall-clock elapsed. If they differ by more than 250 ms, corrects the
   * base time to match the wall-clock elapsed time.
   *
   * Returns true if a correction was applied, false otherwise.
   */
  onVisibilityChange(visible: boolean): boolean {
    if (!visible || !this.running || this.startMonotonic === null || this.startWallClock === null) {
      return false;
    }

    const currentMonotonic = this.clocks.nowMonotonic();
    const currentWallClock = this.clocks.nowWallClock();

    const monoElapsed = Math.max(0, currentMonotonic - this.startMonotonic);
    const wallElapsed = Math.max(0, currentWallClock - this.startWallClock);

    const diff = Math.abs(wallElapsed - monoElapsed);
    if (diff > WALL_CLOCK_CORRECTION_THRESHOLD_MS) {
      this.accumulatedMs += wallElapsed;
      this.startMonotonic = currentMonotonic;
      this.startWallClock = currentWallClock;
      return true;
    }

    return false;
  }
}
