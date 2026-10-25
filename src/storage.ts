/**
 * Persistence layer for the assigned stage speed.
 * Only this module reads/writes localStorage for this value.
 * All errors are handled internally; components never crash due to storage failures.
 */

import { validateStageSpeed } from './logic/stageSpeed';

/** localStorage key — single source of truth. */
export const STAGE_SPEED_KEY = 'rr_stage_speed';

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
