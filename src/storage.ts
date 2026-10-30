/**
 * Persistence layer for the assigned stage speed.
 * Only this module reads/writes localStorage for this value.
 * All errors are handled internally; components never crash due to storage failures.
 */

import { validateStageSpeed } from './logic/stageSpeed';
import { validateCorrectionFactor } from './logic/calibration';
import { DEFAULT_CORRECTION_FACTOR } from './logic/gpsConstants';

/** localStorage key for stage speed — single source of truth. */
export const STAGE_SPEED_KEY = 'rr_stage_speed';

/** localStorage key for odometer correction factor — single source of truth. */
export const CORRECTION_FACTOR_KEY = 'rr_correction_factor';

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Reads the stored stage speed from localStorage.
 * Returns null if nothing is stored, the value is corrupted, or storage is unavailable.
 */
export function readStageSpeed(): number | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(STAGE_SPEED_KEY);
    if (raw === null) return null;

    const value = Number(raw);
    if (Number.isNaN(value)) return null;

    const result = validateStageSpeed(value);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

/**
 * Writes the stage speed to localStorage.
 * Returns a SaveResult indicating success or failure.
 */
export function writeStageSpeed(speed: number): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar el valor. El almacenamiento del dispositivo no está disponible.',
      };
    }
    localStorage.setItem(STAGE_SPEED_KEY, String(speed));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar el valor. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Reads the stored odometer correction factor from localStorage.
 * Falls back to 1.0000 if nothing is stored, value is corrupted, non-numeric,
 * out of sane range [0.8, 1.2], or storage is unavailable.
 */
export function readCorrectionFactor(): number {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_CORRECTION_FACTOR;
    }
    const raw = localStorage.getItem(CORRECTION_FACTOR_KEY);
    if (raw === null) return DEFAULT_CORRECTION_FACTOR;

    const value = Number(raw);
    if (Number.isNaN(value) || !Number.isFinite(value)) return DEFAULT_CORRECTION_FACTOR;

    const result = validateCorrectionFactor(value);
    return result.ok ? result.value : DEFAULT_CORRECTION_FACTOR;
  } catch {
    return DEFAULT_CORRECTION_FACTOR;
  }
}

/**
 * Writes the odometer correction factor to localStorage.
 * Replaces the previous factor.
 */
export function writeCorrectionFactor(factor: number): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar el factor de corrección. El almacenamiento del dispositivo no está disponible.',
      };
    }

    const validated = validateCorrectionFactor(factor);
    if (!validated.ok) {
      return {
        ok: false,
        error: 'El factor de corrección está fuera del rango permitido o no es válido.',
      };
    }

    localStorage.setItem(CORRECTION_FACTOR_KEY, String(factor));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar el factor de corrección. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Resets the odometer correction factor to 1.0000 by removing the stored key.
 */
export function resetCorrectionFactor(): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo restablecer el factor. El almacenamiento del dispositivo no está disponible.',
      };
    }

    localStorage.removeItem(CORRECTION_FACTOR_KEY);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo restablecer el factor. El almacenamiento del dispositivo no está disponible.',
    };
  }
}
