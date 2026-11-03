/**
 * Next-stretch speed calculation and trend analysis for Hoja de ruta.
 */

import { RoadbookRow, getEffectiveSpeed } from './roadbookModel';

export type SpeedDirection = 'faster' | 'slower' | 'equal';

export interface NextStretchSpeedSuccess {
  available: true;
  adjustedSpeedKmH: number;
  organizationSpeedKmH: number;
  direction: SpeedDirection;
  demanding: boolean;
}

export interface NextStretchSpeedUnavailable {
  available: false;
  reason?: string;
}

export type NextStretchSpeedResult = NextStretchSpeedSuccess | NextStretchSpeedUnavailable;

/**
 * Calculates the adjusted target speed to drive on the next stretch.
 *
 * Stretch definition:
 * - Ends at currentRowIndex.
 * - Starts at the nearest previous row that has an assigned time.
 * - Planned duration = current assigned time - previous assigned time.
 * - Organization speed = effective speed of the starting row.
 * - Adjusted speed = organization speed * planned duration / (planned duration + accumulated deviation).
 *
 * Direction is 'faster' | 'slower' | 'equal', where equal means both values round to the same single decimal.
 * Demanding is true strictly when adjusted speed > 110% of organization speed.
 */
export function computeNextStretchSpeed(
  rows: RoadbookRow[],
  currentRowIndex: number | null,
  accumulatedDeviationSeconds: number | null
): NextStretchSpeedResult {
  if (
    currentRowIndex === null ||
    currentRowIndex < 0 ||
    currentRowIndex >= rows.length ||
    accumulatedDeviationSeconds === null ||
    Number.isNaN(accumulatedDeviationSeconds)
  ) {
    return { available: false, reason: 'missing-context' };
  }

  const currentRow = rows[currentRowIndex];
  if (currentRow.assignedTimeSeconds === null || Number.isNaN(currentRow.assignedTimeSeconds)) {
    return { available: false, reason: 'current-row-no-assigned-time' };
  }

  // Find previous row that has an assigned time
  let prevRowIndex: number | null = null;
  for (let i = currentRowIndex - 1; i >= 0; i--) {
    if (rows[i].assignedTimeSeconds !== null && !Number.isNaN(rows[i].assignedTimeSeconds!)) {
      prevRowIndex = i;
      break;
    }
  }

  if (prevRowIndex === null) {
    return { available: false, reason: 'no-previous-row' };
  }

  const prevRow = rows[prevRowIndex];
  const plannedDuration = currentRow.assignedTimeSeconds - prevRow.assignedTimeSeconds!;
  if (plannedDuration <= 0) {
    return { available: false, reason: 'planned-duration-not-positive' };
  }

  const orgSpeed = getEffectiveSpeed(rows, prevRowIndex);
  if (orgSpeed === null || orgSpeed <= 0) {
    return { available: false, reason: 'organization-speed-null' };
  }

  const adjustedDuration = plannedDuration + accumulatedDeviationSeconds;
  if (adjustedDuration <= 0) {
    return { available: false, reason: 'adjusted-duration-not-positive' };
  }

  const adjustedSpeed = (orgSpeed * plannedDuration) / adjustedDuration;

  // Direction: compare rounded to 1 decimal place
  const roundedAdjusted = Math.round(adjustedSpeed * 10) / 10;
  const roundedOrg = Math.round(orgSpeed * 10) / 10;

  let direction: SpeedDirection;
  if (roundedAdjusted > roundedOrg) {
    direction = 'faster';
  } else if (roundedAdjusted < roundedOrg) {
    direction = 'slower';
  } else {
    direction = 'equal';
  }

  // Demanding: strictly greater than 110% of organization speed (exactly 10% is not demanding)
  const demanding = adjustedSpeed > orgSpeed * 1.10;

  return {
    available: true,
    adjustedSpeedKmH: adjustedSpeed,
    organizationSpeedKmH: orgSpeed,
    direction,
    demanding,
  };
}
