import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserGpsReader, type GpsReading, type GpsStatus } from './gpsReader';

describe('BrowserGpsReader', () => {
  let watchPositionMock: any;
  let clearWatchMock: any;

  beforeEach(() => {
    watchPositionMock = vi.fn();
    clearWatchMock = vi.fn();

    // Setup global navigator.geolocation mock
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts in "idle" status without calling watchPosition or requesting permissions', () => {
    const reader = new BrowserGpsReader();
    expect(reader.getStatus()).toBe('idle');
    expect(watchPositionMock).not.toHaveBeenCalled();
  });

  it('sets status to "unavailable" when navigator.geolocation is absent', () => {
    vi.stubGlobal('navigator', {});
    const reader = new BrowserGpsReader();
    reader.start();
    expect(reader.getStatus()).toBe('unavailable');
  });

  it('requests watchPosition with high accuracy and maximumAge 0 when started', () => {
    const reader = new BrowserGpsReader();
    reader.start();

    expect(reader.getStatus()).toBe('active');
    expect(watchPositionMock).toHaveBeenCalledTimes(1);
    const options = watchPositionMock.mock.calls[0][2];
    expect(options.enableHighAccuracy).toBe(true);
    expect(options.maximumAge).toBe(0);
  });

  it('emits readings with correct properties when geolocation updates', () => {
    const reader = new BrowserGpsReader();
    let receivedReading: GpsReading | null = null;
    reader.onReading((r) => {
      receivedReading = r;
    });

    reader.start();

    // Trigger success callback
    const successCb = watchPositionMock.mock.calls[0][0];
    const mockPosition = {
      coords: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 8.5,
        speed: 13.8, // ~50 km/h
      },
      timestamp: 1672531200000,
    };
    successCb(mockPosition);

    expect(receivedReading).toEqual({
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 8.5,
      speed: 13.8,
      timestamp: 1672531200000,
    });
  });

  it('normalizes invalid or negative speed to null', () => {
    const reader = new BrowserGpsReader();
    let receivedReading: GpsReading | null = null;
    reader.onReading((r) => {
      receivedReading = r;
    });
    reader.start();

    const successCb = watchPositionMock.mock.calls[0][0];
    successCb({
      coords: { latitude: 0, longitude: 0, accuracy: 5, speed: -1 },
      timestamp: 1000,
    });

    expect(receivedReading?.speed).toBeNull();
  });

  it('maps geolocation error codes correctly to GpsStatus', () => {
    const reader = new BrowserGpsReader();
    const statuses: GpsStatus[] = [];
    reader.onStatusChange((s) => statuses.push(s));

    reader.start();
    const errorCb = watchPositionMock.mock.calls[0][1];

    // Code 1: PERMISSION_DENIED
    errorCb({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('denied');

    // Code 2: POSITION_UNAVAILABLE
    errorCb({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('unavailable');

    // Code 3: TIMEOUT
    errorCb({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('timeout');

    expect(statuses).toEqual(['active', 'denied', 'unavailable', 'timeout']);
  });

  it('recovers status to "active" when a valid reading arrives after timeout or unavailable', () => {
    const reader = new BrowserGpsReader();
    const statuses: GpsStatus[] = [];
    reader.onStatusChange((s) => statuses.push(s));

    reader.start();
    const successCb = watchPositionMock.mock.calls[0][0];
    const errorCb = watchPositionMock.mock.calls[0][1];

    // Trigger timeout error
    errorCb({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('timeout');

    // Valid reading arrives after timeout
    successCb({
      coords: { latitude: -34.6, longitude: -58.4, accuracy: 10, speed: 12 },
      timestamp: 20000,
    });
    expect(reader.getStatus()).toBe('active');

    // Trigger unavailable error
    errorCb({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('unavailable');

    // Valid reading arrives after unavailable
    successCb({
      coords: { latitude: -34.601, longitude: -58.401, accuracy: 8, speed: 12 },
      timestamp: 21000,
    });
    expect(reader.getStatus()).toBe('active');

    expect(statuses).toEqual(['active', 'timeout', 'active', 'unavailable', 'active']);
  });

  it('re-tries starting geolocation when start() is called from denied, unavailable, or timeout', () => {
    const reader = new BrowserGpsReader();
    reader.start();
    expect(watchPositionMock).toHaveBeenCalledTimes(1);

    // Simulate permission denied
    const errorCb = watchPositionMock.mock.calls[0][1];
    errorCb({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(reader.getStatus()).toBe('denied');

    // User taps INICIAR again -> re-try start()
    reader.start();
    expect(watchPositionMock).toHaveBeenCalledTimes(2);
    expect(reader.getStatus()).toBe('active');
  });

  it('stops watch and restores "idle" status on stop()', () => {
    watchPositionMock.mockReturnValue(42);
    const reader = new BrowserGpsReader();
    reader.start();
    expect(reader.getStatus()).toBe('active');

    reader.stop();
    expect(clearWatchMock).toHaveBeenCalledWith(42);
    expect(reader.getStatus()).toBe('idle');
  });

  it('unsubscribes listeners correctly', () => {
    const reader = new BrowserGpsReader();
    const mockCb = vi.fn();
    const unsubscribe = reader.onReading(mockCb);

    reader.start();
    const successCb = watchPositionMock.mock.calls[0][0];
    successCb({
      coords: { latitude: 0, longitude: 0, accuracy: 5, speed: 0 },
      timestamp: 1000,
    });
    expect(mockCb).toHaveBeenCalledTimes(1);

    unsubscribe();
    successCb({
      coords: { latitude: 0, longitude: 0, accuracy: 5, speed: 0 },
      timestamp: 2000,
    });
    expect(mockCb).toHaveBeenCalledTimes(1);
  });
});
