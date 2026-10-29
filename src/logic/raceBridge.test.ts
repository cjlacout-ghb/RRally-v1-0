import { describe, it, expect, vi } from 'vitest';
import { RaceSessionBridge } from './raceBridge';
import { BrowserGpsReader, type GpsReader, type GpsReading, type GpsStatus } from './gpsReader';
import type { Clocks } from './stopwatch';
import { destinationCoordinate } from './geo';
import { GpsSimulator } from './gpsSimulator';
import { isSimulatorRequested, parseSimulatorConfig } from './simulatorDetector';
import type { WakeLockApi, WakeLockSentinel } from './wakeLock';

class MockGpsReader implements GpsReader {
  status: GpsStatus = 'idle';
  startCount = 0;
  stopCount = 0;
  private readingListeners = new Set<(reading: GpsReading) => void>();
  private statusListeners = new Set<(status: GpsStatus) => void>();

  start(): void {
    this.startCount++;
    this.status = 'active';
    for (const l of this.statusListeners) l(this.status);
  }

  stop(): void {
    this.stopCount++;
    this.status = 'idle';
    for (const l of this.statusListeners) l(this.status);
  }

  getStatus(): GpsStatus {
    return this.status;
  }

  onReading(cb: (r: GpsReading) => void): () => void {
    this.readingListeners.add(cb);
    return () => this.readingListeners.delete(cb);
  }

  onStatusChange(cb: (s: GpsStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  emitReading(r: GpsReading): void {
    for (const l of this.readingListeners) l(r);
  }

  emitStatus(s: GpsStatus): void {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }
}

describe('RaceSessionBridge (Phase 3C-1 Lifecycle & Single Start Instant)', () => {
  let mockWallClock = 100000;
  let mockMonotonic = 5000;

  const mockClocks: Clocks = {
    nowMonotonic: () => mockMonotonic,
    nowWallClock: () => mockWallClock,
  };

  it('never starts the GPS reader at construct/load time (idle status)', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks });

    expect(reader.startCount).toBe(0);
    expect(reader.getStatus()).toBe('idle');

    const snap = bridge.getSnapshot();
    expect(snap.isRunning).toBe(false);
    expect(snap.gpsStatus).toBe('idle');
    expect(snap.gpsStatusText).toBe('');
  });

  it('starts the reader on the first INICIAR (user gesture)', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks });

    expect(reader.startCount).toBe(0);

    bridge.start();

    expect(reader.startCount).toBe(1);
    expect(reader.getStatus()).toBe('active');
    expect(bridge.getSnapshot().isRunning).toBe(true);
  });

  it('shares the exact same start instant between stopwatch and tracker', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, assignedSpeedKmH: 60 });

    const explicitStart = 12345678000;
    bridge.start(explicitStart);

    // Stopwatch elapsed at start should be 0
    expect(bridge.stopwatch.getElapsedMs()).toBe(0);
    expect(bridge.tracker.isRunning()).toBe(true);

    // Reading arriving at explicitStart + 50000 (50s elapsed)
    const dest = destinationCoordinate(0, 0, 1000, 0); // 1 km in 50s at 60 km/h (ideal 60s -> delta +10s)
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 20,
      timestamp: explicitStart,
    });
    reader.emitReading({
      latitude: dest.latitude,
      longitude: dest.longitude,
      accuracy: 5,
      speed: 20,
      timestamp: explicitStart + 50000,
    });

    const snap = bridge.getSnapshot();
    // Delta should be exactly +10.0s (60s ideal - 50s actual from the shared start instant)
    expect(snap.deltaSeconds).toBeCloseTo(10.0, 1);
  });

  it('PARAR stops the GPS reader and clears the GPS status line', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks });

    bridge.start();
    expect(reader.getStatus()).toBe('active');
    expect(reader.stopCount).toBe(0);

    bridge.stop();

    // Stopwatch is paused, and reader is stopped
    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(reader.stopCount).toBe(1);
    expect(reader.getStatus()).toBe('idle');
    expect(bridge.getSnapshot().gpsStatusText).toBe('');
    expect(bridge.getSnapshot().speed).toBeNull();
  });

  it('REINICIAR resets everything, stops the reader, and restores idle status', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, assignedSpeedKmH: 60 });

    bridge.start();
    bridge.adjustDistance(1);
    expect(reader.stopCount).toBe(0);

    bridge.reset();

    expect(reader.stopCount).toBe(1);
    expect(reader.getStatus()).toBe('idle');
    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(bridge.stopwatch.getElapsedMs()).toBe(0);

    const snap = bridge.getSnapshot();
    expect(snap.distance).toBe(0);
    expect(snap.deltaSeconds).toBeNull();
    expect(snap.averageSpeed).toBeNull();
    expect(snap.gpsStatus).toBe('idle');
    expect(snap.gpsStatusText).toBe('');
  });

  it('re-tries starting the reader if INICIAR is called while in denied, unavailable, or timeout', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks });

    bridge.start();
    expect(reader.startCount).toBe(1);

    // Simulate GPS error
    reader.emitStatus('denied');
    expect(bridge.getSnapshot().gpsStatusText).toBe('GPS SIN PERMISO: activalo en Ajustes de iOS');

    // User taps INICIAR again (re-try)
    bridge.start();
    expect(reader.startCount).toBe(2);

    // Simulate timeout error
    reader.emitStatus('timeout');
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');

    // User taps INICIAR again
    bridge.start();
    expect(reader.startCount).toBe(3);

    // Simulate unavailable error
    reader.emitStatus('unavailable');
    expect(bridge.getSnapshot().gpsStatusText).toBe('GPS NO DISPONIBLE');

    // User taps INICIAR again
    bridge.start();
    expect(reader.startCount).toBe(4);
  });

  it('retains running race state across multiple snapshot queries and navigation simulations', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, assignedSpeedKmH: 60 });

    bridge.start(100000);

    // First reading
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 20,
      timestamp: 100000,
    });

    // Advance time and second reading
    mockMonotonic += 10000;
    mockWallClock += 10000;
    const dest = destinationCoordinate(0, 0, 200, 0);
    reader.emitReading({
      latitude: dest.latitude,
      longitude: dest.longitude,
      accuracy: 5,
      speed: 20,
      timestamp: 110000,
    });

    // Simulate tab switch: get snapshot repeatedly
    const snap1 = bridge.getSnapshot();
    const snap2 = bridge.getSnapshot();

    expect(snap1.isRunning).toBe(true);
    expect(snap1.distance).toBeCloseTo(0.2, 2);
    expect(snap2.distance).toBe(snap1.distance);
    expect(snap2.deltaSeconds).toBe(snap1.deltaSeconds);
  });

  it('integrates with GpsSimulator over 30s: speed ≈ 60 km/h, distance < 0.5 km, delta positive & growing, status empty', () => {
    let fakeTime = 1772000000000;
    const fakeClocks: Clocks = {
      nowMonotonic: () => fakeTime,
      nowWallClock: () => fakeTime,
    };

    const sim = new GpsSimulator({
      speedKmH: 60,
      clocks: fakeClocks,
      seed: 42,
    });

    const bridge = new RaceSessionBridge({
      reader: sim,
      clocks: fakeClocks,
      assignedSpeedKmH: 50,
    });

    // Before INICIAR: reader is idle, status text is empty
    expect(bridge.getSnapshot().gpsStatus).toBe('idle');
    expect(bridge.getSnapshot().gpsStatusText).toBe('');

    // Call INICIAR
    bridge.start();

    // Immediately after INICIAR before fixes arrive: status is active, text is "BUSCANDO GPS…"
    expect(bridge.getSnapshot().isRunning).toBe(true);
    expect(bridge.getSnapshot().gpsStatus).toBe('active');
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');

    let prevDelta: number | null = null;

    // Advance clock by 30 seconds at 1-second steps
    for (let sec = 1; sec <= 30; sec++) {
      fakeTime += 1000;
      sim.tick();
      bridge.tick();

      const snap = bridge.getSnapshot();
      if (snap.deltaSeconds !== null && prevDelta !== null) {
        // Delta should be positive and growing roughly +0.2s each second
        expect(snap.deltaSeconds).toBeGreaterThan(prevDelta);
      }
      if (snap.deltaSeconds !== null) {
        prevDelta = snap.deltaSeconds;
      }
    }

    const finalSnap = bridge.getSnapshot();

    // 1. Instantaneous speed is about 60 km/h
    expect(finalSnap.speed).toBeCloseTo(60, 0);

    // 2. Displayed distance is slightly under 0.5 km (the first reading only sets the reference)
    // 29 intervals * (60 / 3.6 m/s * 1s) = 29 * 16.667m = 483.33m = 0.483 km
    expect(finalSnap.distance).toBeGreaterThan(0.47);
    expect(finalSnap.distance).toBeLessThan(0.50);

    // 3. Delta is positive and growing (roughly +0.2 s per elapsed second, minus the initial reference loss)
    // 483.33m at 50 km/h is 34.8s. Actual elapsed time is 30s. Delta ~ +4.8s.
    expect(finalSnap.deltaSeconds).toBeGreaterThan(4.0);
    expect(finalSnap.deltaSeconds).toBeLessThan(6.0);
    expect(finalSnap.deltaState).toBe('ahead');

    // 4. GPS status text is empty
    expect(finalSnap.gpsStatusText).toBe('');
  });

  it('confirms without ?sim real reader path is used, and with ?sim real geolocation is not called', () => {
    const watchPositionMock = vi.fn();
    const clearWatchMock = vi.fn();

    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
    });

    try {
      // 1. Without ?sim in URL
      const noSimQuery = '?speed=50';
      expect(isSimulatorRequested(noSimQuery)).toBe(false);

      // Reader path without ?sim: BrowserGpsReader
      const realReader = new BrowserGpsReader();
      const realBridge = new RaceSessionBridge({
        reader: realReader,
        assignedSpeedKmH: 50,
      });

      expect(watchPositionMock).not.toHaveBeenCalled();

      // Calling INICIAR triggers navigator.geolocation.watchPosition
      realBridge.start();
      expect(watchPositionMock).toHaveBeenCalledTimes(1);

      // 2. With ?sim=1 in URL
      watchPositionMock.mockClear();
      const simQuery = '?sim=1&speed=60&seed=42';
      expect(isSimulatorRequested(simQuery)).toBe(true);
      const config = parseSimulatorConfig(simQuery);

      // Simulator reader path
      const simReader = new GpsSimulator({
        speedKmH: config.speedKmH,
        seed: config.seed,
      });
      const simBridge = new RaceSessionBridge({
        reader: simReader,
        assignedSpeedKmH: 50,
      });

      expect(watchPositionMock).not.toHaveBeenCalled();

      // Calling INICIAR starts the simulator, NEVER touching navigator.geolocation
      simBridge.start();
      expect(watchPositionMock).not.toHaveBeenCalled();
      expect(simBridge.getSnapshot().gpsStatus).toBe('active');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── Phase 3C-2 tests ───────────────────────────────────────────────────────

/** Minimal fake wake lock sentinel */
function makeFakeSentinel(): WakeLockSentinel & { simulateSystemRelease: () => void } {
  let released = false;
  const handlers = new Set<() => void>();
  return {
    get released() { return released; },
    async release() { released = true; for (const h of handlers) h(); },
    addEventListener(_t: 'release', h: () => void) { handlers.add(h); },
    removeEventListener(_t: 'release', h: () => void) { handlers.delete(h); },
    simulateSystemRelease() { released = true; for (const h of handlers) h(); },
  };
}

function makeFakeWakeLockApi() {
  let currentSentinel: ReturnType<typeof makeFakeSentinel> = makeFakeSentinel();
  const api = {
    get sentinel(): ReturnType<typeof makeFakeSentinel> { return currentSentinel; },
    requestCount: 0,
    rejectNext: false,
    async request(_t: 'screen'): Promise<WakeLockSentinel> {
      api.requestCount++;
      if (api.rejectNext) { api.rejectNext = false; throw new DOMException('denied', 'NotAllowedError'); }
      currentSentinel = makeFakeSentinel();
      return currentSentinel;
    },
  };
  return api;
}

describe('RaceSessionBridge — Phase 3C-2: wake lock integration', () => {
  let mockWallClock = 200000;
  let mockMonotonic = 10000;
  const mockClocks: Clocks = {
    nowMonotonic: () => mockMonotonic,
    nowWallClock: () => mockWallClock,
  };

  /** Flush several microtask queues to let fire-and-forget async chains complete. */
  async function flushAsync(ticks = 5): Promise<void> {
    for (let i = 0; i < ticks; i++) await Promise.resolve();
  }

  it('acquires wake lock on INICIAR', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    bridge.start();
    await flushAsync();

    expect(api.requestCount).toBe(1);
  });

  it('releases wake lock on PARAR', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    bridge.start();
    await flushAsync();

    const heldSentinel = api.sentinel;
    bridge.stop();
    await flushAsync();

    expect(heldSentinel.released).toBe(true);
  });

  it('releases wake lock on REINICIAR', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    bridge.start();
    await flushAsync();

    const heldSentinel = api.sentinel;
    bridge.reset();
    await flushAsync();

    expect(heldSentinel.released).toBe(true);
  });

  it('re-acquires wake lock on page visible when running (after system release)', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    bridge.start();
    await flushAsync();
    expect(api.requestCount).toBe(1);

    // Capture sentinel then simulate system releasing it (low battery, etc.)
    const firstSentinel = api.sentinel;
    firstSentinel.simulateSystemRelease();

    // Page becomes visible again, race still running
    bridge.onVisibilityChange(true);
    await flushAsync();

    expect(api.requestCount).toBe(2);
  });

  it('does NOT re-acquire wake lock on page visible when race is stopped', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    bridge.start();
    await flushAsync();
    bridge.stop();
    await flushAsync();

    bridge.onVisibilityChange(true);
    await flushAsync();

    // The lock was released on stop; page becoming visible should not re-acquire
    expect(api.requestCount).toBe(1); // only the initial INICIAR
  });

  it('does NOT acquire when the API rejects (degrades silently)', async () => {
    const reader = new MockGpsReader();
    const api = makeFakeWakeLockApi();
    api.rejectNext = true;
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: api });

    // Must not throw
    bridge.start();
    await flushAsync();

    expect(bridge.getSnapshot().isRunning).toBe(true);
  });

  it('passes null wakeLockApi to disable entirely (used in most tests)', async () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: null });

    bridge.start();
    await flushAsync();

    expect(bridge.getSnapshot().isRunning).toBe(true);
  });
});

describe('RaceSessionBridge — Phase 3C-2: foreground recovery', () => {
  it('refreshes snapshot on page visible (notifyListeners called)', () => {
    let wallClock = 300000;
    let mono = 15000;
    const clocks: Clocks = {
      nowMonotonic: () => mono,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    let snapshots = 0;
    bridge.subscribe(() => { snapshots++; });

    bridge.onVisibilityChange(true);
    expect(snapshots).toBeGreaterThan(0);
  });

  it('restarts a stalled GPS reader (timeout) on page visible without re-requesting permission when denied', () => {
    let wallClock = 300000;
    const clocks: Clocks = {
      nowMonotonic: () => wallClock,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();
    expect(reader.startCount).toBe(1);

    // Reader goes into timeout
    reader.emitStatus('timeout');

    // Page becomes visible
    bridge.onVisibilityChange(true);
    expect(reader.startCount).toBe(2);
  });

  it('restarts a stalled GPS reader (unavailable) on page visible', () => {
    let wallClock = 300000;
    const clocks: Clocks = {
      nowMonotonic: () => wallClock,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();
    reader.emitStatus('unavailable');

    bridge.onVisibilityChange(true);
    expect(reader.startCount).toBe(2);
  });

  it('does NOT restart the GPS reader when status is denied on page visible', () => {
    let wallClock = 300000;
    const clocks: Clocks = {
      nowMonotonic: () => wallClock,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();
    reader.emitStatus('denied');

    bridge.onVisibilityChange(true);
    // No restart — startCount stays at 1
    expect(reader.startCount).toBe(1);
  });

  it('does NOT restart an idle reader on page visible (no session started)', () => {
    let wallClock = 300000;
    const clocks: Clocks = {
      nowMonotonic: () => wallClock,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    // No bridge.start() called
    bridge.onVisibilityChange(true);
    expect(reader.startCount).toBe(0);
  });

  it('does nothing on page hidden (onVisibilityChange(false))', () => {
    let wallClock = 300000;
    const clocks: Clocks = {
      nowMonotonic: () => wallClock,
      nowWallClock: () => wallClock,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();

    let snapshots = 0;
    bridge.subscribe(() => { snapshots++; });

    bridge.onVisibilityChange(false);
    expect(snapshots).toBe(0);
    expect(reader.startCount).toBe(1); // unchanged
  });
});

describe('RaceSessionBridge — Phase 3C-2: stopwatch/tracker agreement after monotonic stall', () => {
  it('corrects stopwatch elapsed after monotonic clock stalls during page hide, tracker elapsed matches', () => {
    let wallClock = 1700000000000;
    let mono = 0;

    const clocks: Clocks = {
      nowMonotonic: () => mono,
      nowWallClock: () => wallClock,
    };

    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({
      reader,
      clocks,
      assignedSpeedKmH: 50,
      wakeLockApi: null,
    });

    // Start the race at t=0
    bridge.start();
    expect(bridge.stopwatch.getElapsedMs()).toBe(0);

    // Advance 10 seconds normally
    mono += 10000;
    wallClock += 10000;
    expect(bridge.stopwatch.getElapsedMs()).toBe(10000);

    // Page hides; screen locks for 30 seconds.
    // On iOS, monotonic clock may STOP advancing. Wall clock advances normally.
    // Monotonic stays at 10000; wall clock reaches 40000ms elapsed from start.
    wallClock += 30000;
    // mono stays at 10000 (stalled)

    // Page becomes visible — this triggers wall-clock correction
    bridge.onVisibilityChange(true);

    // Stopwatch must now reflect wall-clock elapsed (40s), not monotonic (10s)
    const elapsed = bridge.stopwatch.getElapsedMs();
    expect(elapsed).toBeGreaterThanOrEqual(39900);
    expect(elapsed).toBeLessThanOrEqual(40100);

    // Monotonic continues from its current value after correction
    mono += 5000;
    wallClock += 5000;
    const elapsed2 = bridge.stopwatch.getElapsedMs();
    expect(elapsed2).toBeGreaterThanOrEqual(44900);
    expect(elapsed2).toBeLessThanOrEqual(45100);
  });
});

describe('RaceSessionBridge — Phase 3D-1: GPS stationary behavior & PARAR lifecycle', () => {
  let mockWallClock = 500000;
  let mockMonotonic = 50000;
  const mockClocks: Clocks = {
    nowMonotonic: () => mockMonotonic,
    nowWallClock: () => mockWallClock,
  };

  it('PARAR stops the reader and empties status line; INICIAR restarts the reader', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: null });

    // Initial INICIAR
    bridge.start();
    expect(reader.getStatus()).toBe('active');
    expect(reader.startCount).toBe(1);
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');

    // First valid reading arrives
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 15,
      timestamp: mockWallClock,
    });
    expect(bridge.getSnapshot().gpsStatusText).toBe('');

    // PARAR
    bridge.stop();
    expect(reader.stopCount).toBe(1);
    expect(reader.getStatus()).toBe('idle');
    expect(bridge.getSnapshot().gpsStatusText).toBe('');
    expect(bridge.getSnapshot().speed).toBeNull(); // "--,-"

    // Resume (INICIAR)
    bridge.start();
    expect(reader.startCount).toBe(2);
    expect(reader.getStatus()).toBe('active');
    // Memory reset: shows "BUSCANDO GPS…" until first reading arrives after resume
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');
    expect(bridge.getSnapshot().speed).toBeNull();

    // First valid reading arrives after resume
    reader.emitReading({
      latitude: 0.001,
      longitude: 0,
      accuracy: 5,
      speed: 15,
      timestamp: mockWallClock + 1000,
    });
    expect(bridge.getSnapshot().gpsStatusText).toBe('');
    expect(bridge.getSnapshot().speed).toBeGreaterThan(0);
  });

  it('long gap after at least one valid reading while running does not show "BUSCANDO GPS…" and speed reads 0,0', () => {
    let wall = 600000;
    const clocks: Clocks = {
      nowMonotonic: () => wall,
      nowWallClock: () => wall,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');
    expect(bridge.getSnapshot().speed).toBeNull();

    // Emit valid reading
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 10,
      timestamp: wall,
    });
    expect(bridge.getSnapshot().gpsStatusText).toBe('');
    expect(bridge.getSnapshot().speed).toBeCloseTo(36.0, 1);

    // Advance time by 6 seconds (> 5000ms stale timeout) with no new readings
    wall += 6000;
    bridge.tick();

    const snap = bridge.getSnapshot();
    // Line stays empty (not "BUSCANDO GPS…")
    expect(snap.gpsStatusText).toBe('');
    expect(snap.gpsStatusKind).toBe('empty');
    // Speed goes to 0,0 km/h (0) instead of null ("--,-")
    expect(snap.speed).toBe(0);
  });

  it('stationary jitter reading counts as valid and preserves empty status line', () => {
    let wall = 700000;
    const clocks: Clocks = {
      nowMonotonic: () => wall,
      nowWallClock: () => wall,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks, wakeLockApi: null });

    bridge.start();

    // First fix
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 0,
      timestamp: wall,
    });
    expect(bridge.getSnapshot().gpsStatusText).toBe('');

    // Jitter fix (< 2.0m movement at 0 speed)
    wall += 2000;
    reader.emitReading({
      latitude: 0.000005, // ~0.55m
      longitude: 0,
      accuracy: 5,
      speed: 0,
      timestamp: wall,
    });

    const snap = bridge.getSnapshot();
    expect(snap.gpsStatusText).toBe('');
    expect(snap.gpsStatusKind).toBe('empty');
  });

  it('timeout, denied, and unavailable states behave correctly', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks, wakeLockApi: null });

    bridge.start();

    // Timeout shows BUSCANDO GPS…
    reader.emitStatus('timeout');
    expect(bridge.getSnapshot().gpsStatusText).toBe('BUSCANDO GPS…');
    expect(bridge.getSnapshot().gpsStatusKind).toBe('searching');

    // Denied shows permission guidance
    reader.emitStatus('denied');
    expect(bridge.getSnapshot().gpsStatusText).toBe('GPS SIN PERMISO: activalo en Ajustes de iOS');
    expect(bridge.getSnapshot().gpsStatusKind).toBe('action-needed');

    // Unavailable shows unavailable
    reader.emitStatus('unavailable');
    expect(bridge.getSnapshot().gpsStatusText).toBe('GPS NO DISPONIBLE');
    expect(bridge.getSnapshot().gpsStatusKind).toBe('action-needed');
  });

  it('Phase 3D-2: delta drifts with clock in snapshot during stationary stale gap and tick()', () => {
    let wall = 800000;
    let mono = 80000;
    const clocks: Clocks = {
      nowMonotonic: () => mono,
      nowWallClock: () => wall,
    };
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({
      reader,
      clocks,
      assignedSpeedKmH: 60,
      wakeLockApi: null,
    });

    bridge.start();

    // First reading at 0s elapsed
    reader.emitReading({
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      speed: 20,
      timestamp: wall,
    });

    // 50s later, covers 1.0 km -> ideal 60s, actual 50s -> delta +10.0s
    wall += 50000;
    mono += 50000;
    const dest = destinationCoordinate(0, 0, 1000, 0);
    reader.emitReading({
      latitude: dest.latitude,
      longitude: dest.longitude,
      accuracy: 5,
      speed: 20,
      timestamp: wall,
    });

    expect(bridge.getSnapshot().deltaSeconds).toBeCloseTo(10.0, 1);

    // Car stops. 10s elapse with no GPS readings (wall advances to +60s from start)
    wall += 10000;
    mono += 10000;
    bridge.tick();

    // Now elapsed is 60s. Last reading is 10s old (> 5s stale threshold).
    // Ideal time: 60s. Actual elapsed: 60s.
    // Delta should drift from +10.0s to 0.0s (EN TIEMPO)
    const snap1 = bridge.getSnapshot();
    expect(snap1.deltaSeconds).toBeCloseTo(0.0, 1);
    expect(snap1.deltaState).toBe('neutral');

    // Another 10s elapse (wall advances to +70s from start)
    wall += 10000;
    mono += 10000;
    bridge.tick();

    // Elapsed: 70s. Ideal: 60s -> delta: -10.0s (ATRASADO)
    const snap2 = bridge.getSnapshot();
    expect(snap2.deltaSeconds).toBeCloseTo(-10.0, 1);
    expect(snap2.deltaState).toBe('behind');

    // PARAR freezes the delta
    bridge.stop();
    const frozenDelta = bridge.getSnapshot().deltaSeconds;

    // More time passes while stopped
    wall += 20000;
    mono += 20000;
    bridge.tick();
    expect(bridge.getSnapshot().deltaSeconds).toBe(frozenDelta);

    // REINICIAR resets delta to null
    bridge.reset();
    expect(bridge.getSnapshot().deltaSeconds).toBeNull();
    expect(bridge.getSnapshot().deltaState).toBe('no-data');
  });
});
