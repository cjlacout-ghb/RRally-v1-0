import { describe, it, expect } from 'vitest';
import { RallyTracker } from './rallyTracker';
import type { GpsReading } from './gpsReader';
import type { Clocks } from './stopwatch';
import { destinationCoordinate } from './geo';

describe('RallyTracker', () => {
  let mockWallClock = 100000;
  const mockClocks: Clocks = {
    nowMonotonic: () => mockWallClock,
    nowWallClock: () => mockWallClock,
  };

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

  describe('Distance accumulation & lifecycle', () => {
    it('does not accumulate distance before INICIAR (start)', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      const r1 = createReading(0, 0, 10, 100000);
      const r2 = createReading(0.01, 0, 10, 101000);

      tracker.processReading(r1);
      tracker.processReading(r2);

      expect(tracker.getRawDistanceKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);
    });

    it('first accepted reading after INICIAR is starting reference, distance starts at 0', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      const r1 = createReading(0, 0, 20, 100000);
      const res1 = tracker.processReading(r1);

      expect(res1.isNewReference).toBe(true);
      expect(tracker.getRawDistanceKm()).toBe(0);

      // Second reading moves 20 meters (20 m/s = 72 km/h) in 1 second
      const dest = destinationCoordinate(0, 0, 20, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 101000);
      const res2 = tracker.processReading(r2);

      expect(res2.isNewReference).toBe(false);
      expect(tracker.getRawDistanceKm()).toBeCloseTo(0.020, 3);
    });

    it('freezes distance on PARAR and establishes a new reference on resume (no jump)', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      const r1 = createReading(0, 0, 20, 100000);
      tracker.processReading(r1);

      // 20m displacement in 1s
      const dest1 = destinationCoordinate(0, 0, 20, 0);
      const r2 = createReading(dest1.latitude, dest1.longitude, 20, 101000);
      tracker.processReading(r2);
      const distAtStop = tracker.getRawDistanceKm();
      expect(distAtStop).toBeCloseTo(0.020, 3);

      // Stop (PARAR)
      tracker.stop(101500);

      // While stopped, car moves 100 meters over 5 seconds (20 m/s <= 70 m/s)
      const destStopped = destinationCoordinate(0, 0, 120, 0);
      const rStopped = createReading(destStopped.latitude, destStopped.longitude, 0, 106000);
      tracker.processReading(rStopped);
      expect(tracker.getRawDistanceKm()).toBe(distAtStop); // Unchanged

      // Resume (INICIAR) at 108000
      tracker.start(108000);

      // First reading after resume establishes new reference
      const rResume = createReading(destStopped.latitude, destStopped.longitude, 20, 108000);
      const resResume = tracker.processReading(rResume);
      expect(resResume.isNewReference).toBe(true);
      expect(tracker.getRawDistanceKm()).toBe(distAtStop); // Still unchanged, NO JUMP

      // Next reading moves 20m further in 1s
      const destAfterResume = destinationCoordinate(destStopped.latitude, destStopped.longitude, 20, 0);
      const rNext = createReading(destAfterResume.latitude, destAfterResume.longitude, 20, 109000);
      tracker.processReading(rNext);
      expect(tracker.getRawDistanceKm()).toBeCloseTo(distAtStop + 0.020, 3);
    });

    it('REINICIAR resets raw distance, manual adjustment, delta, and average', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 50,
      });
      tracker.start(100000);
      tracker.adjustDistance(3); // +30m

      const r1 = createReading(0, 0, 20, 100000);
      const dest = destinationCoordinate(0, 0, 20, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 101000);
      tracker.processReading(r1);
      tracker.processReading(r2);

      expect(tracker.getRawDistanceKm()).toBeGreaterThan(0);
      expect(tracker.getManualAdjustmentKm()).toBe(0.030);

      tracker.reset();

      expect(tracker.getRawDistanceKm()).toBe(0);
      expect(tracker.getManualAdjustmentKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);
      expect(tracker.getDeltaSeconds()).toBeNull();
      expect(tracker.getAverageSpeedKmH()).toBeNull();
      expect(tracker.isRunning()).toBe(false);
    });
  });

  describe('Correction factor & manual adjustment', () => {
    it('applies correction factor to raw distance only', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.setCorrectionFactor(1.05); // 5% correction
      tracker.adjustDistance(2); // +20m (0.020 km)

      tracker.start(100000);
      const r1 = createReading(0, 0, 20, 100000);
      // 1.0 km raw displacement over 50 seconds (20 m/s = 72 km/h):
      const dest = destinationCoordinate(0, 0, 1000, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 150000);

      tracker.processReading(r1);
      tracker.processReading(r2);

      expect(tracker.getRawDistanceKm()).toBeCloseTo(1.0, 3);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);
      // Displayed = 1.0 * 1.05 + 0.020 = 1.070 km
      expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.070, 3);
    });

    it('each manual adjustment step is exactly 10 m (0.010 km)', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      expect(tracker.getManualAdjustmentKm()).toBe(0);

      tracker.adjustDistance(1);
      expect(tracker.getManualAdjustmentKm()).toBe(0.010);

      tracker.adjustDistance(1);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);

      tracker.adjustDistance(-1);
      expect(tracker.getManualAdjustmentKm()).toBe(0.010);
    });

    it('never allows displayed distance to drop below 0, and ignores -1 when at 0', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      expect(tracker.getDisplayedDistanceKm()).toBe(0);
      expect(tracker.getManualAdjustmentKm()).toBe(0);

      // Press -1 when at 0: must be ignored, manual adjustment stays 0
      tracker.adjustDistance(-1);
      expect(tracker.getManualAdjustmentKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);

      // Advance +2 (+20m = 0.020 km)
      tracker.adjustDistance(2);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);
      expect(tracker.getDisplayedDistanceKm()).toBe(0.020);

      // Press -2: back to 0
      tracker.adjustDistance(-2);
      expect(tracker.getManualAdjustmentKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);

      // Press -1 again: must be ignored
      tracker.adjustDistance(-1);
      expect(tracker.getManualAdjustmentKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);
    });

    it('+1/-1 with no GPS reading yet leaves delta as null (no-data) and does not throw', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });

      expect(() => {
        tracker.adjustDistance(1);
        tracker.adjustDistance(-1);
      }).not.toThrow();

      expect(tracker.getDeltaSeconds()).toBeNull();
    });

    it('manual adjustment survives incoming GPS readings', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.adjustDistance(2); // +0.020 km
      tracker.start(100000);

      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);

      const dest = destinationCoordinate(0, 0, 10, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 10, 101000);
      tracker.processReading(r2);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);
    });
  });

  describe('Instantaneous speed', () => {
    it('is available before INICIAR and uses reported speed when available', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      const r = createReading(0, 0, 15, 100000); // 15 m/s = 54 km/h

      tracker.processReading(r);
      expect(tracker.getInstantaneousSpeedKmH(100000)).toBeCloseTo(54.0, 1);
    });

    it('smoothes instantaneous speed over a short window (~3 seconds)', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      // Three readings at 1s intervals with varying speeds
      // r1: 10 m/s (36 km/h)
      // r2: 20 m/s (72 km/h)
      // r3: 30 m/s (108 km/h)
      tracker.processReading(createReading(0, 0, 10, 100000));
      tracker.processReading(createReading(0, 0.0001, 20, 101000));
      tracker.processReading(createReading(0, 0.0002, 30, 102000));

      // Average in 3s window: (10 + 20 + 30) / 3 = 20 m/s = 72 km/h
      expect(tracker.getInstantaneousSpeedKmH(102000)).toBeCloseTo(72.0, 1);

      // Reading 4 arrives at 104000 (> 3000ms after r1 at 100000)
      tracker.processReading(createReading(0, 0.0003, 40, 104000));
      // Window should now contain r2 (101000), r3 (102000), and r4 (104000)
      // Average: (20 + 30 + 40) / 3 = 30 m/s = 108 km/h
      expect(tracker.getInstantaneousSpeedKmH(104000)).toBeCloseTo(108.0, 1);
    });

    it('becomes no-data (null) after 5 seconds without accepted reading (stale)', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.processReading(createReading(0, 0, 10, 100000));

      // 4.9 seconds later: still fresh
      expect(tracker.getInstantaneousSpeedKmH(104900)).toBeCloseTo(36.0, 1);

      // 5.1 seconds later: stale
      expect(tracker.getInstantaneousSpeedKmH(105100)).toBeNull();
    });
  });

  describe('Average speed', () => {
    it('returns null if elapsed time < 5 seconds', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      // Move 100m in 3 seconds
      const r1 = createReading(0, 0, 10, 100000);
      const dest = destinationCoordinate(0, 0, 100, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 10, 103000);

      tracker.processReading(r1);
      tracker.processReading(r2);

      expect(tracker.getAverageSpeedKmH(3000)).toBeNull();
    });

    it('returns null if displayed distance is 0 even if >= 5s elapsed', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);
      const r1 = createReading(0, 0, 0, 100000);
      tracker.processReading(r1);

      expect(tracker.getAverageSpeedKmH(6000)).toBeNull();
    });

    it('computes correct average speed when >= 5s elapsed and distance > 0', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      const r1 = createReading(0, 0, 20, 100000);
      // Move 200m (0.2 km) in 10 seconds -> 0.2 / (10 / 3600) = 72 km/h
      const dest = destinationCoordinate(0, 0, 200, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 110000);

      tracker.processReading(r1);
      tracker.processReading(r2);

      const avg = tracker.getAverageSpeedKmH(10000);
      expect(avg).toBeCloseTo(72.0, 1);
    });

    it('is frozen on PARAR', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      const r1 = createReading(0, 0, 20, 100000);
      const dest = destinationCoordinate(0, 0, 200, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 20, 110000);

      tracker.processReading(r1);
      tracker.processReading(r2);

      // PARAR at 110000
      tracker.stop(110000);
      expect(tracker.getAverageSpeedKmH()).toBeCloseTo(72.0, 1);

      // Move more while stopped
      const dest2 = destinationCoordinate(0, 0, 500, 0);
      tracker.processReading(createReading(dest2.latitude, dest2.longitude, 20, 115000));
      // Average remains frozen
      expect(tracker.getAverageSpeedKmH()).toBeCloseTo(72.0, 1);
    });
  });

  describe('Delta calculations & clock reconciliation', () => {
    it('returns null when assigned stage speed is missing or zero', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);
      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);

      expect(tracker.getDeltaSeconds()).toBeNull();
    });

    it('computes delta using the reading timestamp (reconciled against session start)', () => {
      // Stage speed: 60 km/h (1 km per 60 seconds)
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });

      // Stopwatch started at t = 100000
      tracker.start(100000);

      // First reading at t = 100000: reference point
      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);

      // Move 1000m (1 km).
      // If reading timestamp is t = 155000 (actual elapsed: 55 seconds):
      // Ideal time = 60s. Actual time = 55s.
      // Delta = 60 - 55 = +5.0 s (ahead!)
      const dest = destinationCoordinate(0, 0, 1000, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 18, 155000);
      tracker.processReading(r2);

      expect(tracker.getDeltaSeconds()).toBeCloseTo(5.0, 1);
    });

    it('computes negative delta when behind schedule', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);

      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);

      // Move 1000m in 65 seconds
      // Ideal time = 60s. Actual time = 65s.
      // Delta = 60 - 65 = -5.0 s (behind!)
      const dest = destinationCoordinate(0, 0, 1000, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 15, 165000);
      tracker.processReading(r2);

      expect(tracker.getDeltaSeconds()).toBeCloseTo(-5.0, 1);
    });

    it('immediately recomputes delta when manual adjustment changes', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);

      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);

      // Move 1000m in exactly 60s -> delta = 0
      const dest = destinationCoordinate(0, 0, 1000, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 16.6, 160000);
      tracker.processReading(r2);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(0.0, 1);

      // Press +1 (+10 meters = +0.010 km).
      // Ideal time for 1.010 km at 60 km/h: (1.010 / 60) * 3600 = 60.6 s
      // Actual elapsed: 60.0 s
      // Delta = 60.6 - 60.0 = +0.6 s
      tracker.adjustDistance(1);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(0.6, 1);

      // Press -2 (-20 meters -> total adjustment -10m = -0.010 km)
      // Ideal time for 0.990 km: (0.990 / 60) * 3600 = 59.4 s
      // Delta = 59.4 - 60.0 = -0.6 s
      tracker.adjustDistance(-2);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(-0.6, 1);
    });

    it('freezes delta on PARAR', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);

      const r1 = createReading(0, 0, 10, 100000);
      tracker.processReading(r1);

      const dest = destinationCoordinate(0, 0, 1000, 0);
      const r2 = createReading(dest.latitude, dest.longitude, 18, 155000);
      tracker.processReading(r2);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(5.0, 1);

      // PARAR
      tracker.stop(155000);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(5.0, 1);

      // New readings while stopped do not alter delta
      const r3 = createReading(dest.latitude + 0.01, dest.longitude, 20, 170000);
      tracker.processReading(r3);
      expect(tracker.getDeltaSeconds()).toBeCloseTo(5.0, 1);
    });

    it('Check 1: delta uses reading elapsed time, never stop() call moment or clock advance, and readings while stopped change nothing', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);

      // r1 at t = 100000
      tracker.processReading(createReading(0, 0, 10, 100000));

      // r2 at t = 150000 (50s elapsed), covers 1000m (ideal = 60s)
      // Delta at reading = 60 - 50 = +10.0s
      const dest = destinationCoordinate(0, 0, 1000, 0);
      tracker.processReading(createReading(dest.latitude, dest.longitude, 20, 150000));
      expect(tracker.getDeltaSeconds()).toBeCloseTo(10.0, 1);

      // stop() is called 8 seconds later at t = 158000
      tracker.stop(158000);

      // Delta must STILL be +10.0s (from r2 at t=150000), NOT +2.0s (from t=158000)
      expect(tracker.getDeltaSeconds()).toBeCloseTo(10.0, 1);
      expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.0, 3);

      // Clock advances to t = 200000
      mockWallClock = 200000;
      expect(tracker.getDeltaSeconds()).toBeCloseTo(10.0, 1);

      // Reading arrives while stopped: must not change distance or delta
      const destWhileStopped = destinationCoordinate(dest.latitude, dest.longitude, 10, 0);
      tracker.processReading(createReading(destWhileStopped.latitude, destWhileStopped.longitude, 10, 201000));
      expect(tracker.getDeltaSeconds()).toBeCloseTo(10.0, 1);
      expect(tracker.getDisplayedDistanceKm()).toBeCloseTo(1.0, 3);
    });

    it('Check 2: discards readings earlier than session start (late-delivered fixes)', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });

      // Start at 100050
      tracker.start(100050);

      // Fix acquired at 100020 (before session start) delivered late at 100060
      const lateFix = createReading(0, 0, 10, 100020);
      const res = tracker.processReading(lateFix);

      expect(res.accepted).toBe(false);
      expect(res.isNewReference).toBe(false);
      expect(tracker.getDeltaSeconds()).toBeNull();
      expect(tracker.getRawDistanceKm()).toBe(0);

      // Normal fix acquired at 101000 (after session start)
      const validFix = createReading(0, 0, 10, 101000);
      const resValid = tracker.processReading(validFix);
      expect(resValid.accepted).toBe(true);
      expect(resValid.isNewReference).toBe(true);
    });

    it('Check 3: stationary jitter does not move reference point; slow movement accumulates until >= 2m and counts', () => {
      const tracker = new RallyTracker({ clocks: mockClocks });
      tracker.start(100000);

      // r1 at origin: reference point
      const r1 = createReading(0, 0, 0.2, 100000);
      tracker.processReading(r1);
      expect(tracker.getRawDistanceKm()).toBe(0);

      // r2 moves 0.8m North at 0.2 m/s: < 2.0m, stationary jitter suppressed!
      const p1 = destinationCoordinate(0, 0, 0.8, 0);
      const r2 = createReading(p1.latitude, p1.longitude, 0.2, 101000);
      const res2 = tracker.processReading(r2);
      expect(res2.filterResult.isJitter).toBe(true);
      expect(tracker.getRawDistanceKm()).toBe(0);

      // r3 moves another 0.8m North (total 1.6m from origin) at 0.2 m/s: < 2.0m, still suppressed!
      const p2 = destinationCoordinate(0, 0, 1.6, 0);
      const r3 = createReading(p2.latitude, p2.longitude, 0.2, 102000);
      const res3 = tracker.processReading(r3);
      expect(res3.filterResult.isJitter).toBe(true);
      expect(tracker.getRawDistanceKm()).toBe(0);

      // r4 moves to 2.4m North from origin at 0.2 m/s: >= 2.0m from origin!
      // Must NOT be suppressed, and total 2.4m must be counted!
      const p3 = destinationCoordinate(0, 0, 2.4, 0);
      const r4 = createReading(p3.latitude, p3.longitude, 0.2, 103000);
      const res4 = tracker.processReading(r4);
      expect(res4.filterResult.isJitter).toBe(false);
      expect(tracker.getRawDistanceKm()).toBeCloseTo(0.0024, 4);
    });

    it('Check 5: comprehensive verification of reset()', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);
      tracker.adjustDistance(2); // +0.020 km

      tracker.processReading(createReading(0, 0, 20, 100000));
      const dest = destinationCoordinate(0, 0, 200, 0);
      tracker.processReading(createReading(dest.latitude, dest.longitude, 20, 110000));

      expect(tracker.getRawDistanceKm()).toBeGreaterThan(0);
      expect(tracker.getDisplayedDistanceKm()).toBeGreaterThan(0);
      expect(tracker.getManualAdjustmentKm()).toBe(0.020);
      expect(tracker.getDeltaSeconds()).not.toBeNull();
      expect(tracker.getAverageSpeedKmH()).not.toBeNull();
      expect(tracker.getInstantaneousSpeedKmH(110000)).not.toBeNull();

      tracker.reset();

      expect(tracker.getRawDistanceKm()).toBe(0);
      expect(tracker.getDisplayedDistanceKm()).toBe(0);
      expect(tracker.getManualAdjustmentKm()).toBe(0);
      expect(tracker.getDeltaSeconds()).toBeNull();
      expect(tracker.getAverageSpeedKmH()).toBeNull();
      expect(tracker.getInstantaneousSpeedKmH(110000)).toBeNull();
      expect(tracker.isRunning()).toBe(false);
      expect(tracker.getLatestReading()).toBeNull();
    });

    it('Check 6: average speed uses displayed distance with manual adjustment and same elapsed time as delta', () => {
      const tracker = new RallyTracker({
        clocks: mockClocks,
        assignedSpeedKmH: 60,
      });
      tracker.start(100000);

      // Reading 1 at t = 100000
      tracker.processReading(createReading(0, 0, 20, 100000));

      // Reading 2 at t = 110000 (10s elapsed), covers 200m (0.200 km)
      const dest = destinationCoordinate(0, 0, 200, 0);
      tracker.processReading(createReading(dest.latitude, dest.longitude, 20, 110000));

      // Without manual adjustment: 0.200 km in 10s = 72 km/h
      expect(tracker.getAverageSpeedKmH()).toBeCloseTo(72.0, 1);

      // Apply +1 manual adjustment (+0.010 km -> 0.210 km)
      tracker.adjustDistance(1);
      // Average speed uses displayed distance (0.210 km) / (10 / 3600 h) = 75.6 km/h
      expect(tracker.getAverageSpeedKmH()).toBeCloseTo(75.6, 1);

      // Check elapsed time: if elapsed < 5s, returns null
      const freshTracker = new RallyTracker({ clocks: mockClocks });
      freshTracker.start(100000);
      freshTracker.processReading(createReading(0, 0, 20, 100000));
      const destShort = destinationCoordinate(0, 0, 80, 0);
      freshTracker.processReading(createReading(destShort.latitude, destShort.longitude, 20, 104000)); // 4s elapsed
      expect(freshTracker.getAverageSpeedKmH()).toBeNull();
    });
  });
});
