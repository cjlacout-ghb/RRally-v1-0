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
