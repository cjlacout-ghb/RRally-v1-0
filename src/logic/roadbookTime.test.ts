import { describe, it, expect } from 'vitest';
import {
  parseTimeDigits,
  formatTimeHms,
  formatElapsedHms,
  formatElapsedHmsDecimal,
  EMPTY_TIME_PLACEHOLDER,
} from './roadbookTime';

describe('roadbookTime', () => {
  describe('parseTimeDigits', () => {
    it('handles worked example 1: typing 3, 5, 4, 0 gives 0:35:40', () => {
      const res = parseTimeDigits('3540');
      expect(res.valid).toBe(true);
      expect(res.formatted).toBe('0:35:40');
      expect(res.totalSeconds).toBe(2140);
      expect(res.hours).toBe(0);
      expect(res.minutes).toBe(35);
      expect(res.seconds).toBe(40);
    });

    it('handles worked example 2: typing 1, 0, 5, 0, 0 gives 1:05:00', () => {
      const res = parseTimeDigits('10500');
      expect(res.valid).toBe(true);
      expect(res.formatted).toBe('1:05:00');
      expect(res.totalSeconds).toBe(3900);
      expect(res.hours).toBe(1);
      expect(res.minutes).toBe(5);
      expect(res.seconds).toBe(0);
    });

    it('handles single digits or small numbers filling from the right', () => {
      const zero = parseTimeDigits('0');
      expect(zero.valid).toBe(true);
      expect(zero.formatted).toBe('0:00:00');
      expect(zero.totalSeconds).toBe(0);

      const sec = parseTimeDigits('45');
      expect(sec.valid).toBe(true);
      expect(sec.formatted).toBe('0:00:45');
      expect(sec.totalSeconds).toBe(45);

      const minSec = parseTimeDigits('215');
      expect(minSec.valid).toBe(true);
      expect(minSec.formatted).toBe('0:02:15');
      expect(minSec.totalSeconds).toBe(135);
    });

    it('returns empty placeholder for empty or null input', () => {
      const empty = parseTimeDigits('');
      expect(empty.valid).toBe(true);
      expect(empty.formatted).toBe(EMPTY_TIME_PLACEHOLDER);
      expect(empty.totalSeconds).toBeNull();

      const nullInput = parseTimeDigits(null);
      expect(nullInput.valid).toBe(true);
      expect(nullInput.formatted).toBe(EMPTY_TIME_PLACEHOLDER);
      expect(nullInput.totalSeconds).toBeNull();
    });

    it('ignores non-digit characters', () => {
      const formattedInput = parseTimeDigits('1:05:00');
      expect(formattedInput.valid).toBe(true);
      expect(formattedInput.formatted).toBe('1:05:00');
      expect(formattedInput.totalSeconds).toBe(3900);

      const dirty = parseTimeDigits('3-5 a 4 0');
      expect(dirty.valid).toBe(true);
      expect(dirty.formatted).toBe('0:35:40');
      expect(dirty.totalSeconds).toBe(2140);
    });

    it('validates seconds < 60', () => {
      const res = parseTimeDigits('75'); // 75 seconds >= 60
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Segundos');
      expect(res.totalSeconds).toBeNull();
    });

    it('validates minutes < 60', () => {
      const res = parseTimeDigits('8000'); // 80 minutes >= 60
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Minutos');
      expect(res.totalSeconds).toBeNull();
    });

    it('enforces maximum digits limit (6 digits)', () => {
      const res = parseTimeDigits('1234567'); // 7 digits
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Demasiados dígitos');
    });

    it('validates maximum hours <= 99', () => {
      const valid99 = parseTimeDigits('995959');
      expect(valid99.valid).toBe(true);
      expect(valid99.formatted).toBe('99:59:59');

      // More than 99 hours with 6 digits is impossible since 2 digits <= 99
    });
  });

  describe('formatTimeHms', () => {
    it('formats whole seconds to H:MM:SS', () => {
      expect(formatTimeHms(0)).toBe('0:00:00');
      expect(formatTimeHms(2140)).toBe('0:35:40');
      expect(formatTimeHms(3900)).toBe('1:05:00');
      expect(formatTimeHms(3661)).toBe('1:01:01');
    });

    it('returns placeholder for null, undefined, negative, or NaN', () => {
      expect(formatTimeHms(null)).toBe('-:--:--');
      expect(formatTimeHms(undefined)).toBe('-:--:--');
      expect(formatTimeHms(NaN)).toBe('-:--:--');
      expect(formatTimeHms(-5)).toBe('-:--:--');
    });
  });

  describe('formatElapsedHms and formatElapsedHmsDecimal', () => {
    it('formats elapsed ms to H:MM:SS whole seconds (truncated)', () => {
      expect(formatElapsedHms(2140800)).toBe('0:35:40'); // 2140.8 s
      expect(formatElapsedHms(0)).toBe('0:00:00');
      expect(formatElapsedHms(null)).toBe('-:--:--');
    });

    it('formats elapsed ms to H:MM:SS,d with Argentine decimal comma', () => {
      expect(formatElapsedHmsDecimal(2145200)).toBe('0:35:45,2');
      expect(formatElapsedHmsDecimal(2145000)).toBe('0:35:45,0');
      expect(formatElapsedHmsDecimal(3900750)).toBe('1:05:00,8'); // .x5 rounds up
      expect(formatElapsedHmsDecimal(3900740)).toBe('1:05:00,7'); // .x4 rounds down
      expect(formatElapsedHmsDecimal(0)).toBe('0:00:00,0');
      expect(formatElapsedHmsDecimal(null)).toBe('-:--:--');
    });
  });
});
