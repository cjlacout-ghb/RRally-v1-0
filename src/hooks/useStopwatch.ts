/**
 * React hook wrapping the Stopwatch model.
 * Does NOT drive updates via a ticker; the ticker is shared externally.
 * This hook only exposes start/stop/reset actions and the stopwatch instance.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Stopwatch } from '../logic/stopwatch';

export interface UseStopwatchResult {
  stopwatch: Stopwatch;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Call this when a tick fires to get the updated elapsed time in ms. */
  getElapsedMs: () => number;
}

export function useStopwatch(): UseStopwatchResult {
  const stopwatchRef = useRef<Stopwatch>(new Stopwatch());
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback(() => {
    stopwatchRef.current.start();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    stopwatchRef.current.stop();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    stopwatchRef.current.reset();
    setIsRunning(false);
  }, []);

  const getElapsedMs = useCallback((): number => {
    return stopwatchRef.current.getElapsedMs();
  }, []);

  // Handle visibility changes for wall-clock correction
  useEffect(() => {
    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      stopwatchRef.current.onVisibilityChange(isVisible);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return {
    stopwatch: stopwatchRef.current,
    isRunning,
    start,
    stop,
    reset,
    getElapsedMs,
  };
}
