import { describe, it, expect } from 'vitest';
import {
  getDialMarkerAngle,
  getDialMarker,
  getDialTicks,
  DIAL_START_ANGLE_DEGREES,
  DIAL_DEGREES_PER_KMH,
  DIAL_MIN_SPEED,
  DIAL_MAX_SPEED,
} from './dial';

describe('getDialMarkerAngle', () => {
  it('returns null for null, undefined, and NaN', () => {
    expect(getDialMarkerAngle(null)).toBeNull();
    expect(getDialMarkerAngle(undefined)).toBeNull();
    expect(getDialMarkerAngle(NaN)).toBeNull();
  });

  it('maps 0 km/h to DIAL_START_ANGLE_DEGREES (-135)', () => {
    expect(getDialMarkerAngle(0)).toBe(DIAL_START_ANGLE_DEGREES);
  });

  it('maps 120 km/h to +135 degrees (= -135 + 120 * 2.25)', () => {
    expect(getDialMarkerAngle(120)).toBeCloseTo(135, 5);
  });

  it('maps 60 km/h to 0 degrees (center of sweep)', () => {
    expect(getDialMarkerAngle(60)).toBeCloseTo(0, 5);
  });

  it('maps 40 km/h to -135 + 40 * 2.25 = -45 degrees', () => {
    expect(getDialMarkerAngle(40)).toBeCloseTo(-135 + 40 * DIAL_DEGREES_PER_KMH, 5);
  });

  it('clamps values below 0 to 0', () => {
    expect(getDialMarkerAngle(-10)).toBe(DIAL_START_ANGLE_DEGREES);
  });

  it('clamps values above 120 to 120', () => {
    expect(getDialMarkerAngle(150)).toBeCloseTo(135, 5);
  });

  it('maps DIAL_MIN_SPEED and DIAL_MAX_SPEED correctly', () => {
    expect(getDialMarkerAngle(DIAL_MIN_SPEED)).toBe(DIAL_START_ANGLE_DEGREES);
    expect(getDialMarkerAngle(DIAL_MAX_SPEED)).toBeCloseTo(135, 5);
  });
});

describe('getDialMarker', () => {
  it('returns null when speed is null', () => {
    expect(getDialMarker(null)).toBeNull();
    expect(getDialMarker(undefined)).toBeNull();
    expect(getDialMarker(NaN)).toBeNull();
  });

  it('returns a marker with valid coordinates for speed 0', () => {
    const marker = getDialMarker(0);
    expect(marker).not.toBeNull();
    expect(typeof marker!.x1).toBe('number');
    expect(typeof marker!.y1).toBe('number');
    expect(typeof marker!.x2).toBe('number');
    expect(typeof marker!.y2).toBe('number');
    expect(marker!.angleDegrees).toBe(DIAL_START_ANGLE_DEGREES);
  });

  it('returns a marker with valid coordinates for speed 120', () => {
    const marker = getDialMarker(120);
    expect(marker).not.toBeNull();
    expect(marker!.angleDegrees).toBeCloseTo(135, 5);
  });

  it('returns a marker for an intermediate speed like 49.8', () => {
    const marker = getDialMarker(49.8);
    expect(marker).not.toBeNull();
    expect(marker!.angleDegrees).toBeCloseTo(-135 + 49.8 * DIAL_DEGREES_PER_KMH, 4);
  });
});

describe('getDialTicks', () => {
  it('returns 13 ticks (0, 10, 20, ..., 120)', () => {
    const ticks = getDialTicks();
    expect(ticks.length).toBe(13);
  });

  it('marks 0, 40, 80, 120 as major ticks', () => {
    const ticks = getDialTicks();
    const majorSpeeds = ticks.filter(t => t.isMajor).map(t => t.speed);
    expect(majorSpeeds).toEqual([0, 40, 80, 120]);
  });

  it('provides numerals only for major ticks (0, 40, 80, 120)', () => {
    const ticks = getDialTicks();
    ticks.forEach(tick => {
      if (tick.isMajor) {
        expect(tick.numeral).toBeDefined();
        expect(tick.numeral!.label).toBe(tick.speed.toString());
      } else {
        expect(tick.numeral).toBeUndefined();
      }
    });
  });

  it('each tick has numeric coordinates', () => {
    const ticks = getDialTicks();
    ticks.forEach(tick => {
      expect(typeof tick.x1).toBe('number');
      expect(typeof tick.y1).toBe('number');
      expect(typeof tick.x2).toBe('number');
      expect(typeof tick.y2).toBe('number');
    });
  });
});
