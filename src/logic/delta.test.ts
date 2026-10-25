import { describe, it, expect } from 'vitest';
import {
  classifyDelta,
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
