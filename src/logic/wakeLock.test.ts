import { describe, it, expect } from 'vitest';
import { WakeLockManager, type WakeLockSentinel, type WakeLockApi } from './wakeLock';

// ── Fake sentinel factory ──────────────────────────────────────────────────

function makeFakeSentinel(): WakeLockSentinel & { simulateSystemRelease: () => void } {
  let released = false;
  const handlers = new Set<() => void>();
  return {
    get released() { return released; },
    async release() {
      released = true;
      for (const h of handlers) h();
    },
    addEventListener(_type: 'release', h: () => void) { handlers.add(h); },
    removeEventListener(_type: 'release', h: () => void) { handlers.delete(h); },
    /** Simulates the browser/OS releasing the lock externally. */
    simulateSystemRelease() {
      released = true;
      for (const h of handlers) h();
    },
  };
}

// ── Fake API factory ───────────────────────────────────────────────────────
// Each successful request() returns a FRESH sentinel (mirrors real browser behaviour —
// once a sentinel is released, you must request a new one).

function makeFakeApi() {
  let currentSentinel: ReturnType<typeof makeFakeSentinel> = makeFakeSentinel();

  const api = {
    /** The sentinel that will be returned by the NEXT request() call. */
    get sentinel(): ReturnType<typeof makeFakeSentinel> { return currentSentinel; },
    requestCount: 0,
    rejectNext: false,
    async request(_type: 'screen'): Promise<WakeLockSentinel> {
      api.requestCount++;
      if (api.rejectNext) {
        api.rejectNext = false;
        throw new DOMException('Not allowed', 'NotAllowedError');
      }
      currentSentinel = makeFakeSentinel();
      return currentSentinel;
    },
  };
  return api;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WakeLockManager', () => {
  it('acquires a lock on the first acquire() call', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    expect(wl.isHeld()).toBe(false);
    await wl.acquire();

    expect(api.requestCount).toBe(1);
    expect(wl.isHeld()).toBe(true);
  });

  it('does not acquire a second lock when one is already held', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();
    await wl.acquire(); // no-op

    expect(api.requestCount).toBe(1);
  });

  it('releases the held lock', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();
    const heldSentinel = api.sentinel; // capture after acquire
    expect(wl.isHeld()).toBe(true);

    await wl.release();
    expect(wl.isHeld()).toBe(false);
    expect(heldSentinel.released).toBe(true);
  });

  it('release() is a no-op when no lock is held', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    // Should not throw
    await wl.release();
    expect(wl.isHeld()).toBe(false);
  });

  it('drops its reference when the system releases the lock externally', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();
    expect(wl.isHeld()).toBe(true);

    api.sentinel.simulateSystemRelease(); // OS releases it (low battery, etc.)
    expect(wl.isHeld()).toBe(false);
  });

  it('re-acquires on page visible when running and lock was externally released', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();                         // request #1
    const firstSentinel = api.sentinel;
    firstSentinel.simulateSystemRelease();      // OS drops it
    expect(wl.isHeld()).toBe(false);

    await wl.onPageVisible(true, true);         // request #2
    expect(api.requestCount).toBe(2);
    expect(wl.isHeld()).toBe(true);
    expect(api.sentinel.released).toBe(false);
  });

  it('does not re-acquire on page visible when race is NOT running', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.onPageVisible(true, false); // race stopped
    expect(api.requestCount).toBe(0);
    expect(wl.isHeld()).toBe(false);
  });

  it('does not acquire while page is hidden (visible=false)', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.onPageVisible(false, true); // hidden → no-op
    expect(api.requestCount).toBe(0);
    expect(wl.isHeld()).toBe(false);
  });

  it('does not re-acquire if a lock is already held when page becomes visible', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();
    expect(api.requestCount).toBe(1);

    await wl.onPageVisible(true, true); // already held → no second request
    expect(api.requestCount).toBe(1);
  });

  it('degrades silently when the API rejects the request (not-allowed, low battery)', async () => {
    const api = makeFakeApi();
    api.rejectNext = true;
    const wl = new WakeLockManager(api);

    // Should not throw
    await wl.acquire();
    expect(wl.isHeld()).toBe(false);
  });

  it('degrades silently when no API is available (null)', async () => {
    const wl = new WakeLockManager(null);

    await wl.acquire();               // no-op
    expect(wl.isHeld()).toBe(false);
    await wl.release();               // no-op
    await wl.onPageVisible(true, true); // no-op
  });

  it('allows re-acquire after explicit release, then release again (INICIAR → PARAR → INICIAR → REINICIAR)', async () => {
    const api = makeFakeApi();
    const wl = new WakeLockManager(api);

    await wl.acquire();   // INICIAR (#1)
    await wl.release();   // PARAR
    expect(wl.isHeld()).toBe(false);

    await wl.acquire();   // INICIAR again (#2)
    expect(api.requestCount).toBe(2);
    expect(wl.isHeld()).toBe(true);

    await wl.release();   // REINICIAR
    expect(wl.isHeld()).toBe(false);
  });
});
