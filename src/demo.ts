/**
 * Demo mode: only active in development builds.
 * In production builds this entire module tree-shakes out via import.meta.env.DEV guard.
 *
 * URL query parameter: ?demo=ahead | behind | neutral
 * Returns sample values that feed the dial, readouts and panel.
 */

import type { DeltaState } from './logic/delta';

export interface DemoData {
  speed: number;
  averageSpeed: number;
  distance: number;
  deltaSeconds: number;
  deltaState: DeltaState;
}

const DEMO_DATA: Record<string, DemoData> = {
  ahead: {
    speed: 49.8,
    averageSpeed: 49.6,
    distance: 14.82,
    deltaSeconds: 1.8,
    deltaState: 'ahead',
  },
  behind: {
    speed: 48.1,
    averageSpeed: 49.2,
    distance: 14.62,
    deltaSeconds: -2.3,
    deltaState: 'behind',
  },
  neutral: {
    speed: 49.5,
    averageSpeed: 49.5,
    distance: 14.75,
    deltaSeconds: 0.0,
    deltaState: 'neutral',
  },
};

/** Returns demo data if running in development with ?demo=<state>, otherwise null. */
export function getDemoData(): DemoData | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const key = params.get('demo');
  if (key && key in DEMO_DATA) {
    return DEMO_DATA[key];
  }
  return null;
}
