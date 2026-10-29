/**
 * Detects whether the dev-only GPS simulator is requested via URL query parameters.
 * Always returns false in production builds (tree-shaken by import.meta.env.DEV).
 */

export function isSimulatorRequested(search?: string): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  if (!query) {
    return false;
  }

  const params = new URLSearchParams(query);
  const sim = params.get('sim');
  return sim === '1' || sim === 'true' || sim === 'on';
}

export interface SimulatorConfig {
  speedKmH: number;
  seed: number;
}

export function parseSimulatorConfig(search?: string): SimulatorConfig {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  if (!query) {
    return { speedKmH: 50, seed: 12345 };
  }

  const params = new URLSearchParams(query);
  const speed = params.get('speed') ? Number(params.get('speed')) : 50;
  const seed = params.get('seed') ? Number(params.get('seed')) : 12345;

  return {
    speedKmH: Number.isNaN(speed) ? 50 : speed,
    seed: Number.isNaN(seed) ? 12345 : seed,
  };
}
