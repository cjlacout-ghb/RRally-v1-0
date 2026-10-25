import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readStageSpeed, writeStageSpeed, STAGE_SPEED_KEY } from './storage';

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
});
