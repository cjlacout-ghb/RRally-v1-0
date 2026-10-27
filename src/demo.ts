/**
 * Demo mode: only active in development builds (import.meta.env.DEV guard).
 * The entire module tree-shakes out of the production bundle — all constants
 * and data are defined inside the DEV branch so the bundler can eliminate them.
 *
 * Activation: URL query parameter ?demo=<preset>
 *
 * Presets:
 *   ahead      – worst-case widths, delta positive (ADELANTADO, orange panel)
 *   behind     – worst-case widths, widest negative delta (ATRASADO, red panel)
 *   ontime     – worst-case widths, delta 0.0 (EN TIEMPO, green panel)
 *   nodata     – worst-case stopwatch/speed/distance fields; dial and panel show no-data
 *   normal     – typical values (no hours, moderate speeds), for comparison
 *
 * (legacy key "neutral" still works as an alias for "ontime")
 *
 * The demo does NOT write to localStorage and does NOT start any timer or GPS logic.
 */

import type { DeltaState } from './logic/delta';

export interface DemoData {
  /** Instantaneous speed shown on dial. null → no-data state on dial. */
  speed: number | null;
  /** Average speed shown in PROMEDIO readout. null → "--,-". */
  averageSpeed: number | null;
  /** Distance shown in DISTANCIA readout (km). null → "--,---". */
  distance: number | null;
  /** Delta in seconds for DeltaPanel. null → SIN DATOS state. */
  deltaSeconds: number | null;
  /** Explicit delta state (skips classifyDelta so we can force 'neutral'). */
  deltaState: DeltaState;
  /**
   * Assigned speed override shown in the ASIGNADO strip.
   * null means "no assigned speed" (blank placeholder shown).
   * The demo NEVER writes to localStorage.
   */
  assignedSpeed: number | null;
  /** Static time-of-day string (replaces live clock). e.g. "23:59:59,9". */
  timeOfDay: string;
  /** Static main stopwatch display string. e.g. "01:59:59,99". */
  mainStopwatch: string;
  /** Static secondary stopwatch display string. e.g. "01:59:59,99". */
  secondaryStopwatch: string;
}

/** Returns demo data if running in development with ?demo=<preset>, otherwise null. */
export function getDemoData(): DemoData | null {
  // Hard guard: this whole branch is dead code in production builds.
  if (!import.meta.env.DEV) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const key = params.get('demo');
  if (!key) {
    return null;
  }

  // All data constants are defined here, inside the DEV branch,
  // so the bundler can eliminate them entirely from production output.

  // ── Worst-case shared field values ───────────────────────────────────────
  const WORST_TIME_OF_DAY = '23:59:59';
  const WORST_STOPWATCH = '01:59:59,99';
  const WORST_SPEED = 119.9;
  const WORST_DISTANCE = 123.45;

  const WORST_COMMON = {
    speed: WORST_SPEED,
    averageSpeed: WORST_SPEED,
    distance: WORST_DISTANCE,
    assignedSpeed: WORST_SPEED,
    timeOfDay: WORST_TIME_OF_DAY,
    mainStopwatch: WORST_STOPWATCH,
    secondaryStopwatch: WORST_STOPWATCH,
  } as const;

  // ── Preset table ─────────────────────────────────────────────────────────
  const DEMO_DATA: Record<string, DemoData> = {
    // Worst-case: ADELANTADO (orange panel)
    ahead: {
      ...WORST_COMMON,
      deltaSeconds: 12.3,
      deltaState: 'ahead',
    },

    // Worst-case: ATRASADO (red panel) — widest negative delta
    behind: {
      ...WORST_COMMON,
      deltaSeconds: -123.4,
      deltaState: 'behind',
    },

    // Worst-case: EN TIEMPO (green panel)
    ontime: {
      ...WORST_COMMON,
      deltaSeconds: 0.0,
      deltaState: 'neutral',
    },

    // Worst-case fields except dial & panel → no-data state
    nodata: {
      ...WORST_COMMON,
      speed: null,
      averageSpeed: null,
      distance: null,
      deltaSeconds: null,
      deltaState: 'neutral',
    },

    // Typical values — for visual comparison against worst-case
    normal: {
      speed: 49.8,
      averageSpeed: 49.8,
      distance: 14.82,
      deltaSeconds: 0.3,
      deltaState: 'ahead',
      assignedSpeed: 49.8,
      timeOfDay: '11:39:56',
      mainStopwatch: '00:00,00',
      secondaryStopwatch: '00:00,00',
    },

    // Legacy aliases kept for backwards compatibility
    neutral: {
      ...WORST_COMMON,
      deltaSeconds: 0.0,
      deltaState: 'neutral',
    },
  };

  return key in DEMO_DATA ? DEMO_DATA[key] : null;
}
