/**
 * Delta classification logic for regularity rally ahead/behind indicator.
 */

/** Neutral band in seconds: within +/-0.10s is classified as 'neutral' (EN TIEMPO). */
export const NEUTRAL_BAND_SECONDS = 0.10;

export type DeltaState = 'ahead' | 'behind' | 'neutral' | 'no-data';

export const DELTA_LABELS: Record<DeltaState, string> = {
  ahead: 'ADELANTADO',
  behind: 'ATRASADO',
  neutral: 'EN TIEMPO',
  'no-data': 'SIN DATOS',
};

/**
 * Classifies the ahead/behind delta in seconds.
 *
 * - Returns 'no-data' if deltaSeconds is null, undefined, or NaN.
 * - Returns 'neutral' if Math.abs(deltaSeconds) <= neutralBand (default 0.10 s).
 * - Returns 'ahead' if deltaSeconds > neutralBand.
 * - Returns 'behind' if deltaSeconds < -neutralBand.
 */
export function classifyDelta(
  deltaSeconds: number | null | undefined,
  neutralBand: number = NEUTRAL_BAND_SECONDS
): DeltaState {
  if (deltaSeconds === null || deltaSeconds === undefined || Number.isNaN(deltaSeconds)) {
    return 'no-data';
  }
  if (Math.abs(deltaSeconds) <= neutralBand) {
    return 'neutral';
  }
  return deltaSeconds > 0 ? 'ahead' : 'behind';
}

/**
 * Computes the ahead/behind delta in seconds.
 *
 * Formula:
 * Ideal elapsed time = (displayedDistanceKm / assignedStageSpeedKmH) * 3600
 * Delta in seconds = Ideal elapsed time - actualElapsedSeconds
 *
 * Positive delta means ahead of schedule.
 * Negative delta means behind schedule.
 *
 * Returns null if:
 * - assignedStageSpeedKmH is null, undefined, NaN, or <= 0
 * - displayedDistanceKm is null, undefined, NaN, or < 0
 * - actualElapsedSeconds is null, undefined, NaN, or < 0
 */
export function computeDeltaSeconds(
  displayedDistanceKm: number | null | undefined,
  assignedStageSpeedKmH: number | null | undefined,
  actualElapsedSeconds: number | null | undefined
): number | null {
  if (
    displayedDistanceKm === null ||
    displayedDistanceKm === undefined ||
    Number.isNaN(displayedDistanceKm) ||
    displayedDistanceKm < 0 ||
    assignedStageSpeedKmH === null ||
    assignedStageSpeedKmH === undefined ||
    Number.isNaN(assignedStageSpeedKmH) ||
    assignedStageSpeedKmH <= 0 ||
    actualElapsedSeconds === null ||
    actualElapsedSeconds === undefined ||
    Number.isNaN(actualElapsedSeconds) ||
    actualElapsedSeconds < 0
  ) {
    return null;
  }

  const idealElapsedSeconds = (displayedDistanceKm / assignedStageSpeedKmH) * 3600;
  return idealElapsedSeconds - actualElapsedSeconds;
}

