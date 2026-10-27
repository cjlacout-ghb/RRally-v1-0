import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters, destinationCoordinate } from './geo';
import { EARTH_RADIUS_METERS } from './gpsConstants';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceMeters(0, 0, 0, 0)).toBe(0);
    expect(haversineDistanceMeters(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0);
  });

  it('accurately computes 1 degree on the equator', () => {
    // 1 degree on equator = R * (pi / 180)
    const expected = EARTH_RADIUS_METERS * (Math.PI / 180);
    const calculated = haversineDistanceMeters(0, 0, 0, 1);
    expect(calculated).toBeCloseTo(expected, 4);
    expect(calculated).toBeCloseTo(111194.9, 1);
  });

  it('accurately computes 90 degrees from equator to North Pole', () => {
    const expected = EARTH_RADIUS_METERS * (Math.PI / 2);
    const calculated = haversineDistanceMeters(0, 0, 90, 0);
    expect(calculated).toBeCloseTo(expected, 4);
    expect(calculated).toBeCloseTo(10007543.4, 1);
  });

  it('matches known geodesy reference distance: Paris to London', () => {
    // Paris: 48.8566 N, 2.3522 E
    // London: 51.5074 N, -0.1278 W
    // Great-circle with R=6371000 m is ~343.556 km
    const distance = haversineDistanceMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(343500);
    expect(distance).toBeLessThan(343600);
    expect(Math.round(distance)).toBe(343556);
  });

  it('matches known distance: Obelisco to Plaza de Mayo (Buenos Aires)', () => {
    // Obelisco: -34.6037389, -58.3815704
    // Plaza de Mayo: -34.608333, -58.371944
    // Distance is approximately 1.04 km
    const distance = haversineDistanceMeters(-34.6037389, -58.3815704, -34.608333, -58.371944);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1100);
  });
});

describe('destinationCoordinate', () => {
  it('returns same coordinates when distance is 0', () => {
    const result = destinationCoordinate(-34.6, -58.4, 0, 90);
    expect(result.latitude).toBe(-34.6);
    expect(result.longitude).toBe(-58.4);
  });

  it('projects coordinate accurately heading North along meridian', () => {
    const startLat = 0;
    const startLon = 0;
    const dist = 111194.9266; // 1 degree
    const dest = destinationCoordinate(startLat, startLon, dist, 0);
    expect(dest.latitude).toBeCloseTo(1, 4);
    expect(dest.longitude).toBeCloseTo(0, 4);

    // Distance back should match
    const backDist = haversineDistanceMeters(startLat, startLon, dest.latitude, dest.longitude);
    expect(backDist).toBeCloseTo(dist, 1);
  });
});
