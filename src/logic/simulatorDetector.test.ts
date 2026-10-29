import { describe, it, expect } from 'vitest';
import { isSimulatorRequested, parseSimulatorConfig } from './simulatorDetector';

describe('simulatorDetector', () => {
  describe('isSimulatorRequested', () => {
    it('returns true for ?sim=1, ?sim=true, and ?sim=on', () => {
      expect(isSimulatorRequested('?sim=1')).toBe(true);
      expect(isSimulatorRequested('?sim=true')).toBe(true);
      expect(isSimulatorRequested('?sim=on')).toBe(true);
      expect(isSimulatorRequested('?foo=bar&sim=1&speed=60')).toBe(true);
    });

    it('returns false when sim is absent, 0, or false', () => {
      expect(isSimulatorRequested('')).toBe(false);
      expect(isSimulatorRequested('?foo=bar')).toBe(false);
      expect(isSimulatorRequested('?sim=0')).toBe(false);
      expect(isSimulatorRequested('?sim=false')).toBe(false);
      expect(isSimulatorRequested('?sim=off')).toBe(false);
    });
  });

  describe('parseSimulatorConfig', () => {
    it('returns defaults when query is empty or missing parameters', () => {
      expect(parseSimulatorConfig('')).toEqual({ speedKmH: 50, seed: 12345 });
      expect(parseSimulatorConfig('?sim=1')).toEqual({ speedKmH: 50, seed: 12345 });
    });

    it('parses valid numeric speed and seed parameters', () => {
      expect(parseSimulatorConfig('?sim=1&speed=60&seed=42')).toEqual({
        speedKmH: 60,
        seed: 42,
      });
    });

    it('falls back to defaults on NaN values', () => {
      expect(parseSimulatorConfig('?speed=abc&seed=xyz')).toEqual({
        speedKmH: 50,
        seed: 12345,
      });
    });
  });
});
