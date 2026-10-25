/**
 * Pure geometry and scale mapping for the odometer dial.
 *
 * The dial scale is a 270-degree clockwise sweep:
 * - 0 km/h is at lower left (-135 degrees relative to 12 o'clock).
 * - 120 km/h is at lower right (+135 degrees relative to 12 o'clock).
 */

export const DIAL_MIN_SPEED = 0;
export const DIAL_MAX_SPEED = 120;
export const DIAL_SWEEP_DEGREES = 270;
export const DIAL_START_ANGLE_DEGREES = -135;
export const DIAL_DEGREES_PER_KMH = DIAL_SWEEP_DEGREES / DIAL_MAX_SPEED; // 2.25

export const DIAL_VIEWBOX_SIZE = 176;
export const DIAL_CENTER = 88;
export const DIAL_OUTER_RADIUS = 87;
export const DIAL_TICK_OUTER_RADIUS = 84;
export const DIAL_TICK_MINOR_INNER_RADIUS = 76;
export const DIAL_TICK_MAJOR_INNER_RADIUS = 68;
export const DIAL_NUMERAL_RADIUS = 54;
export const DIAL_MARKER_INNER_RADIUS = 62;
export const DIAL_MARKER_OUTER_RADIUS = 87;

export interface DialPoint {
  x: number;
  y: number;
}

export interface DialTick {
  speed: number;
  isMajor: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  numeral?: {
    x: number;
    y: number;
    label: string;
  };
}

export interface DialMarker {
  angleDegrees: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Maps speed (km/h) to dial marker angle in degrees (-135 at 0 km/h to +135 at 120 km/h).
 * Clamps speed to [0, 120].
 * Returns null if speed is null, undefined, or NaN.
 */
export function getDialMarkerAngle(speed: number | null | undefined): number | null {
  if (speed === null || speed === undefined || Number.isNaN(speed)) {
    return null;
  }
  const clamped = Math.max(DIAL_MIN_SPEED, Math.min(DIAL_MAX_SPEED, speed));
  return DIAL_START_ANGLE_DEGREES + clamped * DIAL_DEGREES_PER_KMH;
}

/**
 * Converts degrees to radians.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates (x, y) coordinates for a given radius and angle in radians,
 * where 0 rad is 12 o'clock and angle increases clockwise.
 */
export function polarToCartesian(
  radius: number,
  angleRad: number,
  cx = DIAL_CENTER,
  cy = DIAL_CENTER
): DialPoint {
  return {
    x: cx + radius * Math.sin(angleRad),
    y: cy - radius * Math.cos(angleRad),
  };
}

/**
 * Computes marker line coordinates for a given speed.
 * Returns null if speed is null or invalid.
 */
export function getDialMarker(
  speed: number | null | undefined,
  cx = DIAL_CENTER,
  cy = DIAL_CENTER
): DialMarker | null {
  const angleDeg = getDialMarkerAngle(speed);
  if (angleDeg === null) {
    return null;
  }

  const rad = degreesToRadians(angleDeg);
  const p1 = polarToCartesian(DIAL_MARKER_INNER_RADIUS, rad, cx, cy);
  const p2 = polarToCartesian(DIAL_MARKER_OUTER_RADIUS, rad, cx, cy);

  return {
    angleDegrees: angleDeg,
    x1: Math.round(p1.x * 100) / 100,
    y1: Math.round(p1.y * 100) / 100,
    x2: Math.round(p2.x * 100) / 100,
    y2: Math.round(p2.y * 100) / 100,
  };
}

/**
 * Pre-computes all tick and numeral coordinates for speeds 0, 10, ..., 120.
 */
export function getDialTicks(cx = DIAL_CENTER, cy = DIAL_CENTER): DialTick[] {
  const ticks: DialTick[] = [];

  for (let speed = DIAL_MIN_SPEED; speed <= DIAL_MAX_SPEED; speed += 10) {
    const isMajor = speed % 40 === 0;
    const angleDeg = DIAL_START_ANGLE_DEGREES + speed * DIAL_DEGREES_PER_KMH;
    const rad = degreesToRadians(angleDeg);

    const innerRadius = isMajor ? DIAL_TICK_MAJOR_INNER_RADIUS : DIAL_TICK_MINOR_INNER_RADIUS;
    const p1 = polarToCartesian(innerRadius, rad, cx, cy);
    const p2 = polarToCartesian(DIAL_TICK_OUTER_RADIUS, rad, cx, cy);

    let numeral: DialTick['numeral'] = undefined;
    if (isMajor) {
      const pn = polarToCartesian(DIAL_NUMERAL_RADIUS, rad, cx, cy);
      numeral = {
        x: Math.round(pn.x * 100) / 100,
        // Y offset + 4px for central vertical alignment in SVG
        y: Math.round((pn.y + 4) * 100) / 100,
        label: speed.toString(),
      };
    }

    ticks.push({
      speed,
      isMajor,
      x1: Math.round(p1.x * 100) / 100,
      y1: Math.round(p1.y * 100) / 100,
      x2: Math.round(p2.x * 100) / 100,
      y2: Math.round(p2.y * 100) / 100,
      numeral,
    });
  }

  return ticks;
}
