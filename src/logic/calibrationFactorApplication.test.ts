import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RallyTracker } from './rallyTracker';
import { RaceSessionBridge } from './raceBridge';
import type { GpsReader, GpsReading, GpsStatus } from './gpsReader';
import { destinationCoordinate } from './geo';
import { writeCorrectionFactor, resetCorrectionFactor, CORRECTION_FACTOR_KEY } from '../storage';
import { DEFAULT_CORRECTION_FACTOR } from './gpsConstants';

class MockGpsReader implements GpsReader {
  status: GpsStatus = 'idle';
  private readingListeners = new Set<(reading: GpsReading) => void>();
  private statusListeners = new Set<(status: GpsStatus) => void>();

  start(): void {
    this.status = 'active';
  }
  stop(): void {
    this.status = 'idle';
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
  emitReading(reading: GpsReading): void {
    for (const cb of this.readingListeners) {
      cb(reading);
    }
  }
}

class MockStorage implements Storage {
  private store = new Map<string, string>();
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

const createReading = (
  lat: number,
  lon: number,
  speedMps: number | null,
  timestamp: number
): GpsReading => ({
  latitude: lat,
  longitude: lon,
  accuracy: 5,
  speed: speedMps,
  timestamp,
});

describe('Factor application to Race & Telemetry', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('with factor = 1.0000, behavior is identical to uncalibrated tracking', () => {
    const tracker = new RallyTracker({
      correctionFactor: 1.0,
      assignedSpeedKmH: 60,
    });
    tracker.start(1000);

    const r1 = createReading(0, 0, 20, 1000);
    tracker.processReading(r1);

    // 1000m displacement in 60s
    const dest = destinationCoordinate(0, 0, 1000, 0);
    const r2 = createReading(dest.latitude, dest.longitude, 20, 61000);
    tracker.processReading(r2);

    expect(tracker.getRawDistanceKm()).toBeCloseTo(1.000, 3);
    expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.000, 3);

    // At 60 km/h assigned speed, 1 km takes 60 seconds. Elapsed = 60s -> delta = 0.0s
    const delta = tracker.getDeltaSeconds(60000, 61000);
    expect(delta).toBeCloseTo(0.0, 1);
  });

  it('scales displayed distance and delta with the correction factor', () => {
    // Factor: 1.0500 (car odometer reads 5% short, app scales up)
    const factor = 1.05;
    const tracker = new RallyTracker({
      correctionFactor: factor,
      assignedSpeedKmH: 60,
    });
    tracker.start(1000);

    const r1 = createReading(0, 0, 20, 1000);
    tracker.processReading(r1);

    // 1000m raw GPS displacement in 60s
    const dest = destinationCoordinate(0, 0, 1000, 0);
    const r2 = createReading(dest.latitude, dest.longitude, 20, 61000);
    tracker.processReading(r2);

    expect(tracker.getRawDistanceKm()).toBeCloseTo(1.000, 3);
    // Displayed distance = raw * factor = 1.000 * 1.05 = 1.050 km
    expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.050, 3);

    // At 60 km/h assigned speed: target time for 1.050 km is (1.050 / 60 * 3600) = 63.0 seconds
    // Elapsed time is 60.0 seconds
    // Delta = target - elapsed = 63 - 60 = +3.0 seconds (ahead)
    const delta = tracker.getDeltaSeconds(60000, 61000);
    expect(delta).toBeCloseTo(3.0, 1);
  });

  it('scales average speed with displayed distance', () => {
    const factor = 1.10; // +10%
    const tracker = new RallyTracker({
      correctionFactor: factor,
    });
    tracker.start(1000);

    const r1 = createReading(0, 0, 20, 1000);
    tracker.processReading(r1);

    // 1000m raw in 36 seconds
    const dest = destinationCoordinate(0, 0, 1000, 0);
    const r2 = createReading(dest.latitude, dest.longitude, 20, 37000);
    tracker.processReading(r2);

    // Displayed distance: 1.100 km over 36s (0.01 hours) = 110 km/h average speed
    const avgSpeed = tracker.getAverageSpeedKmH(36000);
    expect(avgSpeed).toBeCloseTo(110.0, 1);
  });

  it('manual adjustments are NOT multiplied by the correction factor', () => {
    const factor = 1.05;
    const tracker = new RallyTracker({
      correctionFactor: factor,
    });
    tracker.start(1000);

    const r1 = createReading(0, 0, 20, 1000);
    tracker.processReading(r1);

    const dest = destinationCoordinate(0, 0, 1000, 0);
    const r2 = createReading(dest.latitude, dest.longitude, 20, 61000);
    tracker.processReading(r2);

    expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.050, 4);

    // Press +1 (adds 10 meters = 0.010 km)
    tracker.adjustDistance(1);
    expect(tracker.getManualAdjustmentKm()).toBe(0.010);

    // Displayed distance must be: (raw * factor) + manual = 1.000 * 1.05 + 0.010 = 1.060 km
    // NOT (1.000 + 0.010) * 1.05 = 1.0605 km
    expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.060, 4);
  });

  describe('RaceSessionBridge & single source of truth integration', () => {
    it('initializes RallyTracker with factor from storage if not overridden', () => {
      writeCorrectionFactor(1.025);

      const reader = new MockGpsReader();
      const bridge = new RaceSessionBridge({
        reader,
        wakeLockApi: null,
      });

      expect(bridge.tracker.getCorrectionFactor()).toBe(1.025);
    });

    it('falls back to 1.0000 when storage is empty', () => {
      resetCorrectionFactor();

      const reader = new MockGpsReader();
      const bridge = new RaceSessionBridge({
        reader,
        wakeLockApi: null,
      });

      expect(bridge.tracker.getCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });

    it('refreshes factor from storage on next race start if factor was changed', () => {
      writeCorrectionFactor(1.01);
      const reader = new MockGpsReader();
      const bridge = new RaceSessionBridge({
        reader,
        wakeLockApi: null,
      });
      expect(bridge.tracker.getCorrectionFactor()).toBe(1.01);

      // Race is idle, storage changes to 1.04
      writeCorrectionFactor(1.04);

      // Race starts
      bridge.start();
      expect(bridge.tracker.getCorrectionFactor()).toBe(1.04);
    });

    it('exposes isCalibrationAllowed in bridge and snapshot (blocked while running)', () => {
      const reader = new MockGpsReader();
      const bridge = new RaceSessionBridge({
        reader,
        wakeLockApi: null,
      });

      // Initially idle -> allowed
      expect(bridge.isCalibrationAllowed()).toBe(true);
      expect(bridge.getSnapshot().isCalibrationAllowed).toBe(true);

      // Start race -> blocked
      bridge.start();
      expect(bridge.isCalibrationAllowed()).toBe(false);
      expect(bridge.getSnapshot().isCalibrationAllowed).toBe(false);

      // Stop race (PARAR) -> allowed again
      bridge.stop();
      expect(bridge.isCalibrationAllowed()).toBe(true);
      expect(bridge.getSnapshot().isCalibrationAllowed).toBe(true);

      // Reset race (REINICIAR) -> allowed
      bridge.reset();
      expect(bridge.isCalibrationAllowed()).toBe(true);
      expect(bridge.getSnapshot().isCalibrationAllowed).toBe(true);
    });
  });
});
