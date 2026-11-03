import { describe, it, expect } from 'vitest';
import {
  formatSpeed,
  formatDistance,
  formatFactor,
  formatDelta,
  formatStopwatch,
  formatTimeOfDay,
  formatTimeHms,
  formatElapsedHms,
  formatElapsedHmsDecimal,
} from './format';

describe('formatSpeed', () => {
  it('formats speed with 1 decimal place and decimal comma', () => {
    expect(formatSpeed(49.8)).toBe('49,8');
    expect(formatSpeed(0)).toBe('0,0');
    expect(formatSpeed(120)).toBe('120,0');
    expect(formatSpeed(49.84)).toBe('49,8');
    expect(formatSpeed(49.86)).toBe('49,9');
  });

  it('returns "--,-" for null, undefined, or NaN', () => {
    expect(formatSpeed(null)).toBe('--,-');
    expect(formatSpeed(undefined)).toBe('--,-');
    expect(formatSpeed(NaN)).toBe('--,-');
  });
});

describe('formatDistance', () => {
  it('formats distance with 2 decimal places by default and decimal comma', () => {
    expect(formatDistance(14.82)).toBe('14,82');
    expect(formatDistance(14.820)).toBe('14,82');
    expect(formatDistance(0)).toBe('0,00');
    expect(formatDistance(7.892)).toBe('7,89');
    expect(formatDistance(123.456)).toBe('123,46');
  });

  it('supports custom decimal places (e.g. 3 for calibration)', () => {
    expect(formatDistance(14.82, 3)).toBe('14,820');
    expect(formatDistance(7.892, 3)).toBe('7,892');
    expect(formatDistance(0, 3)).toBe('0,000');
  });

  it('rounds to the nearest hundredth (nearest 10 meters) avoiding floating-point truncation', () => {
    // Value just above 0,005 km (e.g., 0.0051 km) rounds to 0,01 km
    expect(formatDistance(0.0051)).toBe('0,01');
    expect(formatDistance(0.005)).toBe('0,01');
    // Value just below 0,01 km (e.g. 0.0099 km) rounds to 0,01 km
    expect(formatDistance(0.0099)).toBe('0,01');
    // Floating point noise near step boundary: 0.010000000000000002 or 0.009999999999999998
    expect(formatDistance(0.009999999999999998)).toBe('0,01');
  });

  it('returns placeholder matching decimal count for null, undefined, or NaN', () => {
    expect(formatDistance(null)).toBe('--,--');
    expect(formatDistance(undefined)).toBe('--,--');
    expect(formatDistance(NaN)).toBe('--,--');
    expect(formatDistance(null, 3)).toBe('--,---');
    expect(formatDistance(undefined, 3)).toBe('--,---');
  });
});

describe('formatFactor', () => {
  it('formats factor with 4 decimal places and decimal comma', () => {
    expect(formatFactor(1.0)).toBe('1,0000');
    expect(formatFactor(1.0063)).toBe('1,0063');
    expect(formatFactor(1.006289)).toBe('1,0063');
    expect(formatFactor(0.9950)).toBe('0,9950');
    expect(formatFactor(0.9950248)).toBe('0,9950');
  });

  it('returns "--,----" for null, undefined, or NaN', () => {
    expect(formatFactor(null)).toBe('--,----');
    expect(formatFactor(undefined)).toBe('--,----');
    expect(formatFactor(NaN)).toBe('--,----');
  });
});

describe('formatDelta', () => {
  it('formats positive delta with + and 1 decimal place', () => {
    expect(formatDelta(1.8)).toBe('+1,8');
    expect(formatDelta(0.1)).toBe('+0,1');
    expect(formatDelta(12.34)).toBe('+12,3');
  });

  it('formats negative delta with - and 1 decimal place', () => {
    expect(formatDelta(-2.3)).toBe('-2,3');
    expect(formatDelta(-0.1)).toBe('-0,1');
    expect(formatDelta(-15.67)).toBe('-15,7');
  });

  it('formats delta as 0,0 without sign when it rounds to zero', () => {
    expect(formatDelta(0)).toBe('0,0');
    expect(formatDelta(0.04)).toBe('0,0');
    expect(formatDelta(-0.04)).toBe('0,0');
    expect(formatDelta(-0.001)).toBe('0,0');
  });

  it('returns "--,-" for null, undefined, or NaN', () => {
    expect(formatDelta(null)).toBe('--,-');
    expect(formatDelta(undefined)).toBe('--,-');
    expect(formatDelta(NaN)).toBe('--,-');
  });
});

describe('formatStopwatch', () => {
  it('formats under 1 hour as MM:SS,cc', () => {
    expect(formatStopwatch(0)).toBe('00:00,00');
    // 18m 42s 340ms = 18 * 60000 + 42000 + 340 = 1122340
    expect(formatStopwatch(18 * 60000 + 42000 + 340)).toBe('18:42,34');
    // 2m 14s 800ms
    expect(formatStopwatch(2 * 60000 + 14000 + 800)).toBe('02:14,80');
    // 59m 59s 990ms
    expect(formatStopwatch(59 * 60000 + 59000 + 990)).toBe('59:59,99');
  });

  it('formats 1 hour or more as HH:MM:SS,cc', () => {
    // 1 hour exactly
    expect(formatStopwatch(3600000)).toBe('01:00:00,00');
    // 1 hour 14m 42s 340ms
    expect(formatStopwatch(3600000 + 14 * 60000 + 42000 + 340)).toBe('01:14:42,34');
    // 10 hours 05m 03s 050ms
    expect(formatStopwatch(10 * 3600000 + 5 * 60000 + 3000 + 50)).toBe('10:05:03,05');
  });

  it('handles negative or fractional milliseconds safely', () => {
    expect(formatStopwatch(-500)).toBe('00:00,00');
    expect(formatStopwatch(1500.8)).toBe('00:01,50');
  });

  it('truncates milliseconds instead of rounding up (never displays time greater than real elapsed)', () => {
    // 9.9ms should display 00 hundredths, not round up to 01
    expect(formatStopwatch(9.9)).toBe('00:00,00');
    // 19.99ms should display 01 hundredths, not round up to 02
    expect(formatStopwatch(19.99)).toBe('00:00,01');
    // Value ending in .x9 hundredths (e.g. 59,999ms) should display 59:59,99 and not roll over to 01:00:00,00
    expect(formatStopwatch(59 * 60000 + 59000 + 999)).toBe('59:59,99');
    // 1429ms (1.429s) truncates to 00:01,42 (never 00:01,43)
    expect(formatStopwatch(1429)).toBe('00:01,42');
  });
});

describe('formatTimeOfDay', () => {
  it('formats Date as HH:MM:SS without decimals', () => {
    const d = new Date(2026, 9, 25, 7, 50, 46, 742);
    expect(formatTimeOfDay(d)).toBe('07:50:46');

    const d2 = new Date(2026, 9, 25, 14, 5, 9, 50);
    expect(formatTimeOfDay(d2)).toBe('14:05:09');
  });

  it('truncates (floors) seconds instead of rounding up near the second boundary', () => {
    // 59,999 seconds should still show 59 seconds, not roll over to 00
    const d = new Date(2026, 9, 25, 11, 59, 59, 999);
    expect(formatTimeOfDay(d)).toBe('11:59:59');

    // 00,999 seconds should show 00
    const d2 = new Date(2026, 9, 25, 12, 0, 0, 999);
    expect(formatTimeOfDay(d2)).toBe('12:00:00');
  });
});

describe('formatTimeHms', () => {
  it('formats whole seconds to H:MM:SS', () => {
    expect(formatTimeHms(0)).toBe('0:00:00');
    expect(formatTimeHms(2140)).toBe('0:35:40');
    expect(formatTimeHms(3900)).toBe('1:05:00');
    expect(formatTimeHms(3665)).toBe('1:01:05');
  });

  it('returns placeholder for null, undefined, negative, or NaN', () => {
    expect(formatTimeHms(null)).toBe('-:--:--');
    expect(formatTimeHms(undefined)).toBe('-:--:--');
    expect(formatTimeHms(-1)).toBe('-:--:--');
    expect(formatTimeHms(NaN)).toBe('-:--:--');
  });
});

describe('formatElapsedHms and formatElapsedHmsDecimal', () => {
  it('formats elapsed ms to whole seconds H:MM:SS', () => {
    expect(formatElapsedHms(2140000)).toBe('0:35:40');
    expect(formatElapsedHms(2140800)).toBe('0:35:40'); // truncated
    expect(formatElapsedHms(null)).toBe('-:--:--');
  });

  it('formats elapsed ms with Argentine decimal comma H:MM:SS,d', () => {
    expect(formatElapsedHmsDecimal(2145200)).toBe('0:35:45,2');
    expect(formatElapsedHmsDecimal(2145000)).toBe('0:35:45,0');
    expect(formatElapsedHmsDecimal(null)).toBe('-:--:--');
  });

  it('uses standard rounding for the decimal (x.x5 rounds up, x.x4 rounds down)', () => {
    // 10,550ms → real tenths = 105.5 → rounds to 106 tenths = 10.6s
    expect(formatElapsedHmsDecimal(10550)).toBe('0:00:10,6');
    // 10,449ms → real tenths = 104.49 → rounds to 104 tenths = 10.4s
    expect(formatElapsedHmsDecimal(10449)).toBe('0:00:10,4');
    // 10,450ms → real tenths = 104.5 → rounds to 105 tenths = 10.5s (x.x5 rounds up)
    expect(formatElapsedHmsDecimal(10450)).toBe('0:00:10,5');
    // Boundary that crosses seconds: 59,950ms → 599.5 tenths → 600 tenths = 60.0s = 1:00,0
    expect(formatElapsedHmsDecimal(59950)).toBe('0:01:00,0');
  });

  it('is consistent with roundToDisplayedRealSeconds from roadbookRace', () => {
    // Same rounding used by both functions: Math.round(ms / 100)
    // 10,550ms → 10.6s in both formatElapsedHmsDecimal and roundToDisplayedRealSeconds
    expect(formatElapsedHmsDecimal(10550)).toContain('10,6');
    expect(formatElapsedHmsDecimal(10449)).toContain('10,4');
  });
});

