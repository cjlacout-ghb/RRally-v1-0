/**
 * Number and time formatting using Argentine locale conventions (decimal comma).
 */

/**
 * Formats a speed in km/h with 1 decimal place using a comma (e.g. "49,8").
 * Returns "--,-" if speed is null, undefined, or NaN.
 */
export function formatSpeed(speed: number | null | undefined): string {
  if (speed === null || speed === undefined || Number.isNaN(speed)) {
    return '--,-';
  }
  return speed.toFixed(1).replace('.', ',');
}

/**
 * Formats a distance in km with 3 decimal places using a comma (e.g. "14,820").
 * Returns "--,---" if distance is null, undefined, or NaN.
 */
export function formatDistance(distance: number | null | undefined): string {
  if (distance === null || distance === undefined || Number.isNaN(distance)) {
    return '--,---';
  }
  return distance.toFixed(3).replace('.', ',');
}

/**
 * Formats a signed delta in seconds with 1 decimal place (e.g. "+1,8", "-2,3").
 * Returns "0,0" without a sign when the rounded value is 0.0.
 * Returns "--,-" if delta is null, undefined, or NaN.
 */
export function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return '--,-';
  }

  // Round to 1 decimal place
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0 || Object.is(rounded, -0)) {
    return '0,0';
  }

  const formatted = Math.abs(rounded).toFixed(1).replace('.', ',');
  return rounded > 0 ? `+${formatted}` : `-${formatted}`;
}

/**
 * Formats elapsed stopwatch milliseconds:
 * - "MM:SS,cc" if elapsed time is less than 1 hour.
 * - "HH:MM:SS,cc" once elapsed time reaches or exceeds 1 hour.
 * 'cc' represents hundredths of a second (00-99).
 */
export function formatStopwatch(elapsedMs: number): string {
  const safeMs = Math.max(0, Math.floor(elapsedMs));

  const totalHundredths = Math.floor(safeMs / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const cc = hundredths.toString().padStart(2, '0');

  if (hours > 0) {
    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss},${cc}`;
  }

  return `${mm}:${ss},${cc}`;
}

/**
 * Formats time of day as "HH:MM:SS,d" where 'd' is tenths of a second (0-9).
 */
export function formatTimeOfDay(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  const tenths = Math.floor(date.getMilliseconds() / 100).toString();

  return `${hh}:${mm}:${ss},${tenths}`;
}
