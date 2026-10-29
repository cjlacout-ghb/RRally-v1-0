/**
 * GPS reader abstraction and browser Geolocation API implementation.
 *
 * Privacy guarantee: coordinates are strictly in-memory, never persisted to storage,
 * and never logged to console or network.
 */

export interface GpsReading {
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
  /** Horizontal accuracy in meters (radius of 68% confidence). */
  accuracy: number;
  /** Device-reported instantaneous speed in meters per second, or null if unavailable. */
  speed: number | null;
  /** GPS fix timestamp in epoch milliseconds. */
  timestamp: number;
}

export type GpsStatus = 'idle' | 'active' | 'denied' | 'unavailable' | 'timeout';

export interface GpsReader {
  /** Starts reading GPS positions. Only this call requests browser permissions. */
  start(): void;
  /** Stops reading GPS positions and releases hardware resources. */
  stop(): void;
  /** Returns the current status of the reader. */
  getStatus(): GpsStatus;
  /** Subscribes to new GPS readings. Returns an unsubscribe function. */
  onReading(callback: (reading: GpsReading) => void): () => void;
  /** Subscribes to status changes. Returns an unsubscribe function. */
  onStatusChange(callback: (status: GpsStatus) => void): () => void;
}

/**
 * Production implementation wrapping `navigator.geolocation.watchPosition`.
 * High accuracy is enabled, cached positions are disallowed (maximumAge: 0).
 */
export class BrowserGpsReader implements GpsReader {
  private status: GpsStatus = 'idle';
  private watchId: number | null = null;
  private readingListeners = new Set<(reading: GpsReading) => void>();
  private statusListeners = new Set<(status: GpsStatus) => void>();

  getStatus(): GpsStatus {
    return this.status;
  }

  onReading(callback: (reading: GpsReading) => void): () => void {
    this.readingListeners.add(callback);
    return () => {
      this.readingListeners.delete(callback);
    };
  }

  onStatusChange(callback: (status: GpsStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  start(): void {
    if (this.status === 'active' && this.watchId !== null) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.updateStatus('unavailable');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    try {
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }

      this.watchId = navigator.geolocation.watchPosition(
        (position: GeolocationPosition) => {
          this.updateStatus('active');

          const coords = position.coords;
          const reportedSpeed =
            coords.speed !== null && !Number.isNaN(coords.speed) && coords.speed >= 0
              ? coords.speed
              : null;

          const reading: GpsReading = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            speed: reportedSpeed,
            timestamp: position.timestamp,
          };

          for (const listener of this.readingListeners) {
            listener(reading);
          }
        },
        (error: GeolocationPositionError) => {
          let mappedStatus: GpsStatus = 'unavailable';
          if (error.code === error.PERMISSION_DENIED) {
            mappedStatus = 'denied';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            mappedStatus = 'unavailable';
          } else if (error.code === error.TIMEOUT) {
            mappedStatus = 'timeout';
          }
          this.updateStatus(mappedStatus);
        },
        options
      );
      this.updateStatus('active');
    } catch {
      this.updateStatus('unavailable');
    }
  }

  stop(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.updateStatus('idle');
  }

  private updateStatus(newStatus: GpsStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        listener(newStatus);
      }
    }
  }
}
