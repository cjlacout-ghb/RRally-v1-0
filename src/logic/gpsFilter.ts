/**
 * Pure filter logic for raw GPS readings.
 * Discards inaccurate, out-of-order, or implausibly fast fixes.
 * Ignores jitter displacements when the vehicle is stationary.
 */

import {
  MAX_ACCURACY_METERS,
  MAX_SPEED_MPS,
  MAX_STOPPED_SPEED_MPS,
  STOPPED_JITTER_THRESHOLD_METERS,
} from './gpsConstants';
import { haversineDistanceMeters } from './geo';
import type { GpsReading } from './gpsReader';

export type FilterRejectionReason =
  | 'poor_accuracy'
  | 'timestamp_out_of_order'
  | 'implausible_speed';

export interface FilterResult {
  /** True if reading passes all rejection filters. */
  accepted: boolean;
  /** Rejection reason if accepted is false. */
  reason?: FilterRejectionReason;
  /** Valid displacement in meters since last accepted fix. 0 if jitter or initial point. */
  distanceMeters: number;
  /** True if displacement was ignored due to stopped-vehicle jitter filter. */
  isJitter: boolean;
}

/**
 * Determines whether a vehicle is effectively stopped based on reported or derived speed.
 */
export function isVehicleStopped(
  reportedSpeedMps: number | null,
  derivedSpeedMps: number | null
): boolean {
  if (reportedSpeedMps !== null && !Number.isNaN(reportedSpeedMps) && reportedSpeedMps >= 0) {
    return reportedSpeedMps <= MAX_STOPPED_SPEED_MPS;
  }
  if (derivedSpeedMps !== null && !Number.isNaN(derivedSpeedMps) && derivedSpeedMps >= 0) {
    return derivedSpeedMps <= MAX_STOPPED_SPEED_MPS;
  }
  return false;
}

/**
 * Filters an incoming GPS reading against the last accepted reading.
 *
 * @param reading The new GPS fix to evaluate.
 * @param lastAccepted The most recent accepted fix (used for chronological timestamp checks).
 * @param referencePosition The position fix from which displacement is measured.
 *                          When stationary jitter is suppressed, this reference position
 *                          does not move, allowing very slow real movement to accumulate.
 */
export function filterGpsReading(
  reading: GpsReading,
  lastAccepted: GpsReading | null,
  referencePosition: GpsReading | null = lastAccepted
): FilterResult {
  // Rule 1: Discard readings with accuracy worse than 30 m
  if (reading.accuracy > MAX_ACCURACY_METERS) {
    return {
      accepted: false,
      reason: 'poor_accuracy',
      distanceMeters: 0,
      isJitter: false,
    };
  }

  // Initial accepted reading
  if (!lastAccepted) {
    return {
      accepted: true,
      distanceMeters: 0,
      isJitter: false,
    };
  }

  // Rule 2: Discard readings whose timestamp is not strictly newer than the last accepted one
  if (reading.timestamp <= lastAccepted.timestamp) {
    return {
      accepted: false,
      reason: 'timestamp_out_of_order',
      distanceMeters: 0,
      isJitter: false,
    };
  }

  const posRef = referencePosition ?? lastAccepted;
  const dtSeconds = (reading.timestamp - posRef.timestamp) / 1000;
  const distMeters = haversineDistanceMeters(
    posRef.latitude,
    posRef.longitude,
    reading.latitude,
    reading.longitude
  );

  const impliedSpeedMps = dtSeconds > 0 ? distMeters / dtSeconds : 0;

  // Rule 3: Discard readings that imply a speed above 70 m/s relative to the reference point
  // Use a tiny epsilon for floating-point calculation stability
  if (impliedSpeedMps > MAX_SPEED_MPS + 1e-6) {
    return {
      accepted: false,
      reason: 'implausible_speed',
      distanceMeters: 0,
      isJitter: false,
    };
  }

  // Rule 4: Ignore tiny displacements below a small jitter threshold when the vehicle is effectively stopped
  const stopped = isVehicleStopped(reading.speed, impliedSpeedMps);
  if (stopped && distMeters < STOPPED_JITTER_THRESHOLD_METERS) {
    return {
      accepted: true,
      distanceMeters: 0,
      isJitter: true,
    };
  }

  return {
    accepted: true,
    distanceMeters: distMeters,
    isJitter: false,
  };
}
