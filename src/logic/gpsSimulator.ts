/**
 * Dev-only deterministic GPS simulator.
 *
 * Emits synthetic GPS readings along a bearing at configurable speed and noise.
 * Supports seeded deterministic PRNG and bad-reading injection for testing.
 *
 * Strictly guarded: this module must never be imported in production builds.
 */

import { destinationCoordinate } from './geo';
import type { GpsReading, GpsReader, GpsStatus } from './gpsReader';
import { type Clocks, defaultClocks } from './stopwatch';

export type BadReadingType =
  | 'poor_accuracy'
  | 'duplicate_timestamp'
  | 'out_of_order_timestamp'
  | 'implausible_jump';

export interface GpsSimulatorOptions {
  /** PRNG seed for deterministic noise and trajectory. */
  seed?: number;
  /** Constant simulated ground speed in km/h. Default: 50. */
  speedKmH?: number;
  /** Starting latitude in decimal degrees. Default: -34.6037 (Buenos Aires). */
  startLatitude?: number;
  /** Starting longitude in decimal degrees. Default: -58.3816. */
  startLongitude?: number;
  /** Heading direction in degrees (0 = North). Default: 0. */
  bearingDegrees?: number;
  /** Random coordinate noise amplitude in meters. Default: 0.5. */
  noiseMeters?: number;
  /** Base horizontal accuracy in meters. Default: 5. */
  accuracyMeters?: number;
  /** Time step interval in milliseconds. Default: 1000. */
  intervalMs?: number;
  /** Starting epoch timestamp in ms. If omitted, live wall clock is used. */
  startTimeMs?: number;
  /** Time providers for testability and live simulation. */
  clocks?: Clocks;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
function createMulberry32(seed: number): () => number {
  let s = seed | 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GpsSimulator implements GpsReader {
  private status: GpsStatus = 'idle';
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<(reading: GpsReading) => void>();
  private readonly statusListeners = new Set<(status: GpsStatus) => void>();

  private readonly prng: () => number;
  private readonly speedKmH: number;
  private readonly bearingDegrees: number;
  private readonly noiseMeters: number;
  private readonly accuracyMeters: number;
  private readonly intervalMs: number;
  private readonly clocks: Clocks;
  private readonly isExplicitStartTime: boolean;
  private isLiveMode: boolean;

  private currentLat: number;
  private currentLon: number;
  private currentTimestamp: number;
  private lastEmittedTimestamp: number | null = null;
  private pendingBadReading: BadReadingType | null = null;

  constructor(options: GpsSimulatorOptions = {}) {
    const seed = options.seed ?? 12345;
    this.prng = createMulberry32(seed);

    this.speedKmH = options.speedKmH ?? 50;
    this.bearingDegrees = options.bearingDegrees ?? 0;
    this.noiseMeters = options.noiseMeters ?? 0.5;
    this.accuracyMeters = options.accuracyMeters ?? 5;
    this.intervalMs = options.intervalMs ?? 1000;
    this.clocks = options.clocks ?? defaultClocks;

    this.currentLat = options.startLatitude ?? -34.6037;
    this.currentLon = options.startLongitude ?? -58.3816;

    this.isExplicitStartTime = options.startTimeMs !== undefined;
    this.isLiveMode = options.startTimeMs === undefined && options.clocks !== undefined;
    this.currentTimestamp = options.startTimeMs ?? 1700000000000;
  }

  getStatus(): GpsStatus {
    return this.status;
  }

  onReading(callback: (reading: GpsReading) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  onStatusChange(callback: (status: GpsStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Queues a bad reading to be emitted on the next tick.
   */
  injectBadReading(type: BadReadingType): void {
    this.pendingBadReading = type;
  }

  /**
   * Advances simulation by one step and emits a reading.
   * Useful for synchronous, deterministic testing.
   */
  tick(badReadingOverride?: BadReadingType): GpsReading {
    const badType = badReadingOverride ?? this.pendingBadReading;
    this.pendingBadReading = null;

    let readingTimestamp: number;
    if (this.isLiveMode) {
      const now = this.clocks.nowWallClock();
      if (this.lastEmittedTimestamp !== null && now <= this.lastEmittedTimestamp) {
        readingTimestamp = this.lastEmittedTimestamp + 1;
      } else {
        readingTimestamp = now;
      }
      this.currentTimestamp = readingTimestamp;
    } else {
      this.currentTimestamp += this.intervalMs;
      readingTimestamp = this.currentTimestamp;
    }

    let reading: GpsReading;

    if (badType === 'poor_accuracy') {
      this.lastEmittedTimestamp = readingTimestamp;
      reading = {
        latitude: this.currentLat,
        longitude: this.currentLon,
        accuracy: 45, // > 30m threshold
        speed: this.speedKmH / 3.6,
        timestamp: readingTimestamp,
      };
    } else if (badType === 'duplicate_timestamp') {
      const duplicateTs = this.lastEmittedTimestamp ?? readingTimestamp;
      reading = {
        latitude: this.currentLat,
        longitude: this.currentLon,
        accuracy: this.accuracyMeters,
        speed: this.speedKmH / 3.6,
        timestamp: duplicateTs, // Same timestamp as previous
      };
    } else if (badType === 'out_of_order_timestamp') {
      const baseTs = this.lastEmittedTimestamp ?? readingTimestamp;
      reading = {
        latitude: this.currentLat,
        longitude: this.currentLon,
        accuracy: this.accuracyMeters,
        speed: this.speedKmH / 3.6,
        timestamp: baseTs - 1000, // Older timestamp
      };
    } else if (badType === 'implausible_jump') {
      this.lastEmittedTimestamp = readingTimestamp;
      // Jump 5000 meters in 1 second (implies 5000 m/s > 70 m/s)
      const jumped = destinationCoordinate(
        this.currentLat,
        this.currentLon,
        5000,
        this.bearingDegrees
      );
      this.currentLat = jumped.latitude;
      this.currentLon = jumped.longitude;
      reading = {
        latitude: this.currentLat,
        longitude: this.currentLon,
        accuracy: this.accuracyMeters,
        speed: this.speedKmH / 3.6,
        timestamp: readingTimestamp,
      };
    } else {
      this.lastEmittedTimestamp = readingTimestamp;
      // Normal tick: advance position and add small pseudo-random noise
      const speedMps = this.speedKmH / 3.6;
      const stepDistanceMeters = speedMps * (this.intervalMs / 1000);

      const nextBase = destinationCoordinate(
        this.currentLat,
        this.currentLon,
        stepDistanceMeters,
        this.bearingDegrees
      );

      // Pseudo-random noise between -noiseMeters and +noiseMeters
      const noiseDistance = (this.prng() - 0.5) * 2 * this.noiseMeters;
      const noiseBearing = this.prng() * 360;
      const noisyCoord = destinationCoordinate(
        nextBase.latitude,
        nextBase.longitude,
        Math.abs(noiseDistance),
        noiseBearing
      );

      this.currentLat = noisyCoord.latitude;
      this.currentLon = noisyCoord.longitude;

      reading = {
        latitude: this.currentLat,
        longitude: this.currentLon,
        accuracy: this.accuracyMeters,
        speed: speedMps,
        timestamp: readingTimestamp,
      };
    }

    for (const listener of this.listeners) {
      listener(reading);
    }

    return reading;
  }

  start(): void {
    if (this.status === 'active') return;
    this.status = 'active';
    if (!this.isExplicitStartTime) {
      this.isLiveMode = true;
    }
    for (const listener of this.statusListeners) {
      listener('active');
    }
    this.timerId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.status = 'idle';
    this.lastEmittedTimestamp = null;
    for (const listener of this.statusListeners) {
      listener('idle');
    }
  }
}
