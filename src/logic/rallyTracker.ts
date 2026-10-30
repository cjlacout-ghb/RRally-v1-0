/**
 * Rally telemetry and tracking engine.
 * Pure logic module managing distance accumulation, speed tracking, delta calculations,
 * and clock reconciliation between stopwatch and GPS readings.
 *
 * CLOCK RECONCILIATION:
 * The stopwatch and GPS readings share UTC epoch milliseconds (Date.now() / POSIX ms).
 * When INICIAR is called, sessionStartEpochMs is recorded.
 * Each GPS reading has reading.timestamp in UTC epoch milliseconds.
 * Actual elapsed time at that fix is computed as:
 *   elapsedMs = priorAccumulatedMs + (reading.timestamp - sessionStartEpochMs)
 * Computing elapsed time at reading.timestamp ensures that the ahead/behind delta
 * is evaluated at the exact physical moment the vehicle was at that coordinate,
 * eliminating UI render loop latency or JavaScript event queue delays.
 *
 * PRIVACY GUARANTEE:
 * Coordinates are never persisted and never logged. Memory is strictly O(1)
 * (only the latest accepted reading and a bounded 3-second smoothing window are retained).
 */

import {
  AVERAGE_SPEED_MIN_ELAPSED_MS,
  DEFAULT_CORRECTION_FACTOR,
  MANUAL_ADJUSTMENT_STEP_KM,
  SPEED_SMOOTHING_WINDOW_MS,
  STALE_SPEED_TIMEOUT_MS,
} from './gpsConstants';
import { type FilterResult } from './gpsFilter';
import type { GpsReading } from './gpsReader';
import { DistanceAccumulator } from './distanceAccumulator';
import { defaultClocks, type Clocks } from './stopwatch';
import { computeDeltaSeconds } from './delta';

export interface SpeedSample {
  timestamp: number;
  speedMps: number;
}

export interface RallyTrackerOptions {
  clocks?: Clocks;
  correctionFactor?: number;
  assignedSpeedKmH?: number | null;
}

export interface ReadingProcessResult {
  accepted: boolean;
  filterResult: FilterResult;
  isNewReference: boolean;
  rawDistanceKm: number;
  displayedDistanceKm: number;
  instantaneousSpeedKmH: number | null;
  averageSpeedKmH: number | null;
  deltaSeconds: number | null;
}

export class RallyTracker {
  private readonly clocks: Clocks;

  // Configuration
  private correctionFactor: number;
  private assignedSpeedKmH: number | null;

  // Running state
  private running: boolean = false;
  private sessionStartEpochMs: number | null = null;
  private accumulatedElapsedMs: number = 0;

  // Distance tracking engine (shared with CalibrationMeter)
  private readonly accumulator: DistanceAccumulator;
  private manualAdjustmentKm: number = 0;

  // Speed and telemetry state
  private speedSmoothingWindow: SpeedSample[] = [];
  private latestSmoothedSpeedKmH: number | null = null;
  private frozenAverageSpeed: number | null = null;

  // Delta state
  private latestReadingElapsedSeconds: number | null = null;
  private deltaSeconds: number | null = null;

  constructor(options: RallyTrackerOptions = {}) {
    this.clocks = options.clocks ?? defaultClocks;
    this.correctionFactor = options.correctionFactor ?? DEFAULT_CORRECTION_FACTOR;
    this.assignedSpeedKmH = options.assignedSpeedKmH ?? null;
    this.accumulator = new DistanceAccumulator();
  }

  /**
   * Sets the assigned stage speed in km/h.
   * Immediately recomputes the delta if readings have been processed.
   */
  setAssignedSpeed(speedKmH: number | null): void {
    this.assignedSpeedKmH = speedKmH !== null && speedKmH > 0 ? speedKmH : null;
    this.recomputeDelta();
  }

  /**
   * Sets the odometer correction factor (Phase 4 calibration).
   */
  setCorrectionFactor(factor: number): void {
    this.correctionFactor = factor;
    this.recomputeDelta();
  }

  /**
   * Starts or resumes distance accumulation (INICIAR).
   * Takes startEpochMs to synchronize with stopwatch start.
   */
  start(startEpochMs?: number): void {
    if (this.running) return;
    this.running = true;
    this.sessionStartEpochMs = startEpochMs ?? this.clocks.nowWallClock();
    // Clear active reference so the next accepted reading establishes a new starting point
    this.accumulator.clearReference();
    this.frozenAverageSpeed = null;
  }

  /**
   * Pauses distance accumulation and freezes telemetry (PARAR).
   */
  stop(stopEpochMs?: number): void {
    if (!this.running) return;

    const stopMs = stopEpochMs ?? this.clocks.nowWallClock();
    if (this.sessionStartEpochMs !== null) {
      this.accumulatedElapsedMs += Math.max(0, stopMs - this.sessionStartEpochMs);
    }

    // Freeze average speed using displayed distance divided by the same elapsed time used for delta
    if (
      this.latestReadingElapsedSeconds !== null &&
      this.latestReadingElapsedSeconds >= AVERAGE_SPEED_MIN_ELAPSED_MS / 1000 &&
      this.getDisplayedDistanceKm() > 0
    ) {
      const hours = this.latestReadingElapsedSeconds / 3600;
      this.frozenAverageSpeed = this.getDisplayedDistanceKm() / hours;
    } else {
      this.frozenAverageSpeed = null;
    }

    this.running = false;
    this.sessionStartEpochMs = null;
    this.accumulator.clearReference();
  }

  /**
   * Resets raw distance, manual adjustment, delta, and average to zero / no-data (REINICIAR).
   */
  reset(): void {
    this.running = false;
    this.sessionStartEpochMs = null;
    this.accumulatedElapsedMs = 0;
    this.accumulator.reset();
    this.manualAdjustmentKm = 0;
    this.frozenAverageSpeed = null;
    this.latestReadingElapsedSeconds = null;
    this.deltaSeconds = null;
    this.speedSmoothingWindow = [];
    this.latestSmoothedSpeedKmH = null;
  }

  /**
   * Adjusts the manual distance offset by +/- 10m steps (+1 or -1).
   * Survives new GPS readings and immediately recomputes the delta.
   * A -1 press that would make the displayed distance negative is ignored.
   */
  adjustDistance(stepDirection: number): void {
    const prospectiveAdjustmentKm = this.manualAdjustmentKm + stepDirection * MANUAL_ADJUSTMENT_STEP_KM;
    const prospectiveDisplayedKm = this.accumulator.getRawDistanceKm() * this.correctionFactor + prospectiveAdjustmentKm;

    // A -1 press that would make the displayed distance negative must be ignored (no change to manual adjustment)
    if (prospectiveDisplayedKm < 0) {
      return;
    }

    this.manualAdjustmentKm = prospectiveAdjustmentKm;
    this.recomputeDelta();
  }

  /**
   * Processes an incoming GPS reading.
   * Constant work, no coordinates logged or persisted.
   */
  processReading(reading: GpsReading): ReadingProcessResult {
    // A reading whose timestamp is earlier than the session start must be discarded
    if (this.running && this.sessionStartEpochMs !== null && reading.timestamp < this.sessionStartEpochMs) {
      return {
        accepted: false,
        filterResult: {
          accepted: false,
          reason: 'timestamp_out_of_order',
          distanceMeters: 0,
          isJitter: false,
        },
        isNewReference: false,
        rawDistanceKm: this.accumulator.getRawDistanceKm(),
        displayedDistanceKm: this.getDisplayedDistanceKm(),
        instantaneousSpeedKmH: this.getInstantaneousSpeedKmH(),
        averageSpeedKmH: this.getAverageSpeedKmH(),
        deltaSeconds: this.deltaSeconds,
      };
    }

    const step = this.accumulator.processReading(reading, this.running);

    if (!step.accepted) {
      return {
        accepted: false,
        filterResult: step.filterResult,
        isNewReference: false,
        rawDistanceKm: this.accumulator.getRawDistanceKm(),
        displayedDistanceKm: this.getDisplayedDistanceKm(),
        instantaneousSpeedKmH: this.getInstantaneousSpeedKmH(),
        averageSpeedKmH: this.getAverageSpeedKmH(),
        deltaSeconds: this.deltaSeconds,
      };
    }

    // Update instantaneous speed (independent of stopwatch)
    this.updateInstantaneousSpeed(reading, step.filterResult.distanceMeters, step.priorAcceptedReading);

    // Accumulate elapsed time and delta only while running (INICIAR)
    if (this.running && this.sessionStartEpochMs !== null) {
      this.latestReadingElapsedSeconds =
        (this.accumulatedElapsedMs + (reading.timestamp - this.sessionStartEpochMs)) / 1000;
      this.recomputeDelta();
    }

    return {
      accepted: true,
      filterResult: step.filterResult,
      isNewReference: step.isNewReference,
      rawDistanceKm: this.accumulator.getRawDistanceKm(),
      displayedDistanceKm: this.getDisplayedDistanceKm(),
      instantaneousSpeedKmH: this.getInstantaneousSpeedKmH(),
      averageSpeedKmH: this.getAverageSpeedKmH(),
      deltaSeconds: this.deltaSeconds,
    };
  }

  /**
   * Returns displayed distance in km: (rawGpsDistance * correctionFactor + manualAdjustment), clamped >= 0.
   */
  getDisplayedDistanceKm(): number {
    const calculated = this.accumulator.getRawDistanceKm() * this.correctionFactor + this.manualAdjustmentKm;
    return Math.max(0, calculated);
  }

  getRawDistanceKm(): number {
    return this.accumulator.getRawDistanceKm();
  }

  getManualAdjustmentKm(): number {
    return this.manualAdjustmentKm;
  }

  getCorrectionFactor(): number {
    return this.correctionFactor;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns whether the last accepted reading is stale (> STALE_SPEED_TIMEOUT_MS)
   * relative to the given timestamp (or wall clock).
   * Returns false if no reading has been accepted yet.
   */
  isStale(currentTimeMs?: number): boolean {
    const lastReading = this.accumulator.getLastAcceptedReading();
    if (!lastReading) return false;
    const now = currentTimeMs ?? this.clocks.nowWallClock();
    return now - lastReading.timestamp > STALE_SPEED_TIMEOUT_MS;
  }

  /**
   * Returns the ahead/behind delta in seconds.
   *
   * - If no reading has arrived yet or assignedSpeedKmH is missing, returns null (SIN DATOS).
   * - If running and currentElapsedMs is provided and the latest reading is stale
   *   (> STALE_SPEED_TIMEOUT_MS), computes the delta using current elapsed race time
   *   and the last known displayed distance so the delta keeps drifting while stationary.
   * - Otherwise, returns the delta evaluated at the exact physical timestamp of the latest fix.
   */
  getDeltaSeconds(currentElapsedMs?: number, currentTimeMs?: number): number | null {
    if (this.latestReadingElapsedSeconds === null) {
      return null;
    }

    if (this.running && currentElapsedMs !== undefined && this.isStale(currentTimeMs)) {
      return computeDeltaSeconds(
        this.getDisplayedDistanceKm(),
        this.assignedSpeedKmH,
        currentElapsedMs / 1000
      );
    }

    return this.deltaSeconds;
  }

  getLatestReading(): GpsReading | null {
    return this.accumulator.getLastAcceptedReading();
  }

  /**
   * Returns smoothed instantaneous speed in km/h.
   * Returns null if no accepted reading has arrived for > STALE_SPEED_TIMEOUT_MS (stale).
   */
  getInstantaneousSpeedKmH(currentTimeMs?: number): number | null {
    if (!this.accumulator.getLastAcceptedReading() || this.latestSmoothedSpeedKmH === null) {
      return null;
    }
    if (this.isStale(currentTimeMs)) {
      return null;
    }
    return this.latestSmoothedSpeedKmH;
  }

  /**
   * Returns average speed in km/h.
   * Uses displayed distance divided by the exact elapsed time used for delta.
   * Returns null until >= 5000 ms have elapsed and distance > 0.
   * Frozen on PARAR.
   */
  getAverageSpeedKmH(currentElapsedMs?: number): number | null {
    if (!this.running) {
      return this.frozenAverageSpeed;
    }

    const elapsedSeconds =
      currentElapsedMs !== undefined
        ? currentElapsedMs / 1000
        : this.latestReadingElapsedSeconds;

    if (
      elapsedSeconds === null ||
      elapsedSeconds === undefined ||
      elapsedSeconds < AVERAGE_SPEED_MIN_ELAPSED_MS / 1000 ||
      this.getDisplayedDistanceKm() <= 0
    ) {
      return null;
    }

    const hours = elapsedSeconds / 3600;
    return this.getDisplayedDistanceKm() / hours;
  }

  private updateInstantaneousSpeed(
    reading: GpsReading,
    displacementMeters: number,
    priorReading: GpsReading | null
  ): void {
    let sampleMps: number;

    if (reading.speed !== null && !Number.isNaN(reading.speed) && reading.speed >= 0) {
      sampleMps = reading.speed;
    } else if (priorReading) {
      const dt = (reading.timestamp - priorReading.timestamp) / 1000;
      sampleMps = dt > 0 ? displacementMeters / dt : 0;
    } else {
      sampleMps = 0;
    }

    // Prune samples older than 3000 ms relative to this reading's timestamp
    const cutoff = reading.timestamp - SPEED_SMOOTHING_WINDOW_MS;
    this.speedSmoothingWindow = this.speedSmoothingWindow.filter((s) => s.timestamp >= cutoff);
    this.speedSmoothingWindow.push({ timestamp: reading.timestamp, speedMps: sampleMps });

    const sumMps = this.speedSmoothingWindow.reduce((acc, curr) => acc + curr.speedMps, 0);
    const avgMps = sumMps / this.speedSmoothingWindow.length;

    this.latestSmoothedSpeedKmH = avgMps * 3.6;
  }

  private recomputeDelta(): void {
    if (this.latestReadingElapsedSeconds === null) {
      this.deltaSeconds = null;
      return;
    }

    this.deltaSeconds = computeDeltaSeconds(
      this.getDisplayedDistanceKm(),
      this.assignedSpeedKmH,
      this.latestReadingElapsedSeconds
    );
  }
}
