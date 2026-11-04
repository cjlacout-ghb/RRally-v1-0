import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  readStageSpeed,
  writeStageSpeed,
  STAGE_SPEED_KEY,
  readCorrectionFactor,
  writeCorrectionFactor,
  resetCorrectionFactor,
  CORRECTION_FACTOR_KEY,
  readControlSystem,
  writeControlSystem,
  CONTROL_SYSTEM_KEY,
  readRoadbookSheet,
  writeRoadbookSheet,
  ROADBOOK_SHEET_KEY,
  readRoadbookRaceState,
  writeRoadbookRaceState,
  clearRoadbookRaceState,
  ROADBOOK_RACE_STATE_KEY,
  StoredRoadbookRaceState,
  readCarreraStopwatchState,
  writeCarreraStopwatchState,
  clearCarreraStopwatchState,
  CARRERA_STOPWATCH_KEY,
  StoredCarreraStopwatchState,
} from './storage';
import { DEFAULT_CORRECTION_FACTOR } from './logic/gpsConstants';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('storage module', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('readStageSpeed', () => {
    it('returns null when nothing is stored', () => {
      expect(readStageSpeed()).toBeNull();
    });

    it('returns the number when valid number is stored', () => {
      mockStorage.setItem(STAGE_SPEED_KEY, '49.8');
      expect(readStageSpeed()).toBe(49.8);
    });

    it('returns null when stored value is corrupted / non-numeric', () => {
      mockStorage.setItem(STAGE_SPEED_KEY, 'corrupted');
      expect(readStageSpeed()).toBeNull();
    });

    it('returns null when stored value fails validation (e.g. <= 0 or > 120)', () => {
      mockStorage.setItem(STAGE_SPEED_KEY, '0');
      expect(readStageSpeed()).toBeNull();

      mockStorage.setItem(STAGE_SPEED_KEY, '-10');
      expect(readStageSpeed()).toBeNull();

      mockStorage.setItem(STAGE_SPEED_KEY, '150');
      expect(readStageSpeed()).toBeNull();
    });

    it('returns null safely when localStorage throws (e.g. private browsing)', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: The operation is insecure.');
      });
      expect(readStageSpeed()).toBeNull();
    });

    it('returns null safely when localStorage is undefined', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(readStageSpeed()).toBeNull();
    });
  });

  describe('writeStageSpeed', () => {
    it('writes valid number to localStorage', () => {
      const result = writeStageSpeed(49.8);
      expect(result).toEqual({ ok: true });
      expect(mockStorage.getItem(STAGE_SPEED_KEY)).toBe('49.8');
    });

    it('returns Spanish error when localStorage throws on write', () => {
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const result = writeStageSpeed(49.8);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('almacenamiento');
      }
    });

    it('returns Spanish error when localStorage is undefined', () => {
      vi.stubGlobal('localStorage', undefined);
      const result = writeStageSpeed(49.8);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('almacenamiento');
      }
    });
  });

  describe('readCorrectionFactor', () => {
    it('returns 1.0000 (default) when nothing is stored', () => {
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });

    it('returns stored factor at full precision when valid', () => {
      const fullPrecision = 8.0 / 7.95; // ~1.0062893...
      mockStorage.setItem(CORRECTION_FACTOR_KEY, String(fullPrecision));
      expect(readCorrectionFactor()).toBe(fullPrecision);
    });

    it('falls back to 1.0000 when stored value is corrupted / non-numeric', () => {
      mockStorage.setItem(CORRECTION_FACTOR_KEY, 'corrupted');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);

      mockStorage.setItem(CORRECTION_FACTOR_KEY, '');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);

      mockStorage.setItem(CORRECTION_FACTOR_KEY, 'NaN');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });

    it('falls back to 1.0000 when stored value is out of sane range [0.8, 1.2]', () => {
      mockStorage.setItem(CORRECTION_FACTOR_KEY, '0.5');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);

      mockStorage.setItem(CORRECTION_FACTOR_KEY, '1.5');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);

      mockStorage.setItem(CORRECTION_FACTOR_KEY, '-1');
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });

    it('falls back to 1.0000 safely when localStorage throws', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });

    it('falls back to 1.0000 safely when localStorage is undefined', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
    });
  });

  describe('writeCorrectionFactor', () => {
    it('writes valid factor and replaces previous value', () => {
      const res1 = writeCorrectionFactor(1.0063);
      expect(res1).toEqual({ ok: true });
      expect(readCorrectionFactor()).toBe(1.0063);

      const res2 = writeCorrectionFactor(0.995);
      expect(res2).toEqual({ ok: true });
      expect(readCorrectionFactor()).toBe(0.995);
    });

    it('rejects out-of-range factor without writing', () => {
      const result = writeCorrectionFactor(1.5);
      expect(result.ok).toBe(false);
      expect(mockStorage.getItem(CORRECTION_FACTOR_KEY)).toBeNull();
    });

    it('returns error when localStorage is unavailable or throws', () => {
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      const result = writeCorrectionFactor(1.05);
      expect(result.ok).toBe(false);
    });
  });

  describe('resetCorrectionFactor', () => {
    it('removes stored factor so reading falls back to 1.0000', () => {
      writeCorrectionFactor(1.05);
      expect(readCorrectionFactor()).toBe(1.05);

      const result = resetCorrectionFactor();
      expect(result).toEqual({ ok: true });
      expect(readCorrectionFactor()).toBe(DEFAULT_CORRECTION_FACTOR);
      expect(mockStorage.getItem(CORRECTION_FACTOR_KEY)).toBeNull();
    });
  });

  describe('readControlSystem and writeControlSystem', () => {
    it('returns carrera (default) when nothing is stored', () => {
      expect(readControlSystem()).toBe('carrera');
    });

    it('round trips valid control system values', () => {
      const res = writeControlSystem('hoja-de-ruta');
      expect(res).toEqual({ ok: true });
      expect(readControlSystem()).toBe('hoja-de-ruta');
      expect(mockStorage.getItem(CONTROL_SYSTEM_KEY)).toBe('hoja-de-ruta');

      writeControlSystem('carrera');
      expect(readControlSystem()).toBe('carrera');
    });

    it('falls back to carrera on corrupt or unknown value', () => {
      mockStorage.setItem(CONTROL_SYSTEM_KEY, 'invalid-system');
      expect(readControlSystem()).toBe('carrera');
    });

    it('falls back to carrera safely when localStorage throws', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('StorageError');
      });
      expect(readControlSystem()).toBe('carrera');
    });
  });

  describe('readRoadbookSheet and writeRoadbookSheet', () => {
    it('returns default 50-row sheet when nothing is stored', () => {
      const sheet = readRoadbookSheet();
      expect(sheet).toHaveLength(50);
      expect(sheet[0].assignedTimeSeconds).toBeNull();
    });

    it('round trips valid roadbook sheet', () => {
      const sampleSheet = [
        { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: 50 },
        { id: '2', mark: 'PC1', assignedTimeSeconds: 120, speedKmH: 60 },
      ];
      const writeRes = writeRoadbookSheet(sampleSheet);
      expect(writeRes).toEqual({ ok: true });

      const loaded = readRoadbookSheet();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toEqual({ id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: 50 });
      expect(loaded[1]).toEqual({ id: '2', mark: 'PC1', assignedTimeSeconds: 120, speedKmH: 60 });
    });

    it('falls back to initial sheet on corrupted JSON', () => {
      mockStorage.setItem(ROADBOOK_SHEET_KEY, '{ invalid json');
      const loaded = readRoadbookSheet();
      expect(loaded).toHaveLength(50);
    });

    it('falls back to initial sheet on unknown version or missing rows', () => {
      mockStorage.setItem(ROADBOOK_SHEET_KEY, JSON.stringify({ version: 99, rows: [] }));
      expect(readRoadbookSheet()).toHaveLength(50);

      mockStorage.setItem(ROADBOOK_SHEET_KEY, JSON.stringify({ version: 1 }));
      expect(readRoadbookSheet()).toHaveLength(50);
    });

    it('sanitizes rows on read (truncates long marks, strips invalid speed)', () => {
      mockStorage.setItem(
        ROADBOOK_SHEET_KEY,
        JSON.stringify({
          version: 1,
          rows: [
            { id: '1', mark: 'A'.repeat(60), assignedTimeSeconds: 10.5, speedKmH: -20 },
          ],
        })
      );
      const loaded = readRoadbookSheet();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].mark).toHaveLength(40);
      expect(loaded[0].assignedTimeSeconds).toBe(10); // floored whole seconds
      expect(loaded[0].speedKmH).toBeNull(); // negative speed converted to null
    });
  });

  describe('readRoadbookRaceState, writeRoadbookRaceState and clearRoadbookRaceState', () => {
    const sampleRaceState: StoredRoadbookRaceState = {
      version: 1,
      startWallClock: 1700000000000,
      running: true,
      marks: {
        0: { status: 'marked', realElapsedMs: 1500 },
        1: { status: 'skipped' },
      },
      history: [
        { type: 'mark', rowIndex: 0, realElapsedMs: 1500 },
        { type: 'skip', rowIndex: 1 },
      ],
      currentRowIndex: 2,
    };

    it('returns null when nothing is stored', () => {
      expect(readRoadbookRaceState()).toBeNull();
    });

    it('round trips valid race state', () => {
      const res = writeRoadbookRaceState(sampleRaceState);
      expect(res).toEqual({ ok: true });

      const loaded = readRoadbookRaceState();
      expect(loaded).toEqual(sampleRaceState);
    });

    it('falls back to null on corrupted JSON or unknown version', () => {
      mockStorage.setItem(ROADBOOK_RACE_STATE_KEY, 'corrupted');
      expect(readRoadbookRaceState()).toBeNull();

      mockStorage.setItem(ROADBOOK_RACE_STATE_KEY, JSON.stringify({ version: 2 }));
      expect(readRoadbookRaceState()).toBeNull();
    });

    it('clearRoadbookRaceState removes race state but keeps loaded sheet intact (survives REINICIAR)', () => {
      // Setup both sheet and race state
      const sheet = [
        { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: 50 },
      ];
      writeRoadbookSheet(sheet);
      writeRoadbookRaceState(sampleRaceState);

      expect(readRoadbookRaceState()).not.toBeNull();
      expect(readRoadbookSheet()).toHaveLength(1);

      // Reset race
      const clearRes = clearRoadbookRaceState();
      expect(clearRes).toEqual({ ok: true });

      // Race state cleared, sheet kept!
      expect(readRoadbookRaceState()).toBeNull();
      expect(mockStorage.getItem(ROADBOOK_RACE_STATE_KEY)).toBeNull();
      expect(readRoadbookSheet()).toHaveLength(1);
    });
  });

  describe('Carrera stopwatch persistence', () => {
    const now = 1700000010000;
    const runningState: StoredCarreraStopwatchState = {
      version: 1,
      startWallClock: 1700000000000,
      running: true,
      accumulatedMs: 5000,
    };

    const stoppedState: StoredCarreraStopwatchState = {
      version: 1,
      startWallClock: null,
      running: false,
      accumulatedMs: 15000,
    };

    it('returns null when nothing is stored', () => {
      expect(readCarreraStopwatchState(now)).toBeNull();
    });

    it('round trips valid running stopwatch state', () => {
      const res = writeCarreraStopwatchState(runningState);
      expect(res).toEqual({ ok: true });

      const loaded = readCarreraStopwatchState(now);
      expect(loaded).toEqual(runningState);
    });

    it('round trips valid stopped stopwatch state', () => {
      const res = writeCarreraStopwatchState(stoppedState);
      expect(res).toEqual({ ok: true });

      const loaded = readCarreraStopwatchState(now);
      expect(loaded).toEqual(stoppedState);
    });

    it('defensively rejects future startWallClock timestamps', () => {
      const futureRunningState: StoredCarreraStopwatchState = {
        version: 1,
        startWallClock: now + 5000, // 5 seconds in future
        running: true,
        accumulatedMs: 0,
      };
      writeCarreraStopwatchState(futureRunningState);
      expect(readCarreraStopwatchState(now)).toBeNull();
    });

    it('defensively rejects corrupted JSON, wrong version, or invalid types', () => {
      mockStorage.setItem(CARRERA_STOPWATCH_KEY, 'corrupted');
      expect(readCarreraStopwatchState(now)).toBeNull();

      mockStorage.setItem(CARRERA_STOPWATCH_KEY, JSON.stringify({ version: 2, running: true }));
      expect(readCarreraStopwatchState(now)).toBeNull();

      mockStorage.setItem(
        CARRERA_STOPWATCH_KEY,
        JSON.stringify({ version: 1, running: 'yes', accumulatedMs: 100 })
      );
      expect(readCarreraStopwatchState(now)).toBeNull();

      mockStorage.setItem(
        CARRERA_STOPWATCH_KEY,
        JSON.stringify({ version: 1, running: false, accumulatedMs: -10 })
      );
      expect(readCarreraStopwatchState(now)).toBeNull();
    });

    it('clearCarreraStopwatchState removes stopwatch state on REINICIAR', () => {
      writeCarreraStopwatchState(runningState);
      expect(readCarreraStopwatchState(now)).not.toBeNull();

      const clearRes = clearCarreraStopwatchState();
      expect(clearRes).toEqual({ ok: true });
      expect(readCarreraStopwatchState(now)).toBeNull();
      expect(mockStorage.getItem(CARRERA_STOPWATCH_KEY)).toBeNull();
    });

    it('handles storage errors safely without throwing', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('Storage failure');
      });
      expect(readCarreraStopwatchState(now)).toBeNull();

      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const writeRes = writeCarreraStopwatchState(runningState);
      expect(writeRes.ok).toBe(false);

      vi.spyOn(mockStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Remove failure');
      });
      const clearRes = clearCarreraStopwatchState();
      expect(clearRes.ok).toBe(false);
    });
  });
});
