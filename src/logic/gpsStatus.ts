/**
 * Pure logic for the GPS status line on the Carrera screen.
 */

import type { GpsStatus } from './gpsReader';

export interface GpsStatusLineInput {
  /** The current status of the GPS reader. */
  status: GpsStatus;
  /** Whether at least one valid reading has been received since the current reader start. */
  hasReceivedReading: boolean;
}

/**
 * Categorises the GPS status line message so the UI can apply the correct style
 * without inspecting the text string.
 *
 * - 'empty'         → no message shown (idle, stopped, or receiving/holding valid readings)
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
 * - Idle (before first INICIAR, after PARAR, or after REINICIAR): empty.
 * - Denied: "GPS SIN PERMISO: activalo en Ajustes de iOS".
 * - Unavailable: "GPS NO DISPONIBLE".
 * - Timeout: "BUSCANDO GPS…".
 * - Active (running) and no valid reading received yet since start: "BUSCANDO GPS…".
 * - Active (running) and has received at least one valid reading (even during stationary gaps): empty.
 */
export function getGpsStatusLine(input: GpsStatusLineInput): GpsStatusLineResult {
  const { status, hasReceivedReading } = input;

  if (status === 'idle') {
    return { text: '', kind: 'empty' };
  }

  if (status === 'denied') {
    return { text: 'GPS SIN PERMISO: activalo en Ajustes de iOS', kind: 'action-needed' };
  }

  if (status === 'unavailable') {
    return { text: 'GPS NO DISPONIBLE', kind: 'action-needed' };
  }

  if (status === 'timeout' || !hasReceivedReading) {
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
