import { describe, it, expect, vi } from 'vitest';
import { RaceSessionBridge } from './raceBridge';
import { BrowserGpsReader, type GpsReader, type GpsReading, type GpsStatus } from './gpsReader';
import type { Clocks } from './stopwatch';
import { destinationCoordinate } from './geo';
import { GpsSimulator } from './gpsSimulator';
import { isSimulatorRequested, parseSimulatorConfig } from './simulatorDetector';

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

  it('PARAR keeps the GPS reader active', () => {
    const reader = new MockGpsReader();
    const bridge = new RaceSessionBridge({ reader, clocks: mockClocks });

    bridge.start();
    expect(reader.getStatus()).toBe('active');
    expect(reader.stopCount).toBe(0);

    bridge.stop();

    // Stopwatch is paused, but reader is NOT stopped
    expect(bridge.stopwatch.isRunning()).toBe(false);
    expect(reader.stopCount).toBe(0);
    expect(reader.getStatus()).toBe('active');
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
