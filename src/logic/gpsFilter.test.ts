import { describe, it, expect } from 'vitest';
import { filterGpsReading, isVehicleStopped } from './gpsFilter';
import {
  MAX_ACCURACY_METERS,
  MAX_SPEED_MPS,
  MAX_STOPPED_SPEED_MPS,
  STOPPED_JITTER_THRESHOLD_METERS,
} from './gpsConstants';
import type { GpsReading } from './gpsReader';

describe('gpsFilter', () => {
  const baseReading: GpsReading = {
    latitude: 0,
    longitude: 0,
    accuracy: 10,
    speed: 10, // 10 m/s = 36 km/h
    timestamp: 10000,
  };

  describe('Rule 1: Accuracy filter', () => {
    it('accepts readings with accuracy <= 30 m', () => {
      const reading30: GpsReading = { ...baseReading, accuracy: 30 };
      expect(filterGpsReading(reading30, null).accepted).toBe(true);

      const reading5: GpsReading = { ...baseReading, accuracy: 5 };
      expect(filterGpsReading(reading5, null).accepted).toBe(true);
    });

    it('discards readings with accuracy > 30 m', () => {
      const reading30Point1: GpsReading = { ...baseReading, accuracy: 30.1 };
      const res1 = filterGpsReading(reading30Point1, null);
      expect(res1.accepted).toBe(false);
      expect(res1.reason).toBe('poor_accuracy');

      const reading50: GpsReading = { ...baseReading, accuracy: 50 };
      const res2 = filterGpsReading(reading50, null);
      expect(res2.accepted).toBe(false);
      expect(res2.reason).toBe('poor_accuracy');
    });
  });

  describe('Rule 2: Timestamp order filter', () => {
    it('accepts readings strictly newer than last accepted', () => {
      const nextReading: GpsReading = {
        ...baseReading,
        timestamp: baseReading.timestamp + 1000,
      };
      const res = filterGpsReading(nextReading, baseReading);
      expect(res.accepted).toBe(true);
    });

    it('discards duplicate timestamps', () => {
      const dupReading: GpsReading = {
        ...baseReading,
        timestamp: baseReading.timestamp,
      };
      const res = filterGpsReading(dupReading, baseReading);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('timestamp_out_of_order');
    });

    it('discards out-of-order (older) timestamps', () => {
      const olderReading: GpsReading = {
        ...baseReading,
        timestamp: baseReading.timestamp - 500,
      };
      const res = filterGpsReading(olderReading, baseReading);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('timestamp_out_of_order');
    });
  });

  describe('Rule 3: Implausible speed jump filter', () => {
    it('accepts speeds up to 70 m/s (~252 km/h)', () => {
      // At dt = 1s, 70m displacement is ~0.000629 degrees latitude
      // 70 m in 1s = 70 m/s
      // Exactly 70 m
      const reading70mps: GpsReading = {
        ...baseReading,
        latitude: 70 / 111194.9266,
        timestamp: baseReading.timestamp + 1000,
      };
      const res = filterGpsReading(reading70mps, baseReading);
      expect(res.accepted).toBe(true);
      expect(res.distanceMeters).toBeCloseTo(70, 0);
    });

    it('discards readings implying speed > 70 m/s relative to last accepted point', () => {
      // 100m in 1s = 100 m/s > 70 m/s
      const jumpReading: GpsReading = {
        ...baseReading,
        latitude: 100 / 111194.9266,
        timestamp: baseReading.timestamp + 1000,
      };
      const res = filterGpsReading(jumpReading, baseReading);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('implausible_speed');
    });
  });

  describe('Rule 4: Stopped-vehicle jitter filter', () => {
    it('isVehicleStopped reports true when speed <= 0.5 m/s', () => {
      expect(isVehicleStopped(0, null)).toBe(true);
      expect(isVehicleStopped(0.3, null)).toBe(true);
      expect(isVehicleStopped(0.5, null)).toBe(true);
      expect(isVehicleStopped(0.51, null)).toBe(false);
      expect(isVehicleStopped(5.0, null)).toBe(false);
    });

    it('isVehicleStopped falls back to derived speed if reported speed is null', () => {
      expect(isVehicleStopped(null, 0.2)).toBe(true);
      expect(isVehicleStopped(null, 0.5)).toBe(true);
      expect(isVehicleStopped(null, 0.8)).toBe(false);
    });

    it('ignores displacement (< 2.0 m) when vehicle is stopped (reported speed <= 0.5 m/s)', () => {
      // 1.5m displacement in 1s:
      const latOffset = 1.5 / 111194.9266;
      const jitterReading: GpsReading = {
        ...baseReading,
        latitude: latOffset,
        speed: 0.1, // effectively stopped
        timestamp: baseReading.timestamp + 1000,
      };

      const res = filterGpsReading(jitterReading, baseReading);
      // Reading is accepted to keep connection and time alive
      expect(res.accepted).toBe(true);
      // But displacement is zeroed to prevent parked phone from accumulating odometer distance
      expect(res.distanceMeters).toBe(0);
      expect(res.isJitter).toBe(true);
    });

    it('ignores displacement (< 2.0 m) when reported speed is null but implied speed <= 0.5 m/s', () => {
      // 0.4m displacement in 1s = 0.4 m/s <= 0.5 m/s
      const latOffset = 0.4 / 111194.9266;
      const jitterReading: GpsReading = {
        ...baseReading,
        latitude: latOffset,
        speed: null,
        timestamp: baseReading.timestamp + 1000,
      };

      const res = filterGpsReading(jitterReading, baseReading);
      expect(res.accepted).toBe(true);
      expect(res.distanceMeters).toBe(0);
      expect(res.isJitter).toBe(true);
    });

    it('accumulates displacement when movement >= 2.0 m even at low speed', () => {
      // 2.5m displacement
      const latOffset = 2.5 / 111194.9266;
      const realMoveReading: GpsReading = {
        ...baseReading,
        latitude: latOffset,
        speed: 0.2,
        timestamp: baseReading.timestamp + 1000,
      };

      const res = filterGpsReading(realMoveReading, baseReading);
      expect(res.accepted).toBe(true);
      expect(res.distanceMeters).toBeCloseTo(2.5, 1);
      expect(res.isJitter).toBe(false);
    });

    it('accumulates displacement when vehicle is moving (speed > 0.5 m/s) even if displacement < 2.0 m', () => {
      // 1.0m displacement in 0.1s = 10 m/s
      const latOffset = 1.0 / 111194.9266;
      const fastReading: GpsReading = {
        ...baseReading,
        latitude: latOffset,
        speed: 10.0,
        timestamp: baseReading.timestamp + 100,
      };

      const res = filterGpsReading(fastReading, baseReading);
      expect(res.accepted).toBe(true);
      expect(res.distanceMeters).toBeCloseTo(1.0, 1);
      expect(res.isJitter).toBe(false);
    });

    it('measures displacement from referencePosition when provided, suppressing until accumulated movement >= 2.0m', () => {
      // Origin reference
      const originRef: GpsReading = { ...baseReading, speed: 0.1, timestamp: 10000 };

      // Step 1: 0.8m from origin (speed 0.1 m/s) -> jitter
      const step1: GpsReading = {
        ...baseReading,
        latitude: 0.8 / 111194.9266,
        speed: 0.1,
        timestamp: 11000,
      };
      const res1 = filterGpsReading(step1, originRef, originRef);
      expect(res1.accepted).toBe(true);
      expect(res1.isJitter).toBe(true);
      expect(res1.distanceMeters).toBe(0);

      // Step 2: 1.6m from origin, lastAccepted was step1 -> still jitter relative to originRef
      const step2: GpsReading = {
        ...baseReading,
        latitude: 1.6 / 111194.9266,
        speed: 0.1,
        timestamp: 12000,
      };
      const res2 = filterGpsReading(step2, step1, originRef);
      expect(res2.accepted).toBe(true);
      expect(res2.isJitter).toBe(true);
      expect(res2.distanceMeters).toBe(0);

      // Step 3: 2.2m from origin -> exceeds 2.0m threshold from originRef!
      const step3: GpsReading = {
        ...baseReading,
        latitude: 2.2 / 111194.9266,
        speed: 0.1,
        timestamp: 13000,
      };
      const res3 = filterGpsReading(step3, step2, originRef);
      expect(res3.accepted).toBe(true);
      expect(res3.isJitter).toBe(false);
      expect(res3.distanceMeters).toBeCloseTo(2.2, 1);
    });
  });
});
