import { describe, it, expect } from 'vitest';
import {
  classifyDelta,
  computeDeltaSeconds,
  NEUTRAL_BAND_SECONDS,
  DELTA_LABELS,
  type DeltaState,
} from './delta';

describe('classifyDelta', () => {
  it('has a neutral band constant equal to 0.10 s', () => {
    expect(NEUTRAL_BAND_SECONDS).toBe(0.10);
  });

  it('returns "no-data" when delta is null, undefined, or NaN', () => {
    expect(classifyDelta(null)).toBe('no-data');
    expect(classifyDelta(undefined)).toBe('no-data');
    expect(classifyDelta(NaN)).toBe('no-data');
  });

  it('returns "neutral" when delta is within the neutral band [ -0.10, +0.10 ]', () => {
    expect(classifyDelta(0)).toBe('neutral');
    expect(classifyDelta(0.05)).toBe('neutral');
    expect(classifyDelta(-0.05)).toBe('neutral');
    expect(classifyDelta(0.10)).toBe('neutral');
    expect(classifyDelta(-0.10)).toBe('neutral');
  });

  it('returns "ahead" when delta is greater than +0.10 s', () => {
    expect(classifyDelta(0.11)).toBe('ahead');
    expect(classifyDelta(1.8)).toBe('ahead');
    expect(classifyDelta(15.2)).toBe('ahead');
  });

  it('returns "behind" when delta is less than -0.10 s', () => {
    expect(classifyDelta(-0.11)).toBe('behind');
    expect(classifyDelta(-2.3)).toBe('behind');
    expect(classifyDelta(-12.0)).toBe('behind');
  });

  it('supports custom neutral band if provided', () => {
    expect(classifyDelta(0.15, 0.20)).toBe('neutral');
    expect(classifyDelta(0.25, 0.20)).toBe('ahead');
  });

  it('has the correct Spanish labels for all states', () => {
    expect(DELTA_LABELS['ahead']).toBe('ADELANTADO');
    expect(DELTA_LABELS['behind']).toBe('ATRASADO');
    expect(DELTA_LABELS['neutral']).toBe('EN TIEMPO');
    expect(DELTA_LABELS['no-data']).toBe('SIN DATOS');
  });
});

describe('computeDeltaSeconds', () => {
  it('computes exact zero delta when on time', () => {
    // 60 km/h: 1 km in 60s
    expect(computeDeltaSeconds(1.0, 60.0, 60.0)).toBe(0);
  });

  it('computes positive delta when ahead of schedule', () => {
    // 60 km/h: ideal time for 1 km is 60s. Arrived in 55s -> +5s ahead
    expect(computeDeltaSeconds(1.0, 60.0, 55.0)).toBe(5.0);
  });

  it('computes negative delta when behind schedule', () => {
    // 60 km/h: ideal time for 1 km is 60s. Arrived in 65s -> -5s behind
    expect(computeDeltaSeconds(1.0, 60.0, 65.0)).toBe(-5.0);
  });

  it('returns null if assigned stage speed is missing, zero, or negative', () => {
    expect(computeDeltaSeconds(1.0, null, 60.0)).toBeNull();
    expect(computeDeltaSeconds(1.0, undefined, 60.0)).toBeNull();
    expect(computeDeltaSeconds(1.0, 0, 60.0)).toBeNull();
    expect(computeDeltaSeconds(1.0, -50, 60.0)).toBeNull();
  });

  it('returns null if distance is null or negative', () => {
    expect(computeDeltaSeconds(null, 50.0, 60.0)).toBeNull();
    expect(computeDeltaSeconds(-1.0, 50.0, 60.0)).toBeNull();
  });

  it('returns null if elapsed time is null or negative', () => {
    expect(computeDeltaSeconds(1.0, 50.0, null)).toBeNull();
    expect(computeDeltaSeconds(1.0, 50.0, -10.0)).toBeNull();
  });
});
