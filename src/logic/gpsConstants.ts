/**
 * Single source of truth for GPS, telemetry, and rally calculation constants.
 * All filter thresholds, smoothing windows, time-outs, and adjustment steps live here.
 */

/** Discard readings with horizontal accuracy worse than 30 meters. */
export const MAX_ACCURACY_METERS = 30;

/** Discard readings that imply a speed above 70 m/s (~252 km/h) relative to the last accepted point. */
export const MAX_SPEED_MPS = 70;

/** Vehicle is considered effectively stopped if speed is at or below 0.5 m/s (~1.8 km/h). */
export const MAX_STOPPED_SPEED_MPS = 0.5;

/** Displacements below 2.0 meters when the vehicle is stopped are ignored as GPS jitter. */
export const STOPPED_JITTER_THRESHOLD_METERS = 2.0;

/** Instantaneous speed is smoothed over a short rolling window of 3000 ms (~3 seconds). */
export const SPEED_SMOOTHING_WINDOW_MS = 3000;

/** Instantaneous speed becomes no-data (null) if no accepted reading arrives for > 5000 ms. */
export const STALE_SPEED_TIMEOUT_MS = 5000;

/** Average speed remains no-data until at least 5000 ms of running time have elapsed. */
export const AVERAGE_SPEED_MIN_ELAPSED_MS = 5000;

/** Each press of -1 or +1 adjusts the displayed distance by exactly 10 meters (0.010 km). */
export const MANUAL_ADJUSTMENT_STEP_KM = 0.010;

/** Manual adjustment step size in meters. */
export const MANUAL_ADJUSTMENT_STEP_METERS = 10;

/** Default odometer correction factor before Phase 4 calibration (1.0000). */
export const DEFAULT_CORRECTION_FACTOR = 1.0000;

/** Earth mean radius in meters used for great-circle distance calculations. */
export const EARTH_RADIUS_METERS = 6371000;
