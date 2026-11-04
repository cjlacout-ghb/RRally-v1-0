import type { DeltaState } from './delta';

/**
 * Number and time formatting using Argentine locale conventions (decimal comma).
 */

export type DeltaUnit = 'SEG' | 'MIN';

export interface FormattedDelta {
  /** The formatted numeric part with sign (e.g. "+12,3", "-1:05,9", "0,0", "--,-") */
  value: string;
  /** The unit label: "SEG" for < 60,0 s or no-data, "MIN" for >= 60,0 s */
  unit: DeltaUnit;
  /** Combined value and unit string (e.g. "+12,3 SEG", "-1:05,9 MIN", "0,0 SEG", "--,- SEG") */
  formatted: string;
  /** Enables String(result) or `${result}` to evaluate to formatted */
  toString(): string;
}

/**
 * Formats a speed in km/h with 1 decimal place using a comma (e.g. "49,8").
 * Returns "--,-" if speed is null, undefined, or NaN.
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
 * Formats a distance in km with decimal comma (e.g. "14,82" with 2 decimals, or "14,820" with 3 decimals).
 * Rounds to the specified number of decimal places (default: 2).
 * Returns placeholder with matching dash count (e.g. "--,--" for 2 decimals, "--,---" for 3 decimals)
 * if distance is null, undefined, or NaN.
 */
export function formatDistance(distance: number | null | undefined, decimals: number = 2): string {
  if (distance === null || distance === undefined || Number.isNaN(distance)) {
    return `--${',' + '-'.repeat(decimals)}`;
  }
  return distance.toFixed(decimals).replace('.', ',');
}

/**
 * Formats an odometer correction factor with 4 decimal places using decimal comma (e.g. "1,0063").
 * Returns "--,----" if factor is null, undefined, or NaN.
 */
export function formatFactor(factor: number | null | undefined): string {
  if (factor === null || factor === undefined || Number.isNaN(factor)) {
    return '--,----';
  }
  return factor.toFixed(4).replace('.', ',');
}

/**
 * Formats a signed ahead/behind delta in seconds.
 * 1. Rounds the deviation to tenths of a second FIRST, then decides the format from the rounded absolute value.
 * 2. If rounded absolute value is below 60,0 seconds: formats in seconds with unit "SEG" (e.g. "+12,3 SEG", "-52,9 SEG").
 *    Zero shows "0,0 SEG" with no sign.
 * 3. If rounded absolute value is 60,0 seconds or more: formats in minutes, seconds with two digits, and tenths (M:SS,d)
 *    with unit "MIN" (e.g. "+1:00,0 MIN", "-1:05,9 MIN", "-2:05,4 MIN"). Minutes have no leading zero.
 *    If minutes reach 60 or more, minutes keep counting (e.g. "+75:00,0 MIN") without introducing hours.
 * 4. Sign stays at front ("+" for ahead, "-" for behind).
 * 5. Returns "--,- SEG" if delta is null, undefined, or NaN.
 */
export function formatDelta(delta: number | null | undefined): FormattedDelta {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return {
      value: '--,-',
      unit: 'SEG',
      formatted: '--,- SEG',
      toString() {
        return this.formatted;
      },
    };
  }

  // 1. Round to tenths of a second FIRST
  const roundedTenths = Math.round(delta * 10);
  const absTenths = Math.abs(roundedTenths);

  if (absTenths === 0) {
    return {
      value: '0,0',
      unit: 'SEG',
      formatted: '0,0 SEG',
      toString() {
        return this.formatted;
      },
    };
  }

  const sign = roundedTenths > 0 ? '+' : '-';

  // 2. Below 60,0 seconds: unit "SEG"
  if (absTenths < 600) {
    const totalSeconds = Math.floor(absTenths / 10);
    const tenths = absTenths % 10;
    const value = `${sign}${totalSeconds},${tenths}`;
    const unit: DeltaUnit = 'SEG';
    return {
      value,
      unit,
      formatted: `${value} ${unit}`,
      toString() {
        return this.formatted;
      },
    };
  }

  // 3. 60,0 seconds or more: M:SS,d with unit "MIN"
  const totalSeconds = Math.floor(absTenths / 10);
  const tenths = absTenths % 10;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds.toString().padStart(2, '0');
  const value = `${sign}${minutes}:${ss},${tenths}`;
  const unit: DeltaUnit = 'MIN';

  return {
    value,
    unit,
    formatted: `${value} ${unit}`,
    toString() {
      return this.formatted;
    },
  };
}

/**
 * Formats a delta value and state into a natural Spanish phrase for screen readers.
 * Examples:
 * - -65.9 with state 'behind' -> "1 minuto 5,9 segundos atrasado"
 * - 60.0 with state 'ahead' -> "1 minuto 0,0 segundos adelantado"
 * - 12.3 with state 'ahead' -> "12,3 segundos adelantado"
 * - 0.0 with state 'neutral' -> "0,0 segundos en tiempo"
 * - null with state 'no-data' -> "Sin datos"
 */
export function formatDeltaAria(
  delta: number | null | undefined,
  state: DeltaState
): string {
  if (state === 'no-data' || delta === null || delta === undefined || Number.isNaN(delta)) {
    return 'Sin datos';
  }

  const roundedTenths = Math.round(delta * 10);
  const absTenths = Math.abs(roundedTenths);

  const stateText =
    state === 'ahead'
      ? 'adelantado'
      : state === 'behind'
      ? 'atrasado'
      : 'en tiempo';

  if (absTenths === 0) {
    return `0,0 segundos ${stateText}`;
  }

  const totalSeconds = Math.floor(absTenths / 10);
  const tenths = absTenths % 10;

  if (absTenths < 600) {
    return `${totalSeconds},${tenths} segundos ${stateText}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minText = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  const secText = `${seconds},${tenths} segundos`;

  return `${minText} ${secText} ${stateText}`;
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
 * Formats time of day as "HH:MM:SS" (24-hour format, two digits per field).
 * Seconds are truncated (floor), never rounded.
 */
export function formatTimeOfDay(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

/**
 * Formats whole seconds elapsed into "H:MM:SS" (e.g. 2140 s -> "0:35:40", 3900 s -> "1:05:00").
 * Returns "-:--:--" if seconds is null, undefined, NaN, or negative.
 */
export function formatTimeHms(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds) || totalSeconds < 0) {
    return '-:--:--';
  }

  const safeSeconds = Math.floor(totalSeconds);
  const seconds = safeSeconds % 60;
  const totalMinutes = Math.floor(safeSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return `${hours}:${mm}:${ss}`;
}

/**
 * Formats elapsed stopwatch milliseconds into "H:MM:SS" with whole seconds truncated.
 * Returns "-:--:--" if elapsedMs is null, undefined, NaN, or negative.
 */
export function formatElapsedHms(elapsedMs: number | null | undefined): string {
  if (elapsedMs === null || elapsedMs === undefined || Number.isNaN(elapsedMs) || elapsedMs < 0) {
    return '-:--:--';
  }
  const totalSeconds = Math.floor(elapsedMs / 1000);
  return formatTimeHms(totalSeconds);
}

/**
 * Formats elapsed stopwatch milliseconds into "H:MM:SS,d" with 1 decimal place using Argentine decimal comma.
 * Returns "-:--:--" if elapsedMs is null, undefined, NaN, or negative.
 */
export function formatElapsedHmsDecimal(elapsedMs: number | null | undefined): string {
  if (elapsedMs === null || elapsedMs === undefined || Number.isNaN(elapsedMs) || elapsedMs < 0) {
    return '-:--:--';
  }

  const totalTenths = Math.round(elapsedMs / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return `${hours}:${mm}:${ss},${tenths}`;
}

