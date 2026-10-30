/**
 * Pure logic for odometer calibration.
 *
 * Formulas:
 *   Correction factor = official distance / measured distance.
 *   Corrected distance = accumulated GPS distance * correction factor + manual adjustments.
 *
 * Sane range:
 *   Factor must be within [0.8000, 1.2000] (+/-20%).
 *   Measured distance must be at least 0.100 km (100 meters).
 */

import {
  CALIBRATION_MIN_MEASURED_DISTANCE_KM,
  CALIBRATION_MIN_FACTOR,
  CALIBRATION_MAX_FACTOR,
} from './gpsConstants';

export type FactorErrorReason =
  | 'missing'
  | 'empty'
  | 'invalid'
  | 'zero'
  | 'negative'
  | 'too-small'
  | 'out-of-range';

export type FactorCalculationResult =
  | { ok: true; factor: number }
  | { ok: false; error: FactorErrorReason; factor?: number };

/**
 * Spanish error messages for calibration error reasons.
 */
export const CALIBRATION_ERROR_MESSAGES: Record<FactorErrorReason, string> = {
  missing: 'Faltan datos para calcular el factor.',
  empty: 'Ingresá la distancia oficial.',
  invalid: 'El valor ingresado no es un número válido.',
  zero: 'La distancia debe ser mayor que cero.',
  negative: 'La distancia debe ser mayor que cero.',
  'too-small': `La distancia medida es insuficiente (mínimo ${Math.round(
    CALIBRATION_MIN_MEASURED_DISTANCE_KM * 1000
  )} m).`,
  'out-of-range': `El factor calculado está fuera del rango permitido (${CALIBRATION_MIN_FACTOR.toFixed(
    1
  ).replace('.', ',')} a ${CALIBRATION_MAX_FACTOR.toFixed(1).replace('.', ',')}).`,
};

/**
 * Parses an input value (number or string with comma/dot) to a number, or null if invalid/missing.
 */
function parseDistanceInput(input: number | string | null | undefined): {
  parsed: number | null;
  error?: FactorErrorReason;
} {
  if (input === null || input === undefined) {
    return { parsed: null, error: 'missing' };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '') {
      return { parsed: null, error: 'empty' };
    }
    const normalised = trimmed.replace(',', '.');
    const num = Number(normalised);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      return { parsed: null, error: 'invalid' };
    }
    return { parsed: num };
  }

  if (typeof input === 'number') {
    if (Number.isNaN(input) || !Number.isFinite(input)) {
      return { parsed: null, error: 'invalid' };
    }
    return { parsed: input };
  }

  return { parsed: null, error: 'invalid' };
}

/**
 * Computes the odometer correction factor from official and measured zone distances.
 *
 * Formula: factor = official distance / measured distance.
 * Returns full-precision factor.
 * Returns a clear invalid result (never NaN or Infinity) on bad or out-of-range inputs.
 */
export function computeCorrectionFactor(
  officialDistanceKm: number | string | null | undefined,
  measuredDistanceKm: number | string | null | undefined
): FactorCalculationResult {
  const official = parseDistanceInput(officialDistanceKm);
  if (official.parsed === null) {
    return { ok: false, error: official.error ?? 'missing' };
  }

  const measured = parseDistanceInput(measuredDistanceKm);
  if (measured.parsed === null) {
    return { ok: false, error: measured.error ?? 'missing' };
  }

  const officialVal = official.parsed;
  const measuredVal = measured.parsed;

  if (officialVal < 0 || measuredVal < 0) {
    return { ok: false, error: 'negative' };
  }

  if (officialVal === 0 || measuredVal === 0) {
    return { ok: false, error: 'zero' };
  }

  if (measuredVal < CALIBRATION_MIN_MEASURED_DISTANCE_KM) {
    return { ok: false, error: 'too-small' };
  }

  const factor = officialVal / measuredVal;

  if (factor < CALIBRATION_MIN_FACTOR || factor > CALIBRATION_MAX_FACTOR) {
    return { ok: false, error: 'out-of-range', factor };
  }

  return { ok: true, factor };
}

/**
 * Validates a factor value for storage and runtime application.
 */
export function validateCorrectionFactor(
  factor: number
): { ok: true; value: number } | { ok: false; error: FactorErrorReason } {
  if (typeof factor !== 'number' || Number.isNaN(factor) || !Number.isFinite(factor)) {
    return { ok: false, error: 'invalid' };
  }

  if (factor < CALIBRATION_MIN_FACTOR || factor > CALIBRATION_MAX_FACTOR) {
    return { ok: false, error: 'out-of-range' };
  }

  return { ok: true, value: factor };
}

/**
 * Single source of truth for whether calibration is allowed.
 * Blocked when the race stopwatch is running.
 */
export function isCalibrationAllowed(isRaceRunning: boolean): boolean {
  return !isRaceRunning;
}

export {
  CalibrationMeter,
  type CalibrationState,
  type CalibrationSnapshot,
  type CalibrationMeterOptions,
} from './calibrationMeter';

