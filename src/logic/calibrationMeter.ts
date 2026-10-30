/**
 * Calibration distance meter.
 *
 * Dedicated, independent distance meter for Step 2 of odometer calibration.
 * Reuses DistanceAccumulator (bad-reading filter, jitter rejection, displacement accumulation)
 * and GpsReader abstraction.
 *
 * Completely isolated from RallyTracker: measuring a calibration zone never alters
 * race distance, average speed, or ahead/behind delta.
 */

import { DistanceAccumulator, type AccumulatorStepResult } from './distanceAccumulator';
import type { GpsReader, GpsReading, GpsStatus } from './gpsReader';
import { isCalibrationAllowed } from './calibration';

export type CalibrationState = 'idle' | 'measuring' | 'stopped';

export interface CalibrationSnapshot {
  state: CalibrationState;
  measuredDistanceKm: number;
  gpsStatus: GpsStatus;
}

export interface CalibrationMeterOptions {
  reader?: GpsReader;
  isRaceRunning?: () => boolean;
}

export class CalibrationMeter {
  private state: CalibrationState = 'idle';
  private readonly accumulator: DistanceAccumulator;
  private readonly reader?: GpsReader;
  private readonly isRaceRunning?: () => boolean;
  private listeners = new Set<(snapshot: CalibrationSnapshot) => void>();
  private unsubReaderReading?: () => void;
  private unsubReaderStatus?: () => void;

  constructor(options: CalibrationMeterOptions = {}) {
    this.accumulator = new DistanceAccumulator();
    this.reader = options.reader;
    this.isRaceRunning = options.isRaceRunning;

    if (this.reader) {
      this.unsubReaderReading = this.reader.onReading((reading) => {
        this.processReading(reading);
      });
      this.unsubReaderStatus = this.reader.onStatusChange(() => {
        this.notifyListeners();
      });
    }
  }

  /**
   * Subscribes to meter state updates.
   */
  subscribe(listener: (snapshot: CalibrationSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  /**
   * Queries whether calibration can be started (blocked if race is running).
   */
  isAllowed(): boolean {
    const raceRunning = this.isRaceRunning ? this.isRaceRunning() : false;
    return isCalibrationAllowed(raceRunning);
  }

  /**
   * Current lifecycle state of calibration meter: 'idle' | 'measuring' | 'stopped'.
   */
  getState(): CalibrationState {
    return this.state;
  }

  /**
   * Returns raw measured distance in km at full precision.
   */
  getMeasuredDistanceKm(): number {
    return this.accumulator.getRawDistanceKm();
  }

  /**
   * Current snapshot of the calibration meter.
   */
  getSnapshot(): CalibrationSnapshot {
    return {
      state: this.state,
      measuredDistanceKm: this.accumulator.getRawDistanceKm(),
      gpsStatus: this.reader ? this.reader.getStatus() : 'idle',
    };
  }

  /**
   * Starts measuring a calibration zone (INICIAR).
   * Resets distance to a clean zero.
   * Starts the GPS reader.
   * Returns false if blocked by an active race.
   */
  start(): boolean {
    if (!this.isAllowed()) {
      return false;
    }

    this.accumulator.reset();
    this.state = 'measuring';

    if (this.reader) {
      const status = this.reader.getStatus();
      if (
        status === 'idle' ||
        status === 'denied' ||
        status === 'unavailable' ||
        status === 'timeout'
      ) {
        this.reader.start();
      }
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Pauses / freezes the measured distance (PARAR).
   * Stops the GPS reader.
   */
  stop(): void {
    if (this.state !== 'measuring') {
      return;
    }

    this.state = 'stopped';

    if (this.reader) {
      this.reader.stop();
    }

    this.notifyListeners();
  }

  /**
   * Resets the meter back to idle state with zero distance.
   * Stops the GPS reader.
   */
  reset(): void {
    this.accumulator.reset();
    this.state = 'idle';

    if (this.reader) {
      this.reader.stop();
    }

    this.notifyListeners();
  }

  /**
   * Evaluates an incoming GPS reading.
   * Readings received while not measuring ('idle' or 'stopped') are ignored.
   */
  processReading(reading: GpsReading): {
    accepted: boolean;
    measuredDistanceKm: number;
    step?: AccumulatorStepResult;
  } {
    if (this.state !== 'measuring') {
      return {
        accepted: false,
        measuredDistanceKm: this.accumulator.getRawDistanceKm(),
      };
    }

    const step = this.accumulator.processReading(reading, true);
    if (step.accepted) {
      this.notifyListeners();
    }

    return {
      accepted: step.accepted,
      measuredDistanceKm: this.accumulator.getRawDistanceKm(),
      step,
    };
  }

  /**
   * Cleans up listener subscriptions and releases reader if measuring.
   */
  destroy(): void {
    this.unsubReaderReading?.();
    this.unsubReaderStatus?.();
    if (this.state === 'measuring') {
      this.reader?.stop();
    }
    this.listeners.clear();
  }
}
