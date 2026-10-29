/**
 * Screen Wake Lock manager.
 *
 * Wraps the browser Screen Wake Lock API (navigator.wakeLock) with a
 * testable interface. The bridge owns exactly one instance and calls:
 *   - acquire() on INICIAR (from a user-gesture context)
 *   - release() on PARAR and REINICIAR
 *   - onPageVisible(isRunning) on visibilitychange
 *
 * If the API is unsupported, the request fails, or the lock is released by
 * the system (low battery, page hidden), the manager degrades silently.
 * The race never depends on holding the lock.
 *
 * iOS compatibility note: wake lock works in installed home-screen PWAs from
 * iOS 18.4 and in Safari tabs from iOS 16.4.
 */

/** Minimal wake lock sentinel interface for testability. */
export interface WakeLockSentinel {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', handler: () => void): void;
  removeEventListener(type: 'release', handler: () => void): void;
}

/** Injectable browser wake lock API for testing. */
export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

/**
 * Screen Wake Lock manager (framework-free, injectable API for tests).
 */
export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private readonly api: WakeLockApi | null;

  constructor(api?: WakeLockApi | null) {
    if (api !== undefined) {
      this.api = api;
    } else if (
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      navigator.wakeLock !== null
    ) {
      this.api = navigator.wakeLock as WakeLockApi;
    } else {
      this.api = null;
    }
  }

  /**
   * Acquires a screen wake lock.
   * No-op if the API is unsupported, a lock is already held, or the request fails.
   * Must be called from a user-gesture handler (e.g. INICIAR).
   * Must not be called while the page is hidden.
   */
  async acquire(): Promise<void> {
    if (!this.api) return;
    if (this.sentinel && !this.sentinel.released) return;

    try {
      const sentinel = await this.api.request('screen');
      this.sentinel = sentinel;

      // Drop our reference when the system releases the lock on its own.
      const releaseHandler = () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
        sentinel.removeEventListener('release', releaseHandler);
      };
      sentinel.addEventListener('release', releaseHandler);
    } catch {
      // Unsupported, not-allowed (low battery, iOS restriction), or request error.
      // Degrade silently — the race must never depend on the lock.
      this.sentinel = null;
    }
  }

  /**
   * Releases the held wake lock (called on PARAR and REINICIAR).
   */
  async release(): Promise<void> {
    const s = this.sentinel;
    this.sentinel = null;
    if (s && !s.released) {
      try {
        await s.release();
      } catch {
        // Ignore release errors.
      }
    }
  }

  /**
   * Called on visibilitychange.
   * - If the page is becoming visible and the race is running, re-acquires the lock.
   * - If the page is becoming hidden, no-op (do not request while hidden).
   */
  async onPageVisible(isVisible: boolean, isRunning: boolean): Promise<void> {
    if (!isVisible) return;
    if (!isRunning) return;
    // Only re-acquire if we do not hold a live lock.
    if (this.sentinel && !this.sentinel.released) return;
    await this.acquire();
  }

  /** Returns true if a live lock is currently held (for testing). */
  isHeld(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }
}
