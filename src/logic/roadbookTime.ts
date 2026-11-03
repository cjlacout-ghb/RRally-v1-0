/**
 * Time input parsing, digit mapping and validation for the roadbook sheet.
 */

import { formatTimeHms, formatElapsedHms, formatElapsedHmsDecimal } from './format';

export const EMPTY_TIME_PLACEHOLDER = '-:--:--';
export const MAX_TIME_DIGITS = 6;
export const MAX_HOURS = 99;

export interface TimeDigitsParseResult {
  valid: boolean;
  totalSeconds: number | null;
  formatted: string;
  hours?: number;
  minutes?: number;
  seconds?: number;
  error?: string;
}

/**
 * Parses digits typed into a timer field filling from the right (H:MM:SS).
 * Examples:
 * - "3540" -> 0:35:40 (2140 s)
 * - "10500" -> 1:05:00 (3900 s)
 * - "" -> empty placeholder "-:--:--" (null seconds)
 * Validates minutes < 60, seconds < 60, hours <= MAX_HOURS (99).
 * Non-digit characters are ignored. Digits beyond MAX_TIME_DIGITS are rejected as invalid.
 */
export function parseTimeDigits(input: string | null | undefined): TimeDigitsParseResult {
  if (input === null || input === undefined) {
    return { valid: true, totalSeconds: null, formatted: EMPTY_TIME_PLACEHOLDER };
  }

  const cleaned = input.replace(/\D/g, '');
  if (cleaned.length === 0) {
    return { valid: true, totalSeconds: null, formatted: EMPTY_TIME_PLACEHOLDER };
  }

  if (cleaned.length > MAX_TIME_DIGITS) {
    return {
      valid: false,
      totalSeconds: null,
      formatted: EMPTY_TIME_PLACEHOLDER,
      error: 'Demasiados dígitos',
    };
  }

  const secStr = cleaned.slice(-2);
  const rem1 = cleaned.slice(0, -2);
  const minStr = rem1.length > 0 ? rem1.slice(-2) : '0';
  const hourStr = rem1.length > 2 ? rem1.slice(0, -2) : '0';

  const seconds = parseInt(secStr, 10);
  const minutes = parseInt(minStr, 10);
  const hours = parseInt(hourStr, 10);

  if (seconds >= 60) {
    return {
      valid: false,
      totalSeconds: null,
      formatted: EMPTY_TIME_PLACEHOLDER,
      error: 'Segundos deben ser menores a 60',
    };
  }
  if (minutes >= 60) {
    return {
      valid: false,
      totalSeconds: null,
      formatted: EMPTY_TIME_PLACEHOLDER,
      error: 'Minutos deben ser menores a 60',
    };
  }
  if (hours > MAX_HOURS) {
    return {
      valid: false,
      totalSeconds: null,
      formatted: EMPTY_TIME_PLACEHOLDER,
      error: `Horas no pueden superar ${MAX_HOURS}`,
    };
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    valid: true,
    totalSeconds,
    formatted,
    hours,
    minutes,
    seconds,
  };
}

export { formatTimeHms, formatElapsedHms, formatElapsedHmsDecimal };
