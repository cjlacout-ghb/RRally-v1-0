import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  readStageSpeed,
  writeStageSpeed,
  STAGE_SPEED_KEY,
  readCorrectionFactor,
  writeCorrectionFactor,
  resetCorrectionFactor,
  CORRECTION_FACTOR_KEY,
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
});
