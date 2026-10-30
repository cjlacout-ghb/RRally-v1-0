import { describe, it, expect, vi } from 'vitest';
import { CalibrationMeter } from './calibrationMeter';
import { RallyTracker } from './rallyTracker';
import type { GpsReader, GpsReading, GpsStatus } from './gpsReader';
import { destinationCoordinate } from './geo';

class MockGpsReader implements GpsReader {
  status: GpsStatus = 'idle';
  startCalls: number = 0;
  stopCalls: number = 0;
  private readingListeners = new Set<(reading: GpsReading) => void>();
  private statusListeners = new Set<(status: GpsStatus) => void>();

  start(): void {
    this.startCalls++;
    this.status = 'active';
    this.notifyStatus();
  }

  stop(): void {
    this.stopCalls++;
    this.status = 'idle';
    this.notifyStatus();
  }

  getStatus(): GpsStatus {
    return this.status;
  }

  onReading(callback: (reading: GpsReading) => void): () => void {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  onStatusChange(callback: (status: GpsStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  emitReading(reading: GpsReading): void {
    for (const listener of this.readingListeners) {
      listener(reading);
    }
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) {
      listener(this.status);
    }
  }
}

const createReading = (
  lat: number,
  lon: number,
  speedMps: number | null,
  timestamp: number,
  accuracy: number = 5
): GpsReading => ({
  latitude: lat,
  longitude: lon,
  accuracy,
  speed: speedMps,
  timestamp,
});

describe('CalibrationMeter', () => {
  describe('Lifecycle & distance accumulation', () => {
    it('starts in idle state with 0 km measured', () => {
      const meter = new CalibrationMeter();
      expect(meter.getState()).toBe('idle');
      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });

    it('ignores readings when in idle state', () => {
      const meter = new CalibrationMeter();
      const r1 = createReading(0, 0, 10, 1000);
      const r2 = createReading(0.01, 0, 10, 2000);

      meter.processReading(r1);
      meter.processReading(r2);

      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });

    it('start() begins measuring from 0 and accumulates distance from subsequent fixes', () => {
      const meter = new CalibrationMeter();
      meter.start();
      expect(meter.getState()).toBe('measuring');

      // First fix becomes reference (0 displacement)
      const r1 = createReading(0, 0, 20, 1000);
      meter.processReading(r1);
      expect(meter.getMeasuredDistanceKm()).toBe(0);

      // Move 20 meters in 1 second
      const dest = destinationCoordinate(0, 0, 20, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 2000);
      meter.processReading(r2);

      expect(meter.getMeasuredDistanceKm()).toBeCloseTo(0.020, 4);
    });

    it('stop() freezes distance and ignores subsequent readings', () => {
      const meter = new CalibrationMeter();
      meter.start();

      const r1 = createReading(0, 0, 20, 1000);
      meter.processReading(r1);

      const dest1 = destinationCoordinate(0, 0, 50, 0);
      const r2 = createReading(dest1.latitude, dest1.longitude, 20, 2000);
      meter.processReading(r2);

      const distAtStop = meter.getMeasuredDistanceKm();
      expect(distAtStop).toBeCloseTo(0.050, 4);

      meter.stop();
      expect(meter.getState()).toBe('stopped');

      // Further readings while stopped must be ignored
      const dest2 = destinationCoordinate(dest1.latitude, dest1.longitude, 100, 0);
      const r3 = createReading(dest2.latitude, dest2.longitude, 20, 3000);
      meter.processReading(r3);

      expect(meter.getMeasuredDistanceKm()).toBe(distAtStop);
    });

    it('a new start() resets distance to a clean zero', () => {
      const meter = new CalibrationMeter();
      meter.start();

      const r1 = createReading(0, 0, 20, 1000);
      meter.processReading(r1);
      const dest1 = destinationCoordinate(0, 0, 50, 0);
      const r2 = createReading(dest1.latitude, dest1.longitude, 20, 2000);
      meter.processReading(r2);
      expect(meter.getMeasuredDistanceKm()).toBeCloseTo(0.050, 4);

      meter.stop();

      // Restart
      meter.start();
      expect(meter.getState()).toBe('measuring');
      expect(meter.getMeasuredDistanceKm()).toBe(0);

      // First reading after restart sets new reference
      const rRestart1 = createReading(dest1.latitude, dest1.longitude, 20, 5000);
      meter.processReading(rRestart1);
      expect(meter.getMeasuredDistanceKm()).toBe(0);

      // Next reading moves 30m
      const dest2 = destinationCoordinate(dest1.latitude, dest1.longitude, 30, 0);
      const rRestart2 = createReading(dest2.latitude, dest2.longitude, 20, 6000);
      meter.processReading(rRestart2);
      expect(meter.getMeasuredDistanceKm()).toBeCloseTo(0.030, 4);
    });
  });

  describe('GpsReader lifecycle management', () => {
    it('starts reader on start() and stops reader on stop()', () => {
      const reader = new MockGpsReader();
      const meter = new CalibrationMeter({ reader });

      expect(reader.startCalls).toBe(0);
      expect(reader.stopCalls).toBe(0);
      expect(reader.getStatus()).toBe('idle');

      meter.start();
      expect(reader.startCalls).toBe(1);
      expect(reader.getStatus()).toBe('active');

      meter.stop();
      expect(reader.stopCalls).toBe(1);
      expect(reader.getStatus()).toBe('idle');
    });

    it('stops reader on reset()', () => {
      const reader = new MockGpsReader();
      const meter = new CalibrationMeter({ reader });

      meter.start();
      expect(reader.startCalls).toBe(1);

      meter.reset();
      expect(reader.stopCalls).toBe(1);
      expect(meter.getState()).toBe('idle');
    });

    it('receives readings automatically from reader subscription', () => {
      const reader = new MockGpsReader();
      const meter = new CalibrationMeter({ reader });

      meter.start();
      reader.emitReading(createReading(0, 0, 20, 1000));

      const dest = destinationCoordinate(0, 0, 40, 0);
      reader.emitReading(createReading(dest.latitude, dest.longitude, 20, 2000));

      expect(meter.getMeasuredDistanceKm()).toBeCloseTo(0.040, 4);
    });
  });

  describe('Filtering rules (shares DistanceAccumulator with race tracker)', () => {
    it('discards fixes with accuracy worse than 30 meters', () => {
      const meter = new CalibrationMeter();
      meter.start();

      meter.processReading(createReading(0, 0, 20, 1000, 5));
      const dest = destinationCoordinate(0, 0, 20, 0);
      // Inaccurate reading (35m)
      const inaccurate = createReading(dest.latitude, dest.longitude, 20, 2000, 35);
      const res = meter.processReading(inaccurate);

      expect(res.accepted).toBe(false);
      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });

    it('discards out-of-order timestamps', () => {
      const meter = new CalibrationMeter();
      meter.start();

      meter.processReading(createReading(0, 0, 20, 5000));
      const dest = destinationCoordinate(0, 0, 20, 0);
      const outOfOrder = createReading(dest.latitude, dest.longitude, 20, 4000);
      const res = meter.processReading(outOfOrder);

      expect(res.accepted).toBe(false);
      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });

    it('discards implausible speeds above 70 m/s', () => {
      const meter = new CalibrationMeter();
      meter.start();

      meter.processReading(createReading(0, 0, 20, 1000));
      // 100 meters in 1s = 100 m/s > 70 m/s
      const dest = destinationCoordinate(0, 0, 100, 0);
      const fast = createReading(dest.latitude, dest.longitude, 100, 2000);
      const res = meter.processReading(fast);

      expect(res.accepted).toBe(false);
      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });

    it('suppresses stopped-vehicle jitter displacements (< 2m)', () => {
      const meter = new CalibrationMeter();
      meter.start();

      meter.processReading(createReading(0, 0, 0, 1000));
      // Stopped car drifts 1 meter
      const dest = destinationCoordinate(0, 0, 1.0, 0);
      const jitter = createReading(dest.latitude, dest.longitude, 0, 2000);
      const res = meter.processReading(jitter);

      expect(res.accepted).toBe(true);
      expect(res.step?.filterResult.isJitter).toBe(true);
      expect(meter.getMeasuredDistanceKm()).toBe(0);
    });
  });

  describe('Independence from RallyTracker', () => {
    it('measuring a calibration zone does not alter race tracker distance, speed, or delta', () => {
      const tracker = new RallyTracker({ assignedSpeedKmH: 50 });
      tracker.start(1000);

      // Race tracker receives reading
      const rRace1 = createReading(0, 0, 20, 1000);
      tracker.processReading(rRace1);
      const destRace = destinationCoordinate(0, 0, 200, 0);
      const rRace2 = createReading(destRace.latitude, destRace.longitude, 20, 11000);
      tracker.processReading(rRace2);

      const raceDistBefore = tracker.getDisplayedDistanceKm();
      const raceSpeedBefore = tracker.getAverageSpeedKmH(10000);
      const raceDeltaBefore = tracker.getDeltaSeconds(10000, 11000);

      expect(raceDistBefore).toBeCloseTo(0.200, 3);

      // Now operate the calibration meter independently
      const meter = new CalibrationMeter();
      meter.start();

      const rCal1 = createReading(10, 10, 15, 20000);
      meter.processReading(rCal1);
      const destCal = destinationCoordinate(10, 10, 500, 0);
      const rCal2 = createReading(destCal.latitude, destCal.longitude, 15, 30000);
      meter.processReading(rCal2);

      expect(meter.getMeasuredDistanceKm()).toBeCloseTo(0.500, 3);

      // Race tracker must be 100% untouched
      expect(tracker.getDisplayedDistanceKm()).toBe(raceDistBefore);
      expect(tracker.getAverageSpeedKmH(10000)).toBe(raceSpeedBefore);
      expect(tracker.getDeltaSeconds(10000, 11000)).toBe(raceDeltaBefore);
    });
  });

  describe('Race running blocking check', () => {
    it('blocks start() when race is running', () => {
      let raceRunning = true;
      const meter = new CalibrationMeter({
        isRaceRunning: () => raceRunning,
      });

      expect(meter.isAllowed()).toBe(false);
      const started = meter.start();
      expect(started).toBe(false);
      expect(meter.getState()).toBe('idle');

      // When race stops, start is allowed
      raceRunning = false;
      expect(meter.isAllowed()).toBe(true);
      const startedAfterStop = meter.start();
      expect(startedAfterStop).toBe(true);
      expect(meter.getState()).toBe('measuring');
    });
  });
});
