import { describe, it, expect } from 'vitest';
import { isSetupPending } from './setupStatus';
import type { RoadbookRow } from './roadbookModel';

describe('isSetupPending', () => {
  describe('carrera mode', () => {
    it('returns true when assigned speed is null, undefined, or <= 0', () => {
      expect(isSetupPending('carrera', null, [])).toBe(true);
      expect(isSetupPending('carrera', undefined, [])).toBe(true);
      expect(isSetupPending('carrera', 0, [])).toBe(true);
      expect(isSetupPending('carrera', -10, [])).toBe(true);
    });

    it('returns false when a valid positive speed is saved', () => {
      expect(isSetupPending('carrera', 48, [])).toBe(false);
      expect(isSetupPending('carrera', 60.5, [])).toBe(false);
    });
  });

  describe('hoja-de-ruta mode', () => {
    it('returns true when rows array is empty', () => {
      expect(isSetupPending('hoja-de-ruta', 50, [])).toBe(true);
    });

    it('returns true when all rows have null assignedTimeSeconds', () => {
      const rows: RoadbookRow[] = [
        { id: '1', mark: 'LARGADA', assignedTimeSeconds: null, speedKmH: null },
        { id: '2', mark: 'CONTROL', assignedTimeSeconds: null, speedKmH: null },
      ];
      expect(isSetupPending('hoja-de-ruta', null, rows)).toBe(true);
    });

    it('returns false when at least one row has an assigned time', () => {
      const rows: RoadbookRow[] = [
        { id: '1', mark: 'LARGADA', assignedTimeSeconds: 0, speedKmH: null },
        { id: '2', mark: 'CONTROL', assignedTimeSeconds: null, speedKmH: null },
      ];
      expect(isSetupPending('hoja-de-ruta', null, rows)).toBe(false);
    });
  });
});
