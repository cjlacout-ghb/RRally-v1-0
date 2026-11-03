/**
 * Control system choice: Carrera (GPS speed) vs Hoja de ruta (roadbook passing marks).
 */

export type ControlSystem = 'carrera' | 'hoja-de-ruta';

export type ActiveTab = 'CARRERA' | 'HOJA-DE-RUTA' | 'CALCULADORA';

export const DEFAULT_CONTROL_SYSTEM: ControlSystem = 'carrera';

export function isValidControlSystem(value: unknown): value is ControlSystem {
  return value === 'carrera' || value === 'hoja-de-ruta';
}

/**
 * Reconciles an active tab value against the selected control system.
 * Single source of truth across the app:
 * - If the tab is CALCULADORA, it remains CALCULADORA.
 * - Otherwise, the tab is strictly the race tab matching the active control system:
 *     'HOJA-DE-RUTA' for 'hoja-de-ruta', 'CARRERA' for 'carrera'.
 * - Stale, invalid, or null tab values are safely reconciled to the correct system's race tab.
 */
export function reconcileActiveTab(
  tab: string | null | undefined,
  system: ControlSystem
): ActiveTab {
  if (tab === 'CALCULADORA') {
    return 'CALCULADORA';
  }
  return system === 'hoja-de-ruta' ? 'HOJA-DE-RUTA' : 'CARRERA';
}
