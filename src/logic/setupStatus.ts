import type { ControlSystem } from './controlSystem';
import type { RoadbookRow } from './roadbookModel';

/**
 * Determines if stage/race setup is pending.
 * - In CARRERA mode: pending when no assigned stage speed is saved (null, undefined, or <= 0).
 * - In HOJA DE RUTA mode: pending when zero rows have an assigned time.
 */
export function isSetupPending(
  controlSystem: ControlSystem,
  assignedSpeed: number | null | undefined,
  rows: RoadbookRow[]
): boolean {
  if (controlSystem === 'carrera') {
    return assignedSpeed === null || assignedSpeed === undefined || assignedSpeed <= 0;
  }
  if (controlSystem === 'hoja-de-ruta') {
    return !rows.some(
      (r) =>
        r.assignedTimeSeconds !== null &&
        r.assignedTimeSeconds !== undefined &&
        !Number.isNaN(r.assignedTimeSeconds)
    );
  }
  return false;
}
