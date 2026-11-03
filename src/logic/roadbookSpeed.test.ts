import { describe, it, expect } from 'vitest';
import { computeNextStretchSpeed } from './roadbookSpeed';
import { RoadbookRow } from './roadbookModel';

describe('roadbookSpeed', () => {
  it('handles the worked example from specification', () => {
    // previous assigned time 0:35:40 (2140s), speed 61 km/h
    // current assigned time 0:36:47 (2207s)
    // deviation = -5.0s
    // planned duration = 67s
    // adjusted duration = 67 + (-5.0) = 62s
    // adjusted speed = 61 * 67 / 62 = 65.9193548... km/h
    // direction faster, not demanding (< 110% of 61 = 67.1)
    const rows: RoadbookRow[] = [
      { id: '1', mark: 'PC1', assignedTimeSeconds: 2140, speedKmH: 61 },
      { id: '2', mark: 'PC2', assignedTimeSeconds: 2207, speedKmH: null },
    ];

    const result = computeNextStretchSpeed(rows, 1, -5.0);
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.organizationSpeedKmH).toBe(61);
    expect(result.adjustedSpeedKmH).toBeCloseTo(65.91935, 4);
    expect(result.direction).toBe('faster');
    expect(result.demanding).toBe(false);
  });

  it('calculates slower direction when ahead (positive deviation)', () => {
    // planned duration = 60s, orgSpeed = 60 km/h, deviation = +5s
    // adjusted duration = 65s
    // adjusted speed = 60 * 60 / 65 = 55.38 km/h (< 60 km/h)
    const rows: RoadbookRow[] = [
      { id: '1', mark: 'Start', assignedTimeSeconds: 100, speedKmH: 60 },
      { id: '2', mark: 'Next', assignedTimeSeconds: 160, speedKmH: null },
    ];

    const result = computeNextStretchSpeed(rows, 1, 5.0);
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.direction).toBe('slower');
    expect(result.demanding).toBe(false);
  });

  it('calculates equal direction when deviation is zero or rounding to 1 decimal matches', () => {
    const rows: RoadbookRow[] = [
      { id: '1', mark: 'Start', assignedTimeSeconds: 100, speedKmH: 60 },
      { id: '2', mark: 'Next', assignedTimeSeconds: 200, speedKmH: null },
    ];

    const result = computeNextStretchSpeed(rows, 1, 0);
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.direction).toBe('equal');
    expect(result.adjustedSpeedKmH).toBe(60);
    expect(result.demanding).toBe(false);
  });

  describe('demanding flag', () => {
    it('is false when adjusted speed is exactly 110% of organization speed', () => {
      // orgSpeed = 50. 110% = 55.
      // adjustedSpeed = orgSpeed * planned / (planned + dev)
      // 55 = 50 * planned / (planned + dev) -> (planned + dev)/planned = 50/55 = 10/11
      // planned = 110, planned + dev = 100 -> dev = -10
      // 50 * 110 / 100 = 55.0. Exactly 10% above -> NOT demanding
      const rows: RoadbookRow[] = [
        { id: '1', mark: 'A', assignedTimeSeconds: 0, speedKmH: 50 },
        { id: '2', mark: 'B', assignedTimeSeconds: 110, speedKmH: null },
      ];

      const result = computeNextStretchSpeed(rows, 1, -10);
      expect(result.available).toBe(true);
      if (!result.available) return;

      expect(result.adjustedSpeedKmH).toBe(55);
      expect(result.demanding).toBe(false);
    });

    it('is true when adjusted speed strictly exceeds 110% of organization speed', () => {
      // planned = 110, dev = -11 -> adjusted duration = 99
      // adjusted speed = 50 * 110 / 99 = 55.555... km/h > 55.0 (110%)
      const rows: RoadbookRow[] = [
        { id: '1', mark: 'A', assignedTimeSeconds: 0, speedKmH: 50 },
        { id: '2', mark: 'B', assignedTimeSeconds: 110, speedKmH: null },
      ];

      const result = computeNextStretchSpeed(rows, 1, -11);
      expect(result.available).toBe(true);
      if (!result.available) return;

      expect(result.adjustedSpeedKmH).toBeGreaterThan(55);
      expect(result.demanding).toBe(true);
    });
  });

  describe('unavailable (no data) cases', () => {
    const validRows: RoadbookRow[] = [
      { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: 50 },
      { id: '2', mark: 'Next', assignedTimeSeconds: 100, speedKmH: null },
    ];

    it('returns unavailable when there is no previous row with assigned time', () => {
      const res = computeNextStretchSpeed(validRows, 0, 0);
      expect(res.available).toBe(false);
    });

    it('returns unavailable when organization speed is null', () => {
      const noSpeedRows: RoadbookRow[] = [
        { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: null },
        { id: '2', mark: 'Next', assignedTimeSeconds: 100, speedKmH: null },
      ];
      const res = computeNextStretchSpeed(noSpeedRows, 1, 0);
      expect(res.available).toBe(false);
    });

    it('returns unavailable when no deviation is known yet (null)', () => {
      const res = computeNextStretchSpeed(validRows, 1, null);
      expect(res.available).toBe(false);
    });

    it('returns unavailable when planned duration is not positive', () => {
      const invalidOrderRows: RoadbookRow[] = [
        { id: '1', mark: 'Start', assignedTimeSeconds: 100, speedKmH: 50 },
        { id: '2', mark: 'Next', assignedTimeSeconds: 100, speedKmH: null }, // diff = 0
      ];
      const res = computeNextStretchSpeed(invalidOrderRows, 1, 0);
      expect(res.available).toBe(false);
    });

    it('returns unavailable when planned duration plus deviation is not positive', () => {
      // planned duration = 10s, deviation = -15s -> adjusted duration = -5s <= 0
      const res = computeNextStretchSpeed(validRows, 1, -150);
      expect(res.available).toBe(false);
    });

    it('returns unavailable for out of range or null currentRowIndex', () => {
      expect(computeNextStretchSpeed(validRows, null, 0).available).toBe(false);
      expect(computeNextStretchSpeed(validRows, 99, 0).available).toBe(false);
      expect(computeNextStretchSpeed(validRows, -1, 0).available).toBe(false);
    });
  });

  it('works when previous row was skipped (uses last known deviation and effective speed)', () => {
    // Row 0: assigned 0, speed 50
    // Row 1: assigned 100 (skipped, no speed) -> inherits speed 50
    // Row 2: assigned 250 (current row)
    // Deviation is from row 0 (-2.0s)
    // Stretch from row 1 to row 2: planned = 250 - 100 = 150s. orgSpeed = 50 km/h.
    // adjusted = 50 * 150 / (150 + (-2)) = 7500 / 148 = 50.675 km/h
    const rows: RoadbookRow[] = [
      { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: 50 },
      { id: '2', mark: 'Skipped', assignedTimeSeconds: 100, speedKmH: null },
      { id: '3', mark: 'Target', assignedTimeSeconds: 250, speedKmH: null },
    ];

    const result = computeNextStretchSpeed(rows, 2, -2.0);
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.organizationSpeedKmH).toBe(50);
    expect(result.adjustedSpeedKmH).toBeCloseTo(50.6757, 3);
    expect(result.direction).toBe('faster');
  });
});
