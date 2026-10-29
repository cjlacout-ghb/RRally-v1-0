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
 * Categorises the GPS status line message so the UI can apply the correct style
 * without inspecting the text string.
 *
 * - 'empty'         → no message shown (idle or receiving valid fresh readings)
 * - 'searching'     → temporary, low-prominence ("BUSCANDO GPS…")
 * - 'action-needed' → persistent, bold ("GPS SIN PERMISO…" / "GPS NO DISPONIBLE")
 */
export type GpsStatusKind = 'empty' | 'searching' | 'action-needed';

export interface GpsStatusLineResult {
  text: string;
  kind: GpsStatusKind;
}

/**
 * Returns the text and kind for the GPS status line below the dial.
 *
 * Exact visibility rules:
 * - Idle (before the first INICIAR, or after REINICIAR): empty.
 * - Denied: "GPS SIN PERMISO: activalo en Ajustes de iOS".
 * - Unavailable: "GPS NO DISPONIBLE".
 * - Started and no valid reading yet, or stale, or timeout: "BUSCANDO GPS…".
 * - Receiving valid, fresh readings: empty.
 */
export function getGpsStatusLine(input: GpsStatusLineInput): GpsStatusLineResult {
  const { status, hasReceivedReading, isStale } = input;

  if (status === 'idle') {
    return { text: '', kind: 'empty' };
  }

  if (status === 'denied') {
    return { text: 'GPS SIN PERMISO: activalo en Ajustes de iOS', kind: 'action-needed' };
  }

  if (status === 'unavailable') {
    return { text: 'GPS NO DISPONIBLE', kind: 'action-needed' };
  }

  if (status === 'timeout' || !hasReceivedReading || isStale) {
    return { text: 'BUSCANDO GPS…', kind: 'searching' };
  }

  return { text: '', kind: 'empty' };
}

/**
 * Convenience wrapper that returns only the text string.
 * Kept for backward compatibility with existing callers.
 */
export function getGpsStatusText(input: GpsStatusLineInput): string {
  return getGpsStatusLine(input).text;
}
