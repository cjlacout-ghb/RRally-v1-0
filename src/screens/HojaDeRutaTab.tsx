import { useState, useEffect, useRef, useCallback } from 'react';
import { StopwatchCard } from '../components/StopwatchCard';
import { DeltaPanel } from '../components/DeltaPanel';
import { formatStopwatch, formatTimeOfDay, formatSpeed, formatDelta } from '../logic/format';
import { formatTimeHms, formatElapsedHmsDecimal } from '../logic/roadbookTime';
import { classifyDelta, NEUTRAL_BAND_SECONDS } from '../logic/delta';
import { computeNextStretchSpeed } from '../logic/roadbookSpeed';
import { RoadbookRaceTracker, computeRowDeviation } from '../logic/roadbookRace';
import type { RoadbookRow } from '../logic/roadbookModel';
import { useRaceSession } from '../context/RaceContext';
import { useConfirmReset } from '../hooks/useConfirmReset';
import {
  readRoadbookRaceState,
  writeRoadbookRaceState,
  clearRoadbookRaceState,
} from '../storage';
import './HojaDeRutaTab.css';

interface HojaDeRutaTabProps {
  isVisible: boolean;
  rows: RoadbookRow[];
  onOpenCargarHoja?: () => void;
}

export function HojaDeRutaTab({ isVisible, rows, onOpenCargarHoja }: HojaDeRutaTabProps) {
  const {
    mainStopwatch: main,
    secondaryStopwatch: secondary,
    onStartMain,
    onStopMain,
    onResetMain,
    snapshot,
  } = useRaceSession();

  // ── Roadbook race state ─────────────────────────────────────
  // On first mount, reconstruct from persisted state if available.
  const trackerRef = useRef<RoadbookRaceTracker | null>(null);
  if (trackerRef.current === null) {
    const saved = readRoadbookRaceState();
    if (saved) {
      trackerRef.current = new RoadbookRaceTracker(rows, saved.marks, saved.history);
    } else {
      trackerRef.current = new RoadbookRaceTracker(rows);
    }
  }

  // Re-sync tracker rows when sheet changes
  useEffect(() => {
    trackerRef.current!.setRows(rows);
    setRaceSnapshot(trackerRef.current!.getSnapshot());
  }, [rows]);

  const [raceSnapshot, setRaceSnapshot] = useState(() => trackerRef.current!.getSnapshot());

  const refreshSnapshot = useCallback(() => {
    setRaceSnapshot(trackerRef.current!.getSnapshot());
  }, []);

  /** Persists current tracker state + main stopwatch state to localStorage. */
  const persistRaceState = useCallback(() => {
    const tracker = trackerRef.current!;
    const snap = tracker.getSnapshot();
    writeRoadbookRaceState({
      version: 1,
      startWallClock: main.getStartWallClock(),
      running: main.isRunning,
      marks: snap.marks,
      history: snap.history,
      currentRowIndex: snap.currentRowIndex,
    });
  }, [main]);

  // ── Display state for stopwatches ───────────────────────────
  const [mainDisplay, setMainDisplay] = useState('00:00,00');
  const [secondaryDisplay, setSecondaryDisplay] = useState('00:00,00');
  const [timeOfDay, setTimeOfDay] = useState(() => formatTimeOfDay(new Date()));

  const rafRef = useRef<number | null>(null);
  const timeTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
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

  // ── Mark / Skip / Undo / Reset ──────────────────────────────
  function handleMark() {
    const elapsedMs = main.getElapsedMs();
    trackerRef.current!.mark(elapsedMs);
    refreshSnapshot();
    persistRaceState();
  }

  function handleSkip() {
    trackerRef.current!.skip();
    refreshSnapshot();
    persistRaceState();
  }

  function handleUndo() {
    trackerRef.current!.undo();
    refreshSnapshot();
    persistRaceState();
  }

  function handleReset() {
    trackerRef.current!.reset();
    refreshSnapshot();
    clearRoadbookRaceState();
    onResetMain();
  }

  // "Has something to lose" for Hoja de ruta: elapsed time > 0 OR at least one real mark/skip
  const hasSomethingToLose = () =>
    main.getElapsedMs() > 0 || raceSnapshot.history.length > 0;

  const confirmReset = useConfirmReset({
    onReset: handleReset,
    hasSomethingToLose,
    isVisible,
  });

  function handleStartMain() {
    onStartMain();
    // Persist after start so startWallClock is recorded.
    // Use a microtask to let the bridge update isRunning first.
    setTimeout(persistRaceState, 0);
  }

  function handleStopMain() {
    onStopMain();
    setTimeout(persistRaceState, 0);
  }

  // ── Derived display values ──────────────────────────────────
  const deviationSeconds = raceSnapshot.accumulatedDeviationSeconds;
  const deltaState = classifyDelta(deviationSeconds, NEUTRAL_BAND_SECONDS);

  // ASIGNADO strip: org speed of last marked stretch
  const lastIdx = raceSnapshot.lastMarkedRowIndex;
  let assignedStripSpeed: number | null = null;
  if (lastIdx !== null && lastIdx > 0) {
    // Find previous loaded row for that stretch's speed
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (rows[i]?.assignedTimeSeconds !== null) {
        // effective speed from that prev row
        for (let j = i; j >= 0; j--) {
          if (rows[j]?.speedKmH !== null) {
            assignedStripSpeed = rows[j].speedKmH;
            break;
          }
        }
        break;
      }
    }
  }

  // Next stretch speed
  const currentIdx = raceSnapshot.currentRowIndex;
  const nextStretch = computeNextStretchSpeed(rows, currentIdx, deviationSeconds);

  // Three mark cards: ANTERIOR, ACTUAL, SIGUIENTE
  function getRowDisplayInfo(idx: number | null) {
    if (idx === null || !rows[idx]) return null;
    const row = rows[idx];
    const mark = raceSnapshot.marks[idx];
    return { row, mark };
  }

  // ANTERIOR: last marked or skipped row
  let anteriorIdx: number | null = null;
  if (raceSnapshot.history.length > 0) {
    anteriorIdx = raceSnapshot.history[raceSnapshot.history.length - 1].rowIndex;
  }

  // SIGUIENTE: first loaded row after current
  let siguienteIdx: number | null = null;
  if (currentIdx !== null) {
    for (let i = currentIdx + 1; i < rows.length; i++) {
      if (rows[i].assignedTimeSeconds !== null) {
        siguienteIdx = i;
        break;
      }
    }
  }

  const anteriorInfo = getRowDisplayInfo(anteriorIdx);
  const actualInfo = getRowDisplayInfo(currentIdx);

  return (
    <div className="hoja-de-ruta-tab">
      {/* ── Time block (48px buttons — explicit exception) ── */}
      <div className="time-block card hdr-time-block">
        <div className="time-block__hora-row">
          <span className="label-md on-surface-variant">HORA OFICIAL</span>
          <span className="time-block__hora headline-lg brass">{timeOfDay}</span>
        </div>
        <div className="time-block__stopwatch">
          <div className={`stopwatch-time--main time-centered ${mainDisplay.length > 8 ? 'has-hours' : ''}`}>
            {mainDisplay}
          </div>
        </div>
        <div className="btn-row">
          {/* aria-live polite region for armed state announcements — visually hidden, zero height */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
          >
            {confirmReset.isArmed ? 'Confirmar reinicio' : ''}
          </span>
          <button
            type="button"
            className="btn-stopwatch stopwatch-btn hdr-stopwatch-btn"
            onClick={() => {
              confirmReset.disarm();
              main.isRunning ? handleStopMain() : handleStartMain();
            }}
          >
            {main.isRunning ? 'PARAR' : 'INICIAR'}
          </button>
          <button
            type="button"
            ref={confirmReset.buttonRef}
            className={`btn-stopwatch stopwatch-btn hdr-stopwatch-btn${confirmReset.isArmed ? ' btn-stopwatch--armed' : ''}`}
            onClick={confirmReset.handleResetClick}
            aria-label={confirmReset.isArmed ? 'Confirmar reinicio' : 'Reiniciar carrera'}
          >
            {confirmReset.buttonLabel}
          </button>
        </div>
      </div>

      {!rows.some((r) => r.assignedTimeSeconds !== null && !Number.isNaN(r.assignedTimeSeconds)) ? (
        /* ── Empty state shortcut card ──────────────────── */
        <div className="card hdr-empty-card">
          <span className="hdr-empty-text">SIN HOJA DE RUTA CARGADA</span>
          <button
            type="button"
            className="btn-primary hdr-empty-btn"
            onClick={onOpenCargarHoja}
          >
            CARGAR HOJA DE RUTA
          </button>
        </div>
      ) : (
        <>
          {/* ── Accumulated deviation panel ──────────────────── */}
      <DeltaPanel
        deltaSeconds={deviationSeconds}
        state={deltaState}
        assignedSpeed={assignedStripSpeed}
      />

      {/* ── Next stretch speed block ──────────────────────── */}
      <div className="hdr-next-stretch">
        <div className="hdr-next-stretch-left">
          <span className="hdr-next-stretch-label">
            {currentIdx !== null
              ? `PRÓXIMO TRAMO · HASTA MARCA ${currentIdx + 1}`
              : 'PRÓXIMO TRAMO'}
          </span>
          <span className="hdr-next-stretch-speed">
            {nextStretch.available
              ? `IR A ${formatSpeed(nextStretch.adjustedSpeedKmH)} KM/H`
              : `IR A --,- KM/H`}
          </span>
          {nextStretch.available && nextStretch.demanding && (
            <span className="hdr-next-stretch-demanding">
              EXIGENTE: +10% SOBRE LA ORGANIZACIÓN
            </span>
          )}
        </div>
        {nextStretch.available && (
          <div className="hdr-next-stretch-right">
            <span className="hdr-next-stretch-dir">
              {nextStretch.direction === 'faster'
                ? '▲ MÁS RÁPIDO'
                : nextStretch.direction === 'slower'
                ? '▼ MÁS LENTO'
                : 'IGUAL'}
            </span>
            <span className="hdr-next-stretch-org">
              ORG. {formatSpeed(nextStretch.organizationSpeedKmH)}
            </span>
          </div>
        )}
      </div>

      {/* ── Marks list ───────────────────────────────────── */}
      <div className="hdr-marks-list">
        {/* ANTERIOR */}
        <div className="hdr-mark-card hdr-mark-card--anterior card">
          <div className="hdr-mark-card-left">
            <span className="hdr-mark-card-badge label-md on-surface-variant">ANTERIOR</span>
            {anteriorInfo ? (
              <>
                <span className="hdr-mark-num label-md on-surface-variant">
                  {anteriorIdx! + 1}
                </span>
                <span className="hdr-mark-text">{anteriorInfo.row.mark || '—'}</span>
              </>
            ) : (
              <span className="hdr-mark-text on-surface-variant">—</span>
            )}
          </div>
          <div className="hdr-mark-card-right">
            {anteriorInfo?.mark?.status === 'marked' && anteriorInfo.mark.realElapsedMs !== undefined ? (
              <>
                <span className="hdr-mark-time-real">
                  {formatElapsedHmsDecimal(anteriorInfo.mark.realElapsedMs)}
                </span>
                {anteriorInfo.row.assignedTimeSeconds !== null && (() => {
                  const dev = computeRowDeviation(
                    anteriorInfo.row.assignedTimeSeconds,
                    anteriorInfo.mark.realElapsedMs
                  );
                  if (dev === null) return null;
                  return (
                    <span className={`hdr-mark-dev ${dev >= 0 ? 'hdr-mark-dev--ahead' : 'hdr-mark-dev--behind'}`}>
                      {formatDelta(dev)}s
                    </span>
                  );
                })()}
              </>
            ) : anteriorInfo?.mark?.status === 'skipped' ? (
              <span className="hdr-mark-skipped on-surface-variant">SALTADO</span>
            ) : null}
          </div>
        </div>

        {/* ACTUAL */}
        <div className={`hdr-mark-card hdr-mark-card--actual card${raceSnapshot.isFinished ? ' hdr-mark-card--finished' : ''}`}>
          <div className="hdr-mark-card-header">
            <div className="hdr-mark-card-badge-row">
              <span className="hdr-mark-card-badge label-md on-surface-variant">ACTUAL</span>
              {actualInfo && (
                <span className="hdr-mark-num label-md on-surface-variant">
                  {currentIdx! + 1}
                </span>
              )}
            </div>
            {actualInfo && actualInfo.row.assignedTimeSeconds !== null ? (
              <span className="hdr-mark-estipulado brass">
                ESTIPULADO: {formatTimeHms(actualInfo.row.assignedTimeSeconds)}
              </span>
            ) : null}
          </div>
          <div className="hdr-mark-card-text-row">
            <span className={`hdr-mark-text${actualInfo ? '' : ' on-surface-variant'}`}>
              {actualInfo
                ? (actualInfo.row.mark || '—')
                : (raceSnapshot.isFinished ? 'FIN DE HOJA' : '—')}
            </span>
          </div>
        </div>

        {/* SIGUIENTE */}
        <div className="hdr-mark-card hdr-mark-card--siguiente card">
          <div className="hdr-mark-card-left">
            <span className="hdr-mark-card-badge label-md on-surface-variant">SIGUIENTE</span>
            {siguienteIdx !== null && rows[siguienteIdx] ? (
              <>
                <span className="hdr-mark-num label-md on-surface-variant">
                  {siguienteIdx + 1}
                </span>
                <span className="hdr-mark-text on-surface-variant">
                  {rows[siguienteIdx].mark || '—'}
                </span>
              </>
            ) : (
              <span className="hdr-mark-text on-surface-variant">—</span>
            )}
          </div>
          <div className="hdr-mark-card-right">
            {siguienteIdx !== null && rows[siguienteIdx]?.assignedTimeSeconds !== null ? (
              <span className="hdr-mark-time-assigned on-surface-variant">
                {formatTimeHms(rows[siguienteIdx].assignedTimeSeconds!)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── MARCAR button ─────────────────────────────── */}
      <button
        type="button"
        className="btn-primary hdr-marcar-btn"
        onClick={() => { confirmReset.disarm(); handleMark(); }}
        disabled={raceSnapshot.isFinished || currentIdx === null || !snapshot.isRunning}
        aria-label="Marcar paso"
      >
        MARCAR
      </button>

      {/* ── SALTAR + DESHACER ─────────────────────────── */}
      <div className="btn-row hdr-secondary-btns">
        <button
          type="button"
          className="btn-secondary hdr-secondary-btn"
          onClick={() => { confirmReset.disarm(); handleSkip(); }}
          disabled={raceSnapshot.isFinished || currentIdx === null}
          aria-label="Saltar marca actual"
        >
          SALTAR
        </button>
        <button
          type="button"
          className="btn-secondary hdr-secondary-btn"
          onClick={() => { confirmReset.disarm(); handleUndo(); }}
          disabled={raceSnapshot.history.length === 0}
          aria-label="Deshacer última acción"
        >
          DESHACER
        </button>
      </div>
        </>
      )}

      {/* ── Second stopwatch ──────────────────────────── */}
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
