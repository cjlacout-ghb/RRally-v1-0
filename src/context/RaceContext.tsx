/**
 * Single owner of race state for the application.
 *
 * Sits above all screens and tabs so that navigating to Preparar Etapa,
 * Calculadora, or Ayuda never resets or interrupts an active race.
 *
 * Coordinates the single start instant between the main Stopwatch and RallyTracker,
 * manages the GpsReader lifecycle, and exposes a read-only snapshot for the UI.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { RaceSessionBridge, type RaceSnapshot } from '../logic/raceBridge';
import { BrowserGpsReader, type GpsReader } from '../logic/gpsReader';
import { useStopwatch, type UseStopwatchResult } from '../hooks/useStopwatch';
import type { RallyTracker } from '../logic/rallyTracker';
import { isSimulatorRequested, parseSimulatorConfig } from '../logic/simulatorDetector';

export interface RaceContextValue {
  snapshot: RaceSnapshot;
  mainStopwatch: {
    isRunning: boolean;
    getElapsedMs: () => number;
  };
  secondaryStopwatch: UseStopwatchResult;
  onStartMain: () => void;
  onStopMain: () => void;
  onResetMain: () => void;
  onAdjustDistance: (delta: -1 | 1) => void;
  tracker: RallyTracker;
  reader: GpsReader;
}

const RaceContext = createContext<RaceContextValue | null>(null);

export interface RaceProviderProps {
  children: ReactNode;
  assignedSpeed?: number | null;
  /** Testing escape-hatches to inject mock instances without real geolocation */
  initialTracker?: RallyTracker;
  initialReader?: GpsReader;
}

export function RaceProvider({
  children,
  assignedSpeed = null,
  initialTracker,
  initialReader,
}: RaceProviderProps) {
  const simRequested = !initialReader && isSimulatorRequested();
  const [bridge, setBridge] = useState<RaceSessionBridge | null>(() => {
    if (simRequested) {
      return null;
    }
    return new RaceSessionBridge({
      reader: initialReader ?? new BrowserGpsReader(),
      tracker: initialTracker,
      assignedSpeedKmH: assignedSpeed,
    });
  });

  // Dev-only simulator wiring via URL query parameters (?sim=1&speed=50&seed=12345).
  // Waits for simulator before mounting session so real geolocation is never touched.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!simRequested || bridge) return;

    let active = true;
    const { speedKmH, seed } = parseSimulatorConfig();

    import('../logic/gpsSimulator').then(({ GpsSimulator }) => {
      if (!active) return;
      const sim = new GpsSimulator({
        speedKmH,
        seed,
      });
      setBridge(
        new RaceSessionBridge({
          reader: sim,
          tracker: initialTracker,
          assignedSpeedKmH: assignedSpeed,
        })
      );
    });

    return () => {
      active = false;
    };
  }, [simRequested, bridge, initialTracker, assignedSpeed]);

  // Sync assignedSpeed when changed in storage/PrepararEtapa
  useEffect(() => {
    if (bridge) {
      bridge.setAssignedSpeed(assignedSpeed);
    }
  }, [bridge, assignedSpeed]);

  if (!bridge) {
    return null;
  }

  return <RaceProviderInner bridge={bridge}>{children}</RaceProviderInner>;
}

function RaceProviderInner({
  children,
  bridge,
}: {
  children: ReactNode;
  bridge: RaceSessionBridge;
}) {
  // Secondary stopwatch lives above screen so navigating tabs preserves time
  const secondaryStopwatch = useStopwatch();
  const [snapshot, setSnapshot] = useState<RaceSnapshot>(() => bridge.getSnapshot());

  // Subscribe to bridge updates
  useEffect(() => {
    // 1-second refresh ticker for stale speed and time-based status/delta rules.
    // Only runs while the stopwatch is running and page is visible, so it doesn't waste battery.
    let interval: number | null = null;

    const syncTicker = () => {
      const shouldRun = bridge.stopwatch.isRunning() && document.visibilityState === 'visible';
      if (shouldRun && interval === null) {
        interval = window.setInterval(() => {
          bridge.tick();
        }, 1000);
      } else if (!shouldRun && interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    syncTicker();

    const unsub = bridge.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      syncTicker();
    });

    // Foreground recovery and wake lock re-acquisition on visibility change
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      bridge.onVisibilityChange(isVisible);
      syncTicker();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsub();
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [bridge]);

  // Actions
  const onStartMain = useCallback(() => {
    bridge.start();
  }, [bridge]);

  const onStopMain = useCallback(() => {
    bridge.stop();
  }, [bridge]);

  const onResetMain = useCallback(() => {
    bridge.reset();
  }, [bridge]);

  const onAdjustDistance = useCallback(
    (delta: -1 | 1) => {
      bridge.adjustDistance(delta);
    },
    [bridge]
  );

  const mainStopwatch = {
    isRunning: snapshot.isRunning,
    getElapsedMs: useCallback(() => bridge.stopwatch.getElapsedMs(), [bridge]),
  };

  return (
    <RaceContext.Provider
      value={{
        snapshot,
        mainStopwatch,
        secondaryStopwatch,
        onStartMain,
        onStopMain,
        onResetMain,
        onAdjustDistance,
        tracker: bridge.tracker,
        reader: bridge.reader,
      }}
    >
      {children}
    </RaceContext.Provider>
  );
}

export function useRaceSession(): RaceContextValue {
  const ctx = useContext(RaceContext);
  if (!ctx) {
    throw new Error('useRaceSession must be used within a RaceProvider');
  }
  return ctx;
}
