/**
 * Pure logic for the GPS status line on the Carrera screen.
 */

import type { GpsStatus } from './gpsReader';

export interface GpsStatusLineInput {
  /** The current status of the GPS reader. */
  status: GpsStatus;
  /** Whether at least one valid reading has been received since start. */
  hasReceivedReading: boolean;
  /** Whether the time since the last valid reading exceeds STALE_SPEED_TIMEOUT_MS (5s). */
  isStale: boolean;
}

/**
 * Returns the text to display in the GPS status line below the dial.
 *
 * Exact visibility rules:
 * - Idle (before the first INICIAR, or after REINICIAR): empty.
 * - Denied: "GPS SIN PERMISO: activalo en Ajustes de iOS".
 * - Unavailable: "GPS NO DISPONIBLE".
 * - Started and no valid reading yet, or stale, or timeout: "BUSCANDO GPS…".
 * - Receiving valid, fresh readings: empty.
 */
export function getGpsStatusText(input: GpsStatusLineInput): string {
  const { status, hasReceivedReading, isStale } = input;

  if (status === 'idle') {
    return '';
  }

  if (status === 'denied') {
    return 'GPS SIN PERMISO: activalo en Ajustes de iOS';
  }

  if (status === 'unavailable') {
    return 'GPS NO DISPONIBLE';
  }

  if (status === 'timeout' || !hasReceivedReading || isStale) {
    return 'BUSCANDO GPS…';
  }

  return '';
}
