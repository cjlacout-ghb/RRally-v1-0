/**
 * Spherical geodesy calculations (great-circle distance and destination coordinates).
 */

import { EARTH_RADIUS_METERS } from './gpsConstants';

export interface LatLon {
  latitude: number;
  longitude: number;
}

const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

/**
 * Calculates great-circle distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number = EARTH_RADIUS_METERS
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const phi1 = lat1 * TO_RADIANS;
  const phi2 = lat2 * TO_RADIANS;
  const deltaPhi = (lat2 - lat1) * TO_RADIANS;
  const deltaLambda = (lon2 - lon1) * TO_RADIANS;

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const a =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  // Clamp to [0, 1] to avoid NaN from numerical float inaccuracies
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(Math.max(0, 1 - clampedA)));

  return radiusMeters * c;
}

/**
 * Computes destination coordinate given starting coordinate, distance in meters, and bearing in degrees.
 * Used for synthetic route simulation.
 */
export function destinationCoordinate(
  startLat: number,
  startLon: number,
  distanceMeters: number,
  bearingDegrees: number,
  radiusMeters: number = EARTH_RADIUS_METERS
): LatLon {
  if (distanceMeters === 0) {
    return { latitude: startLat, longitude: startLon };
  }

  const delta = distanceMeters / radiusMeters;
  const theta = bearingDegrees * TO_RADIANS;
  const phi1 = startLat * TO_RADIANS;
  const lambda1 = startLon * TO_RADIANS;

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
  const phi2 = Math.asin(Math.min(1, Math.max(-1, sinPhi2)));

  const y = Math.sin(theta) * sinDelta * cosPhi1;
  const x = cosDelta - sinPhi1 * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);

  const lat2 = phi2 * TO_DEGREES;
  let lon2 = lambda2 * TO_DEGREES;

  // Normalize longitude to [-180, 180]
  lon2 = ((lon2 + 540) % 360) - 180;

  return {
    latitude: lat2,
    longitude: lon2,
  };
}
