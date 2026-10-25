/**
 * React hook for reading and writing the assigned stage speed.
 * Components must use this hook; they must not read localStorage directly.
 */

import { useState, useCallback } from 'react';
import { readStageSpeed, writeStageSpeed } from '../storage';
import type { SaveResult } from '../storage';

export interface UseStageSpeedResult {
  /** Assigned stage speed in km/h, or null if not set. */
  assignedSpeed: number | null;
  /** Saves a speed. Returns a SaveResult so the UI can show an error if needed. */
  saveSpeed: (speed: number) => SaveResult;
}

export function useStageSpeed(): UseStageSpeedResult {
  const [assignedSpeed, setAssignedSpeed] = useState<number | null>(() => readStageSpeed());

  const saveSpeed = useCallback((speed: number): SaveResult => {
    const result = writeStageSpeed(speed);
    if (result.ok) {
      setAssignedSpeed(speed);
    }
    return result;
  }, []);

  return { assignedSpeed, saveSpeed };
}
