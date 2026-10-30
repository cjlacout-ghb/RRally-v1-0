import { describe, it, expect } from 'vitest';
import {
  computeCorrectionFactor,
  validateCorrectionFactor,
  isCalibrationAllowed,
  CALIBRATION_ERROR_MESSAGES,
} from './calibration';
import { formatFactor } from './format';
import {
  CALIBRATION_MIN_MEASURED_DISTANCE_KM,
  CALIBRATION_MIN_FACTOR,
  CALIBRATION_MAX_FACTOR,
} from './gpsConstants';

describe('Correction factor calculation (pure logic)', () => {
  describe('Known values & precision', () => {
    it('computes factor for 8.000 km official / 7.950 km measured (~1.0063)', () => {
      const result = computeCorrectionFactor(8.0, 7.95);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Full precision internal representation
        expect(result.factor).toBeCloseTo(8.0 / 7.95, 8);
        expect(result.factor).toBe(8.0 / 7.95);
        // Formatted display uses 4 decimals with decimal comma
        expect(formatFactor(result.factor)).toBe('1,0063');
      }
    });

    it('computes factor for 4.000 km official / 4.020 km measured (~0.9950)', () => {
      const result = computeCorrectionFactor(4.0, 4.02);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.factor).toBeCloseTo(4.0 / 4.02, 8);
        expect(result.factor).toBe(4.0 / 4.02);
        expect(formatFactor(result.factor)).toBe('0,9950');
      }
    });

    it('computes exact 1.0000 when official equals measured', () => {
      const result = computeCorrectionFactor(5.0, 5.0);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.factor).toBe(1.0);
        expect(formatFactor(result.factor)).toBe('1,0000');
      }
    });

    it('accepts string inputs with Argentine decimal comma', () => {
      const result = computeCorrectionFactor('8,000', '7,950');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(formatFactor(result.factor)).toBe('1,0063');
      }
    });

    it('never rounds internally, preserving full precision for downstream calculations', () => {
      const result = computeCorrectionFactor(8.0, 7.95);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const roundedDisplay = Number(result.factor.toFixed(4));
        // result.factor must NOT equal roundedDisplay, confirming no premature rounding
        expect(result.factor).not.toBe(roundedDisplay);
      }
    });
  });

  describe('Invalid inputs & boundary cases', () => {
    it('rejects zero values with "zero" error', () => {
      const res1 = computeCorrectionFactor(0, 5.0);
      expect(res1).toEqual({ ok: false, error: 'zero' });

      const res2 = computeCorrectionFactor(5.0, 0);
      expect(res2).toEqual({ ok: false, error: 'zero' });

      const res3 = computeCorrectionFactor('0', '5.0');
      expect(res3).toEqual({ ok: false, error: 'zero' });
    });

    it('rejects negative values with "negative" error', () => {
      const res1 = computeCorrectionFactor(-1.0, 5.0);
      expect(res1).toEqual({ ok: false, error: 'negative' });

      const res2 = computeCorrectionFactor(5.0, -2.5);
      expect(res2).toEqual({ ok: false, error: 'negative' });
    });

    it('rejects NaN and non-numeric inputs with "invalid" error', () => {
      const res1 = computeCorrectionFactor(NaN, 5.0);
      expect(res1).toEqual({ ok: false, error: 'invalid' });

      const res2 = computeCorrectionFactor(5.0, NaN);
      expect(res2).toEqual({ ok: false, error: 'invalid' });

      const res3 = computeCorrectionFactor('abc', 5.0);
      expect(res3).toEqual({ ok: false, error: 'invalid' });

      const res4 = computeCorrectionFactor(Infinity, 5.0);
      expect(res4).toEqual({ ok: false, error: 'invalid' });
    });

    it('rejects missing or empty inputs with "missing" or "empty" error', () => {
      const res1 = computeCorrectionFactor(null, 5.0);
      expect(res1).toEqual({ ok: false, error: 'missing' });

      const res2 = computeCorrectionFactor(5.0, undefined);
      expect(res2).toEqual({ ok: false, error: 'missing' });

      const res3 = computeCorrectionFactor('', 5.0);
      expect(res3).toEqual({ ok: false, error: 'empty' });

      const res4 = computeCorrectionFactor('   ', 5.0);
      expect(res4).toEqual({ ok: false, error: 'empty' });
    });

    it('rejects measured distance below minimum threshold (100 m)', () => {
      const belowMin = CALIBRATION_MIN_MEASURED_DISTANCE_KM - 0.001; // 99 meters
      const res = computeCorrectionFactor(0.1, belowMin);
      expect(res).toEqual({ ok: false, error: 'too-small' });
    });

    it('accepts measured distance exactly at minimum threshold (100 m)', () => {
      const res = computeCorrectionFactor(0.1, CALIBRATION_MIN_MEASURED_DISTANCE_KM);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.factor).toBe(1.0);
      }
    });

    it('flags factors outside sane range [0.8000, 1.2000] as "out-of-range"', () => {
      // 10.0 official / 5.0 measured = 2.0 (too high)
      const resHigh = computeCorrectionFactor(10.0, 5.0);
      expect(resHigh.ok).toBe(false);
      expect(resHigh.error).toBe('out-of-range');
      if (!resHigh.ok) {
        expect(resHigh.factor).toBe(2.0);
      }

      // 5.0 official / 10.0 measured = 0.5 (too low)
      const resLow = computeCorrectionFactor(5.0, 10.0);
      expect(resLow.ok).toBe(false);
      expect(resLow.error).toBe('out-of-range');
      if (!resLow.ok) {
        expect(resLow.factor).toBe(0.5);
      }
    });

    it('accepts factors right on sane boundary edges', () => {
      const resMin = computeCorrectionFactor(CALIBRATION_MIN_FACTOR, 1.0);
      expect(resMin.ok).toBe(true);
      if (resMin.ok) {
        expect(resMin.factor).toBe(CALIBRATION_MIN_FACTOR);
      }

      const resMax = computeCorrectionFactor(CALIBRATION_MAX_FACTOR, 1.0);
      expect(resMax.ok).toBe(true);
      if (resMax.ok) {
        expect(resMax.factor).toBe(CALIBRATION_MAX_FACTOR);
      }
    });

    it('provides user-friendly Spanish error messages for every error code', () => {
      const errors = ['missing', 'empty', 'invalid', 'zero', 'negative', 'too-small', 'out-of-range'] as const;
      for (const err of errors) {
        expect(CALIBRATION_ERROR_MESSAGES[err]).toBeDefined();
        expect(CALIBRATION_ERROR_MESSAGES[err].length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateCorrectionFactor', () => {
    it('validates numbers inside [0.8, 1.2]', () => {
      expect(validateCorrectionFactor(1.0)).toEqual({ ok: true, value: 1.0 });
      expect(validateCorrectionFactor(1.0063)).toEqual({ ok: true, value: 1.0063 });
      expect(validateCorrectionFactor(0.8)).toEqual({ ok: true, value: 0.8 });
      expect(validateCorrectionFactor(1.2)).toEqual({ ok: true, value: 1.2 });
    });

    it('rejects numbers outside range or non-numbers', () => {
      expect(validateCorrectionFactor(0.799)).toEqual({ ok: false, error: 'out-of-range' });
      expect(validateCorrectionFactor(1.201)).toEqual({ ok: false, error: 'out-of-range' });
      expect(validateCorrectionFactor(NaN)).toEqual({ ok: false, error: 'invalid' });
      expect(validateCorrectionFactor(Infinity)).toEqual({ ok: false, error: 'invalid' });
    });
  });

  describe('isCalibrationAllowed (single source of truth)', () => {
    it('is blocked while race is running', () => {
      expect(isCalibrationAllowed(true)).toBe(false);
    });

    it('is allowed when race is stopped or idle', () => {
      expect(isCalibrationAllowed(false)).toBe(true);
    });
  });
});
