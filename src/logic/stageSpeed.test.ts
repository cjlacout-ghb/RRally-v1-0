import { describe, it, expect } from 'vitest';
import { parseStageSpeed, validateStageSpeed, STAGE_SPEED_MAX } from './stageSpeed';

describe('parseStageSpeed', () => {
  it('parses a decimal-comma value (Argentine format)', () => {
    const r = parseStageSpeed('49,8');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(49.8, 5);
  });

  it('parses a decimal-point value', () => {
    const r = parseStageSpeed('49.8');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(49.8, 5);
  });

  it('trims surrounding spaces', () => {
    const r = parseStageSpeed('  60,0  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(60, 5);
  });

  it('returns error "empty" for empty string', () => {
    expect(parseStageSpeed('')).toEqual({ ok: false, error: 'empty' });
    expect(parseStageSpeed('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('returns error "invalid" for non-numeric text', () => {
    expect(parseStageSpeed('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseStageSpeed('4a5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseStageSpeed('--')).toEqual({ ok: false, error: 'invalid' });
  });

  it('returns error "zero" for zero', () => {
    expect(parseStageSpeed('0')).toEqual({ ok: false, error: 'zero' });
    expect(parseStageSpeed('0,0')).toEqual({ ok: false, error: 'zero' });
  });

  it('returns error "negative" for negative values', () => {
    expect(parseStageSpeed('-5')).toEqual({ ok: false, error: 'negative' });
    expect(parseStageSpeed('-0,1')).toEqual({ ok: false, error: 'negative' });
  });

  it('returns error "too-high" for values above 120', () => {
    expect(parseStageSpeed('121')).toEqual({ ok: false, error: 'too-high' });
    expect(parseStageSpeed('200')).toEqual({ ok: false, error: 'too-high' });
    expect(parseStageSpeed('120,1')).toEqual({ ok: false, error: 'too-high' });
  });

  it('accepts boundary value just above 0', () => {
    const r = parseStageSpeed('0,1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.1, 5);
  });

  it('accepts boundary value exactly 120', () => {
    const r = parseStageSpeed('120');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(120);
  });

  it('accepts a value with one decimal place', () => {
    const r = parseStageSpeed('85,5');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(85.5, 5);
  });

  it('STAGE_SPEED_MAX is 120', () => {
    expect(STAGE_SPEED_MAX).toBe(120);
  });
});

describe('validateStageSpeed', () => {
  it('validates a valid number', () => {
    expect(validateStageSpeed(60)).toEqual({ ok: true, value: 60 });
  });

  it('rejects zero', () => {
    expect(validateStageSpeed(0)).toEqual({ ok: false, error: 'zero' });
  });

  it('rejects negative', () => {
    expect(validateStageSpeed(-1)).toEqual({ ok: false, error: 'negative' });
  });

  it('rejects above 120', () => {
    expect(validateStageSpeed(121)).toEqual({ ok: false, error: 'too-high' });
  });

  it('accepts exactly 120', () => {
    expect(validateStageSpeed(120)).toEqual({ ok: true, value: 120 });
  });
});
