/**
 * Race session bridge: single owner of race state.
 *
 * Coordinates the single start instant between the main Stopwatch and RallyTracker,
 * manages the GpsReader lifecycle (starts on INICIAR, stays active on PARAR, stops on REINICIAR),
 * manages the Screen Wake Lock (acquire on INICIAR, release on PARAR and REINICIAR),
 * and emits read-only snapshots for the UI.
 *
 * Sits above all UI screens so navigating between Carrera, Preparar Etapa,
 * and Calculadora never interrupts or resets a running race.
 */

import { RallyTracker } from './rallyTracker';
import type { GpsReader, GpsStatus } from './gpsReader';
import { Stopwatch, type Clocks, defaultClocks } from './stopwatch';
import { classifyDelta, type DeltaState } from './delta';
import { getGpsStatusLine, type GpsStatusKind } from './gpsStatus';
import { WakeLockManager, type WakeLockApi } from './wakeLock';
import { STALE_SPEED_TIMEOUT_MS } from './gpsConstants';
import { readCorrectionFactor } from '../storage';
import { isCalibrationAllowed } from './calibration';

export interface RaceSnapshot {
  speed: number | null;
  averageSpeed: number | null;
  distance: number | null;
  deltaSeconds: number | null;
  deltaState: DeltaState;
  isRunning: boolean;
  gpsStatus: GpsStatus;
  gpsStatusText: string;
  gpsStatusKind: GpsStatusKind;
  isCalibrationAllowed: boolean;
}

export interface RaceSessionBridgeOptions {
  tracker?: RallyTracker;
  reader: GpsReader;
  stopwatch?: Stopwatch;
  assignedSpeedKmH?: number | null;
  correctionFactor?: number;
  clocks?: Clocks;
  /** Injectable wake lock API for testing. Pass null to disable entirely. */
  wakeLockApi?: WakeLockApi | null;
}

export class RaceSessionBridge {
  readonly tracker: RallyTracker;
  readonly reader: GpsReader;
  readonly stopwatch: Stopwatch;
  private readonly clocks: Clocks;
  private readonly wakeLock: WakeLockManager;
  private correctionFactor?: number;

  private lastReadingTimestamp: number | null = null;
  private hasReceivedReading: boolean = false;
  private listeners = new Set<(snapshot: RaceSnapshot) => void>();
  private unsubReaderReading?: () => void;
  private unsubReaderStatus?: () => void;

  constructor(options: RaceSessionBridgeOptions) {
    this.clocks = options.clocks ?? defaultClocks;
    this.reader = options.reader;
    this.stopwatch = options.stopwatch ?? new Stopwatch(this.clocks);
    this.correctionFactor = options.correctionFactor;
    this.tracker =
      options.tracker ??
      new RallyTracker({
        clocks: this.clocks,
        assignedSpeedKmH: options.assignedSpeedKmH ?? null,
        correctionFactor: options.correctionFactor ?? readCorrectionFactor(),
      });

    // wakeLockApi=undefined → use real browser API; wakeLockApi=null → disabled (tests)
    this.wakeLock = new WakeLockManager(
      options.wakeLockApi !== undefined ? options.wakeLockApi : undefined
    );

    this.setupReaderSubscriptions();
  }

  private setupReaderSubscriptions(): void {
    this.unsubReaderReading = this.reader.onReading((reading) => {
      this.tracker.processReading(reading);
      this.lastReadingTimestamp = reading.timestamp;
      this.hasReceivedReading = true;
      this.notifyListeners();
    });

    this.unsubReaderStatus = this.reader.onStatusChange(() => {
      this.notifyListeners();
    });
  }

  /**
   * Replaces the GPS reader (used in development to switch to the simulator).
   */
  setReader(newReader: GpsReader): void {
    this.unsubReaderReading?.();
    this.unsubReaderStatus?.();
    (this as any).reader = newReader;
    this.setupReaderSubscriptions();
    this.notifyListeners();
  }

  /**
   * Subscribes to snapshot updates.
   */
  subscribe(listener: (snapshot: RaceSnapshot) => void): () => void {
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
   * Updates assigned stage speed (from Preparar Etapa) without resetting the race.
   */
  setAssignedSpeed(speed: number | null): void {
    this.tracker.setAssignedSpeed(speed);
    this.notifyListeners();
  }

  /**
   * Updates odometer correction factor without resetting the race.
   */
  setCorrectionFactor(factor: number): void {
    this.correctionFactor = factor;
    this.tracker.setCorrectionFactor(factor);
    this.notifyListeners();
  }

  /**
   * Queries whether calibration can be performed (blocked when stopwatch is running).
   */
  isCalibrationAllowed(): boolean {
    return isCalibrationAllowed(this.stopwatch.isRunning());
  }

  /**
   * Starts or resumes the race (INICIAR).
   * Reads wall-clock time once and shares this exact single instant between
   * the main stopwatch and RallyTracker. Starts or retries the GPS reader.
   * Acquires the screen wake lock.
   */
  start(startWallClock?: number): void {
    // If not running, ensure tracker has the latest stored factor if not explicitly overridden
    if (!this.stopwatch.isRunning()) {
      const activeFactor = this.correctionFactor ?? readCorrectionFactor();
      this.tracker.setCorrectionFactor(activeFactor);
    }

    const now = startWallClock ?? this.clocks.nowWallClock();
    const nowMono = this.clocks.nowMonotonic();

    this.stopwatch.start(now, nowMono);
    this.tracker.start(now);

    // Each start (or resume) resets the memory of having received a valid reading,
    // so the GPS status line shows "BUSCANDO GPS…" until the first valid reading arrives.
    this.hasReceivedReading = false;
    this.lastReadingTimestamp = null;

    const status = this.reader.getStatus();
    if (
      status === 'idle' ||
      status === 'denied' ||
      status === 'unavailable' ||
      status === 'timeout'
    ) {
      this.reader.start();
    }

    // Acquire wake lock (fire-and-forget; errors are swallowed inside WakeLockManager)
    void this.wakeLock.acquire();

    this.notifyListeners();
  }

  /**
   * Pauses the race (PARAR).
   * Freezes stopwatch and tracker; stops the GPS reader (clears watch)
   * and clears the GPS status line (empty).
   * Releases the screen wake lock.
   */
  stop(stopWallClock?: number): void {
    const now = stopWallClock ?? this.clocks.nowWallClock();
    this.stopwatch.stop();
    this.tracker.stop(now);
    this.reader.stop();
    this.lastReadingTimestamp = null;
    void this.wakeLock.release();
    this.notifyListeners();
  }

  /**
   * Resets the race (REINICIAR).
   * Resets stopwatch, tracker (distance, adjustments, delta, speed window),
   * stops the GPS reader, restores idle status, and releases the wake lock.
   */
  reset(): void {
    this.stopwatch.reset();
    this.tracker.reset();
    this.reader.stop();
    void this.wakeLock.release();

    this.lastReadingTimestamp = null;
    this.hasReceivedReading = false;
    this.notifyListeners();
  }

  /**
   * Adjusts displayed distance by 10 meters per press (+1 or -1).
   */
  adjustDistance(step: -1 | 1): void {
    this.tracker.adjustDistance(step);
    this.notifyListeners();
  }

  /**
   * Periodic tick (e.g. 1 second) to refresh time-based rules (stale speed).
   */
  tick(): void {
    this.notifyListeners();
  }

  /**
   * Called on visibilitychange events.
   *
   * When becoming visible:
   *   - Applies wall-clock correction to the stopwatch (handles iOS monotonic clock stall).
   *   - If the GPS reader is in timeout/unavailable and a session is active (reader was started),
   *     restarts the watch. Never restarts when denied.
   *   - Re-acquires the wake lock if the race is running.
   *   - Refreshes the snapshot so the UI is not stale.
   *
   * When hiding: no-op (nothing is stopped or reset).
   */
  onVisibilityChange(visible: boolean): void {
    if (visible) {
      // 1. Correct stopwatch for monotonic stall during page hide / screen lock
      this.stopwatch.onVisibilityChange(true);

      // 2. Restart a stalled GPS reader (timeout/unavailable), but only if running and not denied or idle
      const status = this.reader.getStatus();
      const now = this.clocks.nowWallClock();
      const isStale =
        this.lastReadingTimestamp !== null &&
        now - this.lastReadingTimestamp > STALE_SPEED_TIMEOUT_MS;

      if (
        this.stopwatch.isRunning() &&
        (status === 'timeout' ||
          status === 'unavailable' ||
          (status === 'active' && isStale))
      ) {
        this.reader.start();
      }

      // 3. Re-acquire wake lock if running
      void this.wakeLock.onPageVisible(true, this.stopwatch.isRunning());

      // 4. Refresh snapshot
      this.notifyListeners();
    }
    // On hide: do nothing
  }

  /**
   * Computes a read-only UI snapshot.
   */
  getSnapshot(): RaceSnapshot {
    const now = this.clocks.nowWallClock();
    const isRunning = this.stopwatch.isRunning();

    // Speed calculation:
    // - While stopped (idle or after PARAR), instantaneous speed is null ("--,-") because there are no live readings.
    // - While running, if at least one valid reading has arrived, a gap > STALE_SPEED_TIMEOUT_MS displays 0,0 km/h.
    // - While running before the first reading, speed is null ("--,-").
    let speed: number | null = null;
    if (isRunning) {
      if (this.hasReceivedReading) {
        const rawSpeed = this.tracker.getInstantaneousSpeedKmH(now);
        speed = rawSpeed ?? 0;
      } else {
        speed = null;
      }
    } else {
      speed = null;
    }

    const averageSpeed = this.tracker.getAverageSpeedKmH();
    const distance = this.tracker.getDisplayedDistanceKm();
    const elapsedMs = this.stopwatch.getElapsedMs();
    const deltaSeconds = this.tracker.getDeltaSeconds(elapsedMs, now);
    const deltaState = classifyDelta(deltaSeconds);
    const gpsStatus = this.reader.getStatus();

    const statusLine = getGpsStatusLine({
      status: gpsStatus,
      hasReceivedReading: this.hasReceivedReading,
    });

    return {
      speed,
      averageSpeed,
      distance,
      deltaSeconds,
      deltaState,
      isRunning,
      gpsStatus,
      gpsStatusText: statusLine.text,
      gpsStatusKind: statusLine.kind,
      isCalibrationAllowed: this.isCalibrationAllowed(),
    };
  }

  /**
   * Cleans up listener subscriptions when destroyed.
   */
  destroy(): void {
    this.unsubReaderReading?.();
    this.unsubReaderStatus?.();
    this.listeners.clear();
  }
}
