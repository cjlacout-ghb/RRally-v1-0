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
import { filterGpsReading, type FilterResult } from './gpsFilter';
import type { GpsReading } from './gpsReader';
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

  // Distance tracking
  private rawGpsDistanceKm: number = 0;
  private manualAdjustmentKm: number = 0;

  // Speed and telemetry state
  private lastAcceptedReading: GpsReading | null = null;
  private activeReferenceReading: GpsReading | null = null;
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
    this.activeReferenceReading = null;
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
    this.activeReferenceReading = null;
  }

  /**
   * Resets raw distance, manual adjustment, delta, and average to zero / no-data (REINICIAR).
   */
  reset(): void {
    this.running = false;
    this.sessionStartEpochMs = null;
    this.accumulatedElapsedMs = 0;
    this.rawGpsDistanceKm = 0;
    this.manualAdjustmentKm = 0;
    this.frozenAverageSpeed = null;
    this.latestReadingElapsedSeconds = null;
    this.deltaSeconds = null;
    this.activeReferenceReading = null;
    this.speedSmoothingWindow = [];
    this.latestSmoothedSpeedKmH = null;
    this.lastAcceptedReading = null;
  }

  /**
   * Adjusts the manual distance offset by +/- 10m steps (+1 or -1).
   * Survives new GPS readings and immediately recomputes the delta.
   * A -1 press that would make the displayed distance negative is ignored.
   */
  adjustDistance(stepDirection: number): void {
    const prospectiveAdjustmentKm = this.manualAdjustmentKm + stepDirection * MANUAL_ADJUSTMENT_STEP_KM;
    const prospectiveDisplayedKm = this.rawGpsDistanceKm * this.correctionFactor + prospectiveAdjustmentKm;

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
        rawDistanceKm: this.rawGpsDistanceKm,
        displayedDistanceKm: this.getDisplayedDistanceKm(),
        instantaneousSpeedKmH: this.getInstantaneousSpeedKmH(),
        averageSpeedKmH: this.getAverageSpeedKmH(),
        deltaSeconds: this.deltaSeconds,
      };
    }

    // Displacement is measured relative to activeReferenceReading (or lastAcceptedReading)
    const positionRef = this.running && this.activeReferenceReading ? this.activeReferenceReading : this.lastAcceptedReading;
    const filterResult = filterGpsReading(reading, this.lastAcceptedReading, positionRef);

    if (!filterResult.accepted) {
      return {
        accepted: false,
        filterResult,
        isNewReference: false,
        rawDistanceKm: this.rawGpsDistanceKm,
        displayedDistanceKm: this.getDisplayedDistanceKm(),
        instantaneousSpeedKmH: this.getInstantaneousSpeedKmH(),
        averageSpeedKmH: this.getAverageSpeedKmH(),
        deltaSeconds: this.deltaSeconds,
      };
    }

    // Update instantaneous speed (independent of stopwatch)
    this.updateInstantaneousSpeed(reading, filterResult.distanceMeters);

    let isNewReference = false;

    // Accumulate distance only while running (INICIAR)
    if (this.running && this.sessionStartEpochMs !== null) {
      if (this.activeReferenceReading === null) {
        // First accepted fix after INICIAR (or resume) becomes starting reference with zero distance added
        this.activeReferenceReading = reading;
        isNewReference = true;
        this.latestReadingElapsedSeconds =
          (this.accumulatedElapsedMs + (reading.timestamp - this.sessionStartEpochMs)) / 1000;
        this.recomputeDelta();
      } else {
        if (!filterResult.isJitter) {
          // Real movement counted: accumulate distance and advance active reference point
          const stepKm = filterResult.distanceMeters / 1000;
          this.rawGpsDistanceKm += stepKm;
          this.activeReferenceReading = reading;
        }
        // When filterResult.isJitter is true, activeReferenceReading does NOT move,
        // allowing very slow movement to accumulate against the last counted point.

        this.latestReadingElapsedSeconds =
          (this.accumulatedElapsedMs + (reading.timestamp - this.sessionStartEpochMs)) / 1000;
        this.recomputeDelta();
      }
    }

    this.lastAcceptedReading = reading;

    return {
      accepted: true,
      filterResult,
      isNewReference,
      rawDistanceKm: this.rawGpsDistanceKm,
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
    const calculated = this.rawGpsDistanceKm * this.correctionFactor + this.manualAdjustmentKm;
    return Math.max(0, calculated);
  }

  getRawDistanceKm(): number {
    return this.rawGpsDistanceKm;
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

  getDeltaSeconds(): number | null {
    return this.deltaSeconds;
  }

  getLatestReading(): GpsReading | null {
    return this.lastAcceptedReading;
  }

  /**
   * Returns smoothed instantaneous speed in km/h.
   * Returns null if no accepted reading has arrived for > 5000 ms (stale).
   */
  getInstantaneousSpeedKmH(currentTimeMs?: number): number | null {
    if (!this.lastAcceptedReading || this.latestSmoothedSpeedKmH === null) {
      return null;
    }
    const now = currentTimeMs ?? this.clocks.nowWallClock();
    if (now - this.lastAcceptedReading.timestamp > STALE_SPEED_TIMEOUT_MS) {
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

  private updateInstantaneousSpeed(reading: GpsReading, displacementMeters: number): void {
    let sampleMps: number;

    if (reading.speed !== null && !Number.isNaN(reading.speed) && reading.speed >= 0) {
      sampleMps = reading.speed;
    } else if (this.lastAcceptedReading) {
      const dt = (reading.timestamp - this.lastAcceptedReading.timestamp) / 1000;
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
