import { describe, it, expect } from 'vitest';
import { RoadbookRaceTracker, computeRowDeviation, roundToDisplayedRealSeconds } from './roadbookRace';
import { RoadbookRow } from './roadbookModel';

describe('roadbookRace', () => {
  const sampleRows: RoadbookRow[] = [
    { id: '1', mark: 'Autolargada', assignedTimeSeconds: 0, speedKmH: 50 },
    { id: '2', mark: 'Empty 1', assignedTimeSeconds: null, speedKmH: null },
    { id: '3', mark: 'Control 1', assignedTimeSeconds: 100, speedKmH: 60 },
    { id: '4', mark: 'Empty 2', assignedTimeSeconds: null, speedKmH: null },
    { id: '5', mark: 'Control 2', assignedTimeSeconds: 250, speedKmH: null },
  ];

  it('initializes pointer to the first row with assigned time', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    expect(tracker.getCurrentRowIndex()).toBe(0);
    expect(tracker.isFinished()).toBe(false);
  });

  it('skips rows without assigned time when advancing', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    // Mark row 0
    tracker.mark(500); // 0.5s real time
    // Next loaded row should be row 2 (index 2), skipping row 1
    expect(tracker.getCurrentRowIndex()).toBe(2);

    // Skip row 2
    tracker.skip();
    // Next loaded row should be row 4 (index 4), skipping row 3
    expect(tracker.getCurrentRowIndex()).toBe(4);
  });

  it('enters finished state when no further row with assigned time exists', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    tracker.mark(0); // row 0 -> next is 2
    tracker.mark(100000); // row 2 -> next is 4
    tracker.mark(250000); // row 4 -> finished!

    expect(tracker.getCurrentRowIndex()).toBeNull();
    expect(tracker.isFinished()).toBe(true);

    // Mark and skip do nothing when finished
    expect(tracker.mark(300000)).toBe(false);
    expect(tracker.skip()).toBe(false);
  });

  it('handles undo after reaching finished state', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    tracker.mark(0);
    tracker.mark(100000);
    tracker.mark(250000);
    expect(tracker.isFinished()).toBe(true);

    const undone = tracker.undo();
    expect(undone).toBe(true);
    expect(tracker.isFinished()).toBe(false);
    expect(tracker.getCurrentRowIndex()).toBe(4); // row 4 restored
  });

  it('handles undo right after a skip', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    tracker.mark(0);
    expect(tracker.getCurrentRowIndex()).toBe(2);

    tracker.skip(); // skip row 2
    expect(tracker.getCurrentRowIndex()).toBe(4);

    tracker.undo(); // undo skip on row 2
    expect(tracker.getCurrentRowIndex()).toBe(2);
    expect(tracker.getMarks()[2]).toBeUndefined();
  });

  it('does nothing when undo is called with empty history', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    expect(tracker.undo()).toBe(false);
    expect(tracker.getCurrentRowIndex()).toBe(0);
  });

  it('reset clears all marks, history and restores pointer to first loaded row', () => {
    const tracker = new RoadbookRaceTracker(sampleRows);
    tracker.mark(0);
    tracker.skip();
    expect(tracker.getHistory()).toHaveLength(2);

    tracker.reset();
    expect(tracker.getHistory()).toHaveLength(0);
    expect(tracker.getMarks()).toEqual({});
    expect(tracker.getCurrentRowIndex()).toBe(0);
    expect(tracker.isFinished()).toBe(false);
  });

  describe('deviation calculation and classification', () => {
    it('calculates deviation: assigned time minus real time (positive = ahead, negative = behind)', () => {
      // Assigned = 100s, Real = 95s (arrived earlier = ahead) -> +5.0s
      expect(computeRowDeviation(100, 95000)).toBe(5);

      // Assigned = 100s, Real = 105s (arrived later = behind) -> -5.0s
      expect(computeRowDeviation(100, 105000)).toBe(-5);

      // On time exact
      expect(computeRowDeviation(100, 100000)).toBe(0);

      // Handles null or invalid
      expect(computeRowDeviation(null, 100000)).toBeNull();
      expect(computeRowDeviation(100, null)).toBeNull();
    });

    it('deviation is consistent with displayed real time (assignment requirement)', () => {
      // Real = 10,550ms → displayed = 0:00:10,6 (rounds to 10.6s)
      // Assigned = 0s → dev = 0 - 10.6 = -10.6  (rounds to -10.6)
      const realMs = 10550;
      const assignedS = 0;
      const displayedReal = roundToDisplayedRealSeconds(realMs);
      const dev = computeRowDeviation(assignedS, realMs);
      // displayedReal should be 10.6
      expect(displayedReal).toBe(10.6);
      // deviation = 0 - 10.6 = -10.6
      expect(dev).toBe(-10.6);
    });

    it('rounds .x5 values upward (standard rounding)', () => {
      // 10,450ms → 10.45s → rounds to 10.5s displayed (Math.round(104.5) = 105 tenths → 10.5s)
      expect(roundToDisplayedRealSeconds(10450)).toBe(10.5);
      // 10,550ms → rounds to 10.6s
      expect(roundToDisplayedRealSeconds(10550)).toBe(10.6);
      // 10,449ms → rounds to 10.4s
      expect(roundToDisplayedRealSeconds(10449)).toBe(10.4);
    });

    it('deviation sign consistent with displayed real time rounding at x.x5 boundary', () => {
      // Assigned = 11s, Real = 10,550ms → displayed real = 10.6s → dev = 11 - 10.6 = +0.4
      const dev = computeRowDeviation(11, 10550);
      expect(dev).toBe(0.4);

      // Assigned = 10s, Real = 10,549ms → displayed real = 10.5s → dev = 10 - 10.5 = -0.5
      const dev2 = computeRowDeviation(10, 10549);
      expect(dev2).toBe(-0.5);
    });

    it('deviation result is always rounded to 1 decimal', () => {
      // Assigned = 100.33s (fractional stored internally, edge case), Real = 100.000ms
      // displayed real = 100.0s, dev = 0.33 → rounds to 0.3
      const dev = computeRowDeviation(100.33, 100000);
      expect(dev).toBe(0.3);
    });

    it('returns null accumulated deviation before first mark', () => {
      const tracker = new RoadbookRaceTracker(sampleRows);
      expect(tracker.getAccumulatedDeviation()).toBeNull();
      const snapshot = tracker.getSnapshot();
      expect(snapshot.accumulatedDeviationSeconds).toBeNull();
      expect(snapshot.deltaState).toBe('no-data');
    });

    it('uses the last MARKED row deviation even if subsequent rows were skipped', () => {
      const tracker = new RoadbookRaceTracker(sampleRows);
      // Mark row 0: assigned = 0, real = 2000ms (2s) -> dev = 0 - 2 = -2.0s
      tracker.mark(2000);
      expect(tracker.getAccumulatedDeviation()).toBe(-2);
      expect(tracker.getSnapshot().deltaState).toBe('behind');

      // Skip row 2
      tracker.skip();
      // Deviation should still be from row 0 (-2.0s)
      expect(tracker.getAccumulatedDeviation()).toBe(-2);
      expect(tracker.getLastMarkedRowIndex()).toBe(0);

      // Mark row 4: assigned = 250, real = 249000ms (249s) -> dev = 250 - 249 = +1.0s
      tracker.mark(249000);
      expect(tracker.getAccumulatedDeviation()).toBe(1);
      expect(tracker.getLastMarkedRowIndex()).toBe(4);
      expect(tracker.getSnapshot().deltaState).toBe('ahead');
    });

    it('classifies on-time when deviation is within tolerance (+/-0.10s)', () => {
      const tracker = new RoadbookRaceTracker(sampleRows);
      // Assigned = 0, Real = 50ms (0.05s) -> dev = -0.05s (<= 0.10s)
      tracker.mark(50);
      expect(tracker.getSnapshot().deltaState).toBe('neutral');
    });
  });
});
