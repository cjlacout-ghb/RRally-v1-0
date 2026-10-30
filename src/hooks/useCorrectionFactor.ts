/**
 * React hook for reading and writing the odometer correction factor.
 * Components must use this hook or storage accessors; they must not read localStorage directly.
 */

import { useState, useCallback } from 'react';
import {
  readCorrectionFactor,
  writeCorrectionFactor,
  resetCorrectionFactor,
  type SaveResult,
} from '../storage';
import { DEFAULT_CORRECTION_FACTOR } from '../logic/gpsConstants';

export interface UseCorrectionFactorResult {
  /** Applied odometer correction factor (full precision, default 1.0000). */
  correctionFactor: number;
  /** Saves a new correction factor. Returns a SaveResult. */
  saveFactor: (factor: number) => SaveResult;
  /** Resets the correction factor back to 1.0000. */
  resetFactor: () => SaveResult;
}

export function useCorrectionFactor(): UseCorrectionFactorResult {
  const [correctionFactor, setCorrectionFactor] = useState<number>(() => readCorrectionFactor());

  const saveFactor = useCallback((factor: number): SaveResult => {
    const result = writeCorrectionFactor(factor);
    if (result.ok) {
      setCorrectionFactor(factor);
    }
    return result;
  }, []);

  const resetFactor = useCallback((): SaveResult => {
    const result = resetCorrectionFactor();
    if (result.ok) {
      setCorrectionFactor(DEFAULT_CORRECTION_FACTOR);
    }
    return result;
  }, []);

  return { correctionFactor, saveFactor, resetFactor };
}
