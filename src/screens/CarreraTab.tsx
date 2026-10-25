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

// Demo mode is stripped in production by the build tool (import.meta.env.DEV guard inside getDemoData)
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

  // ── Display state driven by animation frame ────────────────────
  const [mainDisplay, setMainDisplay] = useState('00:00,00');
  const [secondaryDisplay, setSecondaryDisplay] = useState('00:00,00');
  const [timeOfDay, setTimeOfDay] = useState(() => formatTimeOfDay(new Date()));

  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const now = new Date();
    setTimeOfDay(formatTimeOfDay(now));
    setMainDisplay(formatStopwatch(main.getElapsedMs()));
    setSecondaryDisplay(formatStopwatch(secondary.getElapsedMs()));
    rafRef.current = requestAnimationFrame(tick);
  }, [main, secondary]);

  useEffect(() => {
    if (isVisible) {
      rafRef.current = requestAnimationFrame(tick);
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
  }, [isVisible, tick]);

  // ── GPS / odometer data: Phase 2. In Phase 1 always null. ──────
  // Demo mode in development feeds sample values.
  const speed: number | null = demoData?.speed ?? null;
  const averageSpeed: number | null = demoData?.averageSpeed ?? null;
  const distance: number | null = demoData?.distance ?? null;
  const deltaSeconds: number | null = demoData?.deltaSeconds ?? null;

  const deltaState: DeltaState = demoData
    ? demoData.deltaState
    : classifyDelta(deltaSeconds);

  return (
    <div className="carrera-tab">
      {/* ── Time block ───────────────────────────────────────── */}
      <div className="time-block card">
        <div className="time-block__hora-row">
          <span className="label-md on-surface-variant">HORA</span>
          <span className="time-block__hora headline-lg brass">{timeOfDay}</span>
        </div>
        <div className="time-block__stopwatch">
          <div className="stopwatch-time--main time-centered">{mainDisplay}</div>
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
        assignedSpeed={assignedSpeed}
      />

      {/* ── Second stopwatch (scrolls below panel) ───────────── */}
      <StopwatchCard
        label="CRONÓMETRO 2"
        displayTime={secondaryDisplay}
        isRunning={secondary.isRunning}
        onStartStop={secondary.isRunning ? secondary.stop : secondary.start}
        onReset={secondary.reset}
        variant="secondary"
      />
    </div>
  );
}
