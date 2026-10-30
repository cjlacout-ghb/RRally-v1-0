/**
 * Shared GPS distance accumulation engine.
 *
 * Encapsulates:
 * - Filtering raw readings against accuracy, timestamp order, and speed thresholds.
 * - Suppressing stopped-vehicle jitter displacements.
 * - Accumulating displacement in kilometers at full precision.
 * - Tracking the active reference point across start/stop/resume cycles without jumps.
 *
 * Reused by both RallyTracker and CalibrationMeter to eliminate duplicated distance logic.
 */

import { filterGpsReading, type FilterResult } from './gpsFilter';
import type { GpsReading } from './gpsReader';

export interface AccumulatorStepResult {
  /** True if reading passed all filters. */
  accepted: boolean;
  /** Detailed filter result. */
  filterResult: FilterResult;
  /** True if this reading became the new reference point with zero displacement added. */
  isNewReference: boolean;
  /** Displacement added in this step in kilometers (0 if jitter or initial point). */
  stepDistanceKm: number;
  /** Total accumulated raw distance in kilometers at full precision. */
  rawDistanceKm: number;
  /** Prior accepted reading before this step, useful for delta speed derivation. */
  priorAcceptedReading: GpsReading | null;
}

export class DistanceAccumulator {
  private rawDistanceKm: number = 0;
  private lastAcceptedReading: GpsReading | null = null;
  private activeReferenceReading: GpsReading | null = null;

  /**
   * Resets accumulated distance and all reading references to clean initial state.
   */
  reset(): void {
    this.rawDistanceKm = 0;
    this.lastAcceptedReading = null;
    this.activeReferenceReading = null;
  }

  /**
   * Clears the active reference point so the next accepted reading establishes
   * a new starting reference without a displacement jump.
   */
  clearReference(): void {
    this.activeReferenceReading = null;
  }

  /**
   * Total raw accumulated distance in km at full precision.
   */
  getRawDistanceKm(): number {
    return this.rawDistanceKm;
  }

  /**
   * Most recent accepted GPS reading, or null if none accepted yet.
   */
  getLastAcceptedReading(): GpsReading | null {
    return this.lastAcceptedReading;
  }

  /**
   * Active reference GPS reading from which displacement is measured.
   */
  getActiveReferenceReading(): GpsReading | null {
    return this.activeReferenceReading;
  }

  /**
   * Evaluates an incoming GPS reading and accumulates displacement if accumulating.
   *
   * @param reading Incoming GPS reading.
   * @param isAccumulating When false, reading is filtered for status/speed tracking but distance is not accumulated.
   */
  processReading(reading: GpsReading, isAccumulating: boolean): AccumulatorStepResult {
    const positionRef =
      isAccumulating && this.activeReferenceReading
        ? this.activeReferenceReading
        : this.lastAcceptedReading;

    const priorAcceptedReading = this.lastAcceptedReading;
    const filterResult = filterGpsReading(reading, this.lastAcceptedReading, positionRef);

    if (!filterResult.accepted) {
      return {
        accepted: false,
        filterResult,
        isNewReference: false,
        stepDistanceKm: 0,
        rawDistanceKm: this.rawDistanceKm,
        priorAcceptedReading,
      };
    }

    let isNewReference = false;
    let stepDistanceKm = 0;

    if (isAccumulating) {
      if (this.activeReferenceReading === null) {
        // First accepted fix after start or resume establishes starting reference
        this.activeReferenceReading = reading;
        isNewReference = true;
      } else {
        if (!filterResult.isJitter) {
          stepDistanceKm = filterResult.distanceMeters / 1000;
          this.rawDistanceKm += stepDistanceKm;
          this.activeReferenceReading = reading;
        }
        // When filterResult.isJitter is true, activeReferenceReading does NOT move,
        // allowing very slow movement to accumulate against the last counted point.
      }
    }

    this.lastAcceptedReading = reading;

    return {
      accepted: true,
      filterResult,
      isNewReference,
      stepDistanceKm,
      rawDistanceKm: this.rawDistanceKm,
      priorAcceptedReading,
    };
  }
}
