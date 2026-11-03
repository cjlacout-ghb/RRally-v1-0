/**
 * React hook for reading and writing the control system selection.
 */

import { useState, useCallback } from 'react';
import { readControlSystem, writeControlSystem } from '../storage';
import type { ControlSystem } from '../logic/controlSystem';
import type { SaveResult } from '../storage';

export interface UseControlSystemResult {
  controlSystem: ControlSystem;
  saveControlSystem: (system: ControlSystem) => SaveResult;
}

export function useControlSystem(): UseControlSystemResult {
  const [controlSystem, setControlSystem] = useState<ControlSystem>(
    () => readControlSystem()
  );

  const saveControlSystem = useCallback((system: ControlSystem): SaveResult => {
    const result = writeControlSystem(system);
    if (result.ok) {
      setControlSystem(system);
    }
    return result;
  }, []);

  return { controlSystem, saveControlSystem };
}
