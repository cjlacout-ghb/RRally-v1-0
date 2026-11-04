import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RaceSessionBridge } from './raceBridge';
import type { GpsReader, GpsReading, GpsStatus } from './gpsReader';
import type { Clocks } from './stopwatch';
import type { WakeLockApi, WakeLockSentinel } from './wakeLock';
import {
  CARRERA_STOPWATCH_KEY,
  readCarreraStopwatchState,
  writeCarreraStopwatchState,
  type StoredCarreraStopwatchState,
} from '../storage';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

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

class MockWakeLockApi implements WakeLockApi {
  requestCount = 0;
  sentinel: WakeLockSentinel | null = null;
  private releaseListeners = new Set<() => void>();

  async request(): Promise<WakeLockSentinel> {
    this.requestCount++;
    const self = this;
    this.sentinel = {
      released: false,
      async release() {
        this.released = true;
        self.sentinel = null;
        for (const l of self.releaseListeners) l();
      },
      addEventListener(type: string, listener: () => void) {
        if (type === 'release') self.releaseListeners.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        if (type === 'release') self.releaseListeners.delete(listener);
      },
    };
    return this.sentinel;
  }
}

describe('Carrera stopwatch persistence and restore', () => {
  let mockStorage: MockStorage;
  let mockWallClock: number;
  let mockMonotonic: number;

  const mockClocks: Clocks = {
    nowWallClock: () => mockWallClock,
    nowMonotonic: () => mockMonotonic,
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    mockWallClock = 1700000000000;
    mockMonotonic = 10000;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes to localStorage only on INICIAR, PARAR, and clears on REINICIAR (never on tick)', () => {
    const reader = new MockGpsReader();
    const wakeLockApi = new MockWakeLockApi();
    const bridge = new RaceSessionBridge({
      reader,
      wakeLockApi,
      clocks: mockClocks,
      persistCarreraStopwatch: true,
      assignedSpeedKmH: 50,
    });

    // Fresh start: nothing in storage
    expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();

    // 1. INICIAR writes running state
    bridge.start();
    const runningSaved = readCarreraStopwatchState(mockWallClock);
    expect(runningSaved).toEqual({
      version: 1,
      startWallClock: 1700000000000,
      running: true,
      accumulatedMs: 0,
    });

    // Ticks do NOT write to storage
    const setItemSpy = vi.spyOn(mockStorage, 'setItem');
    mockWallClock += 5000;
    mockMonotonic += 5000;
    bridge.tick();
    bridge.tick();
    expect(setItemSpy).not.toHaveBeenCalled();

    // 2. PARAR writes stopped state with accumulated elapsed time
    bridge.stop();
    const stoppedSaved = readCarreraStopwatchState(mockWallClock);
    expect(stoppedSaved).toEqual({
      version: 1,
      startWallClock: null,
      running: false,
      accumulatedMs: 5000,
    });

    // 3. REINICIAR clears storage
    bridge.reset();
    expect(readCarreraStopwatchState(mockWallClock)).toBeNull();
    expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();
  });

  it('does NOT write or read Carrera stopwatch state when persistCarreraStopwatch is false (Hoja de ruta mode)', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({
      reader,
      clocks: mockClocks,
      persistCarreraStopwatch: false,
    });

    bridge.start();
    expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();

    bridge.stop();
    expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();

    bridge.reset();
    expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();
  });

  it('restores running stopwatch against current clock, restarts GPS and WakeLock, and forces no-data until REINICIAR', () => {
    // Save running state: started 10 seconds ago
    const savedState: StoredCarreraStopwatchState = {
      version: 1,
      startWallClock: 1700000000000,
      running: true,
      accumulatedMs: 2000,
    };
    writeCarreraStopwatchState(savedState);

    // Current time is 12 seconds later (10 seconds since startWallClock)
    mockWallClock = 1700000010000;
    mockMonotonic = 20000;

    const reader = new MockGpsReader();
    const wakeLockApi = new MockWakeLockApi();
    const bridge = new RaceSessionBridge({
      reader,
      wakeLockApi,
      clocks: mockClocks,
      persistCarreraStopwatch: true,
      assignedSpeedKmH: 50,
    });

    // 1. Stopwatch rebuilt against wall clock: 2000 prior + 10000 elapsed = 12000 ms
    expect(bridge.stopwatch.isRunning()).toBe(true);
    expect(bridge.stopwatch.getElapsedMs()).toBe(12000);

    // 2. GPS reader restarted and wake lock acquired
    expect(reader.startCount).toBe(1);
    expect(reader.getStatus()).toBe('active');
    expect(wakeLockApi.requestCount).toBe(1);

    // 3. Telemetry in no-data state
    const initialSnap = bridge.getSnapshot();
    expect(initialSnap.isRunning).toBe(true);
    expect(initialSnap.gpsStatusText).toBe('BUSCANDO GPS…');
    expect(initialSnap.speed).toBeNull(); // "--,-" before first reading
    expect(initialSnap.distance).toBeNull(); // "--,-- KM"
    expect(initialSnap.averageSpeed).toBeNull(); // "--,- KM/H"
    expect(initialSnap.deltaSeconds).toBeNull();
    expect(initialSnap.deltaState).toBe('no-data'); // "SIN DATOS"

    // 4. GPS reading arrives: speed updates, but distance/delta remain no-data
    reader.emitReading({
      timestamp: mockWallClock,
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 5,
      speed: 13.8889, // ~50 km/h
    });

    const activeSnap = bridge.getSnapshot();
    expect(activeSnap.speed).toBeCloseTo(50, 0);
    expect(activeSnap.distance).toBeNull();
    expect(activeSnap.averageSpeed).toBeNull();
    expect(activeSnap.deltaSeconds).toBeNull();
    expect(activeSnap.deltaState).toBe('no-data');

    // 5. User pauses (PARAR): time is frozen, GPS reader stops, wake lock released, distance/delta still no-data
    bridge.stop();
    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(reader.getStatus()).toBe('idle');

    const pausedSnap = bridge.getSnapshot();
    expect(pausedSnap.distance).toBeNull();
    expect(pausedSnap.averageSpeed).toBeNull();
    expect(pausedSnap.deltaSeconds).toBeNull();
    expect(pausedSnap.deltaState).toBe('no-data');

    // 6. User resumes (INICIAR): still suppressed until REINICIAR
    bridge.start();
    const resumedSnap = bridge.getSnapshot();
    expect(resumedSnap.distance).toBeNull();
    expect(resumedSnap.averageSpeed).toBeNull();
    expect(resumedSnap.deltaSeconds).toBeNull();
    expect(resumedSnap.deltaState).toBe('no-data');

    // 7. User resets (REINICIAR): clears storage and restores normal telemetry calculation
    bridge.reset();
    expect(readCarreraStopwatchState(mockWallClock)).toBeNull();

    const resetSnap = bridge.getSnapshot();
    expect(resetSnap.isRunning).toBe(false);
    expect(resetSnap.distance).toBe(0);
    expect(resetSnap.isRestored).toBe(false);

    // Starting a new race now tracks distance and delta normally
    bridge.start();
    reader.emitReading({
      timestamp: mockWallClock,
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 5,
      speed: 13.8889,
    });
    reader.emitReading({
      timestamp: mockWallClock + 1000,
      latitude: -34.6040,
      longitude: -58.3816,
      accuracy: 5,
      speed: 13.8889,
    });

    const freshRaceSnap = bridge.getSnapshot();
    expect(freshRaceSnap.distance).not.toBeNull();
    expect(freshRaceSnap.distance).toBeGreaterThan(0);
  });

  it('restores stopped stopwatch frozen at accumulated time, without starting reader or wake lock', () => {
    const savedState: StoredCarreraStopwatchState = {
      version: 1,
      startWallClock: null,
      running: false,
      accumulatedMs: 45000,
    };
    writeCarreraStopwatchState(savedState);

    const reader = new MockGpsReader();
    const wakeLockApi = new MockWakeLockApi();
    const bridge = new RaceSessionBridge({
      reader,
      wakeLockApi,
      clocks: mockClocks,
      persistCarreraStopwatch: true,
      assignedSpeedKmH: 50,
    });

    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(bridge.stopwatch.getElapsedMs()).toBe(45000);
    expect(reader.startCount).toBe(0);
    expect(wakeLockApi.requestCount).toBe(0);

    const snap = bridge.getSnapshot();
    expect(snap.isRunning).toBe(false);
    expect(snap.distance).toBeNull();
    expect(snap.averageSpeed).toBeNull();
    expect(snap.deltaSeconds).toBeNull();
    expect(snap.deltaState).toBe('no-data');

    // Resetting clears state and restores normal behavior
    bridge.reset();
    expect(bridge.stopwatch.getElapsedMs()).toBe(0);
    expect(bridge.getSnapshot().distance).toBe(0);
  });

  it('defensively starts clean if stored state has future start timestamp or invalid content', () => {
    // Future timestamp
    mockStorage.setItem(
      CARRERA_STOPWATCH_KEY,
      JSON.stringify({
        version: 1,
        startWallClock: mockWallClock + 50000,
        running: true,
        accumulatedMs: 0,
      })
    );

    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({
      reader,
      clocks: mockClocks,
      persistCarreraStopwatch: true,
    });

    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(bridge.stopwatch.getElapsedMs()).toBe(0);
    expect(bridge.getSnapshot().isRestored).toBeFalsy();
    expect(reader.startCount).toBe(0);
  });
});
