import { useState, useEffect, useRef, useCallback } from 'react';
import { useStopwatch } from '../hooks/useStopwatch';
import { StopwatchCard } from '../components/StopwatchCard';
import { OdometerDial } from '../components/OdometerDial';
import { DeltaPanel } from '../components/DeltaPanel';
import { formatStopwatch, formatTimeOfDay } from '../logic/format';
import { classifyDelta } from '../logic/delta';
import type { DeltaState } from '../logic/delta';
import { getDemoData } from '../demo';
import './CarreraTab.css';

// Demo mode is stripped in production by the build tool (import.meta.env.DEV guard inside getDemoData).
// demoData is null in all production builds.
const demoData = getDemoData();

export function CarreraTab({
  isVisible,
  assignedSpeed = null,
}: {
  isVisible: boolean;
  assignedSpeed?: number | null;
}) {
  // ── Stopwatches ────────────────────────────────────────────────
  const main = useStopwatch();
  const secondary = useStopwatch();

  // ── Display state ──────────────────────────────────────────────
  const [mainDisplay, setMainDisplay] = useState('00:00,00');
  const [secondaryDisplay, setSecondaryDisplay] = useState('00:00,00');
  const [timeOfDay, setTimeOfDay] = useState(() => formatTimeOfDay(new Date()));

  const rafRef = useRef<number | null>(null);
  const timeTimeoutRef = useRef<number | null>(null);

  // Stopwatches update smoothly on animation frames
  const tickStopwatches = useCallback(() => {
    setMainDisplay(formatStopwatch(main.getElapsedMs()));
    setSecondaryDisplay(formatStopwatch(secondary.getElapsedMs()));
    rafRef.current = requestAnimationFrame(tickStopwatches);
  }, [main, secondary]);

  useEffect(() => {
    if (isVisible) {
      rafRef.current = requestAnimationFrame(tickStopwatches);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isVisible, tickStopwatches]);

  // Time of day updates strictly once per second, scheduled to fire right at the next second boundary
  useEffect(() => {
    // In demo mode with static values, keep frozen
    if (import.meta.env.DEV && demoData?.timeOfDay) {
      return;
    }
    if (!isVisible) {
      if (timeTimeoutRef.current !== null) {
        clearTimeout(timeTimeoutRef.current);
        timeTimeoutRef.current = null;
      }
      return;
    }

    const scheduleNextSecond = () => {
      const now = new Date();
      setTimeOfDay(formatTimeOfDay(now));
      // Milliseconds until the next second starts (+ 1ms margin to avoid landing in previous second)
      const msUntilNextSecond = 1000 - now.getMilliseconds() + 1;
      timeTimeoutRef.current = window.setTimeout(scheduleNextSecond, msUntilNextSecond);
    };

    scheduleNextSecond();

    return () => {
      if (timeTimeoutRef.current !== null) {
        clearTimeout(timeTimeoutRef.current);
        timeTimeoutRef.current = null;
      }
    };
  }, [isVisible]);

  // ── GPS / odometer data ─────────────────────────────────────────
  // Demo mode in development feeds static sample values.
  // In production demoData is null (getDemoData returns null) and these stay null.
  // Phase 3 will supply real GPS values here.
  let speed: number | null = null;
  let averageSpeed: number | null = null;
  let distance: number | null = null;
  let deltaSeconds: number | null = null;
  let deltaState: DeltaState = classifyDelta(null);
  if (import.meta.env.DEV && demoData !== null) {
    speed = demoData.speed;
    averageSpeed = demoData.averageSpeed;
    distance = demoData.distance;
    deltaSeconds = demoData.deltaSeconds;
    deltaState = demoData.deltaState;
  }

  // ── Demo overrides for display strings (static, no real timers) ─
  // All demo-field accesses are inside the DEV guard so Vite eliminates
  // the property names entirely from the production bundle.
  let displayTimeOfDay = timeOfDay;
  let displayMain = mainDisplay;
  let displaySecondary = secondaryDisplay;
  let effectiveAssignedSpeed = assignedSpeed;
  if (import.meta.env.DEV && demoData !== null) {
    displayTimeOfDay = demoData.timeOfDay ?? timeOfDay;
    displayMain = demoData.mainStopwatch ?? mainDisplay;
    displaySecondary = demoData.secondaryStopwatch ?? secondaryDisplay;
    effectiveAssignedSpeed =
      'assignedSpeed' in demoData ? demoData.assignedSpeed : assignedSpeed;
  }

  return (
    <div className="carrera-tab">
      {/* ── Time block ───────────────────────────────────────── */}
      <div className="time-block card">
        <div className="time-block__hora-row">
          <span className="label-md on-surface-variant">HORA OFICIAL</span>
          <span className="time-block__hora headline-lg brass">{displayTimeOfDay}</span>
        </div>
        <div className="time-block__stopwatch">
          <div className={`stopwatch-time--main time-centered ${displayMain.length > 8 ? 'has-hours' : ''}`}>
            {displayMain}
          </div>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn-primary stopwatch-btn"
            onClick={main.isRunning ? main.stop : main.start}
          >
            {main.isRunning ? 'PARAR' : 'INICIAR'}
          </button>
          <button
            type="button"
            className="btn-primary stopwatch-btn"
            onClick={main.reset}
          >
            REINICIAR
          </button>
        </div>
      </div>

      {/* ── Odometer dial ────────────────────────────────────── */}
      <OdometerDial
        speed={speed}
        averageSpeed={averageSpeed}
        distance={distance}
      />

      {/* ── Ahead/behind panel ───────────────────────────────── */}
      <DeltaPanel
        deltaSeconds={deltaSeconds}
        state={deltaState}
        assignedSpeed={effectiveAssignedSpeed}
      />

      {/* ── Second stopwatch (scrolls below panel) ───────────── */}
      <StopwatchCard
        label="CRONÓMETRO 2"
        displayTime={displaySecondary}
        isRunning={secondary.isRunning}
        onStartStop={secondary.isRunning ? secondary.stop : secondary.start}
        onReset={secondary.reset}
        variant="secondary"
      />
    </div>
  );
}
