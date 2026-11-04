/**
 * Persistence layer for the assigned stage speed.
 * Only this module reads/writes localStorage for this value.
 * All errors are handled internally; components never crash due to storage failures.
 */

import { validateStageSpeed } from './logic/stageSpeed';
import { validateCorrectionFactor } from './logic/calibration';
import { DEFAULT_CORRECTION_FACTOR } from './logic/gpsConstants';
import { ControlSystem, DEFAULT_CONTROL_SYSTEM, isValidControlSystem } from './logic/controlSystem';
import { RoadbookRow, createInitialSheet, sanitizeMarkText, validateRowSpeed } from './logic/roadbookModel';
import { RowMark, RoadbookAction } from './logic/roadbookRace';

/** localStorage key for stage speed — single source of truth. */
export const STAGE_SPEED_KEY = 'rr_stage_speed';

/** localStorage key for odometer correction factor — single source of truth. */
export const CORRECTION_FACTOR_KEY = 'rr_correction_factor';

/** localStorage key for control system choice (carrera | hoja-de-ruta). */
export const CONTROL_SYSTEM_KEY = 'rr_control_system';

/** localStorage key for roadbook loaded sheet. */
export const ROADBOOK_SHEET_KEY = 'rr_roadbook_sheet';

/** localStorage key for roadbook race state. */
export const ROADBOOK_RACE_STATE_KEY = 'rr_roadbook_race_state';

/** localStorage key for Carrera main stopwatch state. */
export const CARRERA_STOPWATCH_KEY = 'rr_carrera_stopwatch';

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface StoredCarreraStopwatchState {
  version: 1;
  startWallClock: number | null;
  running: boolean;
  accumulatedMs: number;
}

export interface StoredRoadbookSheet {
  version: 1;
  rows: RoadbookRow[];
}

export interface StoredRoadbookRaceState {
  version: 1;
  startWallClock: number | null;
  running: boolean;
  marks: Record<number, RowMark>;
  history: RoadbookAction[];
  currentRowIndex: number | null;
}

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

/**
 * Reads the selected control system from localStorage.
 * Falls back to DEFAULT_CONTROL_SYSTEM ('carrera') if missing, invalid, or storage is unavailable.
 */
export function readControlSystem(): ControlSystem {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_CONTROL_SYSTEM;
    }
    const raw = localStorage.getItem(CONTROL_SYSTEM_KEY);
    if (isValidControlSystem(raw)) {
      return raw;
    }
    return DEFAULT_CONTROL_SYSTEM;
  } catch {
    return DEFAULT_CONTROL_SYSTEM;
  }
}

/**
 * Writes the selected control system to localStorage.
 */
export function writeControlSystem(system: ControlSystem): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar la selección. El almacenamiento del dispositivo no está disponible.',
      };
    }
    if (!isValidControlSystem(system)) {
      return {
        ok: false,
        error: 'Sistema de control inválido.',
      };
    }
    localStorage.setItem(CONTROL_SYSTEM_KEY, system);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar la selección. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Reads the stored roadbook sheet from localStorage.
 * Falls back to an initial 50-row sheet if missing, corrupt, unknown version, or storage unavailable.
 */
export function readRoadbookSheet(): RoadbookRow[] {
  try {
    if (typeof localStorage === 'undefined') {
      return createInitialSheet();
    }
    const raw = localStorage.getItem(ROADBOOK_SHEET_KEY);
    if (!raw) return createInitialSheet();

    const parsed = JSON.parse(raw) as Partial<StoredRoadbookSheet>;
    if (parsed.version !== 1 || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
      return createInitialSheet();
    }

    const rows: RoadbookRow[] = parsed.rows.map((row, idx) => {
      const id = typeof row.id === 'string' && row.id.length > 0 ? row.id : `row-${idx + 1}`;
      const mark = sanitizeMarkText(row.mark);
      const assignedTimeSeconds =
        typeof row.assignedTimeSeconds === 'number' &&
        Number.isFinite(row.assignedTimeSeconds) &&
        row.assignedTimeSeconds >= 0
          ? Math.floor(row.assignedTimeSeconds)
          : null;
      const speedKmH = validateRowSpeed(row.speedKmH);

      return { id, mark, assignedTimeSeconds, speedKmH };
    });

    return rows;
  } catch {
    return createInitialSheet();
  }
}

/**
 * Writes the roadbook sheet to localStorage.
 */
export function writeRoadbookSheet(rows: RoadbookRow[]): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar la hoja de ruta. El almacenamiento del dispositivo no está disponible.',
      };
    }
    if (!Array.isArray(rows)) {
      return {
        ok: false,
        error: 'Formato de hoja de ruta inválido.',
      };
    }

    const stored: StoredRoadbookSheet = {
      version: 1,
      rows,
    };
    localStorage.setItem(ROADBOOK_SHEET_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar la hoja de ruta. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Reads the roadbook race state from localStorage.
 * Returns null if missing, corrupted, unknown version, or storage is unavailable.
 */
export function readRoadbookRaceState(): StoredRoadbookRaceState | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(ROADBOOK_RACE_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredRoadbookRaceState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.running !== 'boolean' ||
      typeof parsed.marks !== 'object' ||
      parsed.marks === null ||
      !Array.isArray(parsed.history)
    ) {
      return null;
    }

    return {
      version: 1,
      startWallClock: typeof parsed.startWallClock === 'number' ? parsed.startWallClock : null,
      running: parsed.running,
      marks: parsed.marks as Record<number, RowMark>,
      history: parsed.history as RoadbookAction[],
      currentRowIndex: typeof parsed.currentRowIndex === 'number' ? parsed.currentRowIndex : null,
    };
  } catch {
    return null;
  }
}

/**
 * Writes the roadbook race state to localStorage.
 */
export function writeRoadbookRaceState(state: StoredRoadbookRaceState): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar el estado de carrera. El almacenamiento del dispositivo no está disponible.',
      };
    }
    localStorage.setItem(ROADBOOK_RACE_STATE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar el estado de carrera. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Clears the roadbook race state from localStorage (called on REINICIAR).
 * Keeps the loaded roadbook sheet intact.
 */
export function clearRoadbookRaceState(): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo restablecer el estado. El almacenamiento del dispositivo no está disponible.',
      };
    }
    localStorage.removeItem(ROADBOOK_RACE_STATE_KEY);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo restablecer el estado. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Reads the stored Carrera main stopwatch state from localStorage.
 * Defensively validates version, types, and that startWallClock is not in the future.
 * Returns null if missing, corrupted, or invalid.
 */
export function readCarreraStopwatchState(nowWallClock: number = Date.now()): StoredCarreraStopwatchState | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(CARRERA_STOPWATCH_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCarreraStopwatchState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.running !== 'boolean' ||
      typeof parsed.accumulatedMs !== 'number' ||
      !Number.isFinite(parsed.accumulatedMs) ||
      parsed.accumulatedMs < 0
    ) {
      return null;
    }

    if (parsed.running) {
      if (
        typeof parsed.startWallClock !== 'number' ||
        !Number.isFinite(parsed.startWallClock) ||
        parsed.startWallClock > nowWallClock
      ) {
        return null;
      }
      return {
        version: 1,
        startWallClock: parsed.startWallClock,
        running: true,
        accumulatedMs: parsed.accumulatedMs,
      };
    } else {
      if (
        parsed.startWallClock !== null &&
        parsed.startWallClock !== undefined
      ) {
        if (
          typeof parsed.startWallClock !== 'number' ||
          !Number.isFinite(parsed.startWallClock) ||
          parsed.startWallClock > nowWallClock
        ) {
          return null;
        }
      }
      return {
        version: 1,
        startWallClock: parsed.startWallClock ?? null,
        running: false,
        accumulatedMs: parsed.accumulatedMs,
      };
    }
  } catch {
    return null;
  }
}

/**
 * Writes the Carrera main stopwatch state to localStorage.
 */
export function writeCarreraStopwatchState(state: StoredCarreraStopwatchState): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo guardar el estado del cronómetro. El almacenamiento del dispositivo no está disponible.',
      };
    }
    localStorage.setItem(CARRERA_STOPWATCH_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo guardar el estado del cronómetro. El almacenamiento del dispositivo no está disponible.',
    };
  }
}

/**
 * Clears the Carrera main stopwatch state from localStorage (called on REINICIAR).
 */
export function clearCarreraStopwatchState(): SaveResult {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        ok: false,
        error: 'No se pudo restablecer el cronómetro. El almacenamiento del dispositivo no está disponible.',
      };
    }
    localStorage.removeItem(CARRERA_STOPWATCH_KEY);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'No se pudo restablecer el cronómetro. El almacenamiento del dispositivo no está disponible.',
    };
  }
}


