import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CALIBRATION_MIN_MEASURED_DISTANCE_KM,
  STALE_SPEED_TIMEOUT_MS,
} from '../logic/gpsConstants';
import {
  CalibrationMeter,
  computeCorrectionFactor,
  CALIBRATION_ERROR_MESSAGES,
} from '../logic/calibration';
import { formatDistance, formatFactor } from '../logic/format';
import { getGpsStatusLine } from '../logic/gpsStatus';
import { BrowserGpsReader, type GpsReader, type GpsStatus } from '../logic/gpsReader';
import { WakeLockManager, type WakeLockApi } from '../logic/wakeLock';
import { isSimulatorRequested, parseSimulatorConfig } from '../logic/simulatorDetector';
import { GpsStatusLine } from '../components/GpsStatusLine';
import type { SaveResult } from '../storage';
import { useRaceSession } from '../context/RaceContext';
import './CalibrarOdometroScreen.css';

export interface CalibrarOdometroScreenProps {
  onBackToPreparar: () => void;
  onCalibrationComplete: () => void;
  onSaveFactor: (factor: number) => SaveResult;
  isCalibrationAllowed?: boolean;
  initialReader?: GpsReader;
  wakeLockApi?: WakeLockApi | null;
}

type Step = 1 | 2 | 3;

export function CalibrarOdometroScreen({
  onBackToPreparar,
  onCalibrationComplete,
  onSaveFactor,
  isCalibrationAllowed: isCalibrationAllowedProp,
  initialReader,
  wakeLockApi,
}: CalibrarOdometroScreenProps) {
  // Query single source of truth for race running state
  let isCalibrationAllowed = isCalibrationAllowedProp ?? true;
  try {
    const raceSession = useRaceSession();
    if (isCalibrationAllowedProp === undefined) {
      isCalibrationAllowed = raceSession.isCalibrationAllowed;
    }
  } catch {
    // Isolated tests without provider
  }

  // ── Step and distance state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal2') return 2;
      if (demo === 'cal3') return 3;
    }
    return 1;
  });

  const [officialInput, setOfficialInput] = useState<string>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal1' || demo === 'cal2' || demo === 'cal3') return '8,000';
    }
    return '';
  });

  const [officialKm, setOfficialKm] = useState<number | null>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal2' || demo === 'cal3') {
        const off = params.get('off');
        return off ? Number(off) : 8.0;
      }
    }
    return null;
  });

  const [measuredKm, setMeasuredKm] = useState<number | null>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal2' || demo === 'cal3') {
        const meas = params.get('meas');
        return meas ? Number(meas) : 7.892;
      }
    }
    return null;
  });

  const [hasStartedMeasuring, setHasStartedMeasuring] = useState<boolean>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal2' || demo === 'cal3') return true;
    }
    return false;
  });

  const [meterState, setMeterState] = useState<'idle' | 'measuring' | 'stopped'>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal2' || demo === 'cal3') return 'stopped';
    }
    return 'idle';
  });

  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Reader & WakeLock setup ──────────────────────────────────────────────
  const readerRef = useRef<GpsReader | null>(initialReader ?? null);
  const meterRef = useRef<CalibrationMeter | null>(null);
  const wakeLockRef = useRef<WakeLockManager>(
    new WakeLockManager(wakeLockApi !== undefined ? wakeLockApi : undefined)
  );

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [hasReceivedReading, setHasReceivedReading] = useState(false);
  const lastReadingTimeRef = useRef<number | null>(null);

  // Initialize reader & meter
  useEffect(() => {
    if (meterRef.current) return;

    let active = true;
    const simRequested = !initialReader && isSimulatorRequested();

    const setupMeterWithReader = (reader: GpsReader) => {
      readerRef.current = reader;
      const meter = new CalibrationMeter({ reader });
      meterRef.current = meter;

      // Subscribe to meter snapshots
      meter.subscribe((snap) => {
        setMeterState(snap.state);
        setMeasuredKm(snap.measuredDistanceKm);
      });

      // Track reader status for GPS status line
      reader.onStatusChange((status) => {
        setGpsStatus(status);
      });

      reader.onReading((reading) => {
        lastReadingTimeRef.current = reading.timestamp;
        setHasReceivedReading(true);
      });
    };

    if (simRequested && import.meta.env.DEV) {
      const { speedKmH, seed } = parseSimulatorConfig();
      import('../logic/gpsSimulator').then(({ GpsSimulator }) => {
        if (!active) return;
        setupMeterWithReader(new GpsSimulator({ speedKmH, seed }));
      });
    } else {
      setupMeterWithReader(initialReader ?? new BrowserGpsReader());
    }

    return () => {
      active = false;
      wakeLockRef.current.release();
      meterRef.current?.destroy();
      meterRef.current = null;
    };
  }, [initialReader]);

  // Safety exit: if race starts running while in calibration, exit immediately
  useEffect(() => {
    if (!isCalibrationAllowed) {
      wakeLockRef.current.release();
      meterRef.current?.stop();
      meterRef.current?.destroy();
      onBackToPreparar();
    }
  }, [isCalibrationAllowed, onBackToPreparar]);

  // Foreground recovery & WakeLock re-acquisition
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        const isMeasuring = meterRef.current?.getState() === 'measuring';
        void wakeLockRef.current.onPageVisible(true, isMeasuring);

        if (isMeasuring && readerRef.current) {
          const status = readerRef.current.getStatus();
          const now = Date.now();
          const isStale =
            lastReadingTimeRef.current !== null &&
            now - lastReadingTimeRef.current > STALE_SPEED_TIMEOUT_MS;

          if (
            status === 'timeout' ||
            status === 'unavailable' ||
            (status === 'active' && isStale)
          ) {
            readerRef.current.start();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── Step 1 actions ────────────────────────────────────────────────────────
  const parsedOfficial = Number(officialInput.trim().replace(',', '.'));
  const isOfficialValid =
    officialInput.trim() !== '' &&
    !Number.isNaN(parsedOfficial) &&
    Number.isFinite(parsedOfficial) &&
    parsedOfficial > 0;

  const handleStep1Next = () => {
    if (!isOfficialValid) return;
    setOfficialKm(parsedOfficial);
    setStep(2);
  };

  // ── Step 2 actions ────────────────────────────────────────────────────────
  const handleStartMeter = useCallback(() => {
    if (!meterRef.current) return;
    setHasStartedMeasuring(true);
    setHasReceivedReading(false);
    lastReadingTimeRef.current = null;
    meterRef.current.start();
    setMeterState('measuring');
    void wakeLockRef.current.acquire();
  }, []);

  const handleStopMeter = useCallback(() => {
    if (!meterRef.current) return;
    meterRef.current.stop();
    setMeterState('stopped');
    void wakeLockRef.current.release();
  }, []);

  const handleStep2Next = () => {
    if (
      meterState !== 'stopped' ||
      measuredKm === null ||
      measuredKm < CALIBRATION_MIN_MEASURED_DISTANCE_KM
    ) {
      return;
    }
    setStep(3);
  };

  const isStep2NextAllowed =
    meterState === 'stopped' &&
    measuredKm !== null &&
    measuredKm >= CALIBRATION_MIN_MEASURED_DISTANCE_KM;

  const isMeasuredTooSmall =
    meterState === 'stopped' &&
    measuredKm !== null &&
    measuredKm < CALIBRATION_MIN_MEASURED_DISTANCE_KM;

  // ── Step 3 actions ────────────────────────────────────────────────────────
  const factorResult =
    officialKm !== null && measuredKm !== null
      ? computeCorrectionFactor(officialKm, measuredKm)
      : null;

  const handleAplicar = () => {
    if (!factorResult || !factorResult.ok) return;
    const saveRes = onSaveFactor(factorResult.factor);
    if (!saveRes.ok) {
      setApplyError(saveRes.error);
      return;
    }
    wakeLockRef.current.release();
    meterRef.current?.destroy();
    onCalibrationComplete();
  };

  // ── Back button handling ──────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 1) {
      wakeLockRef.current.release();
      meterRef.current?.destroy();
      onBackToPreparar();
    } else if (step === 2) {
      // Going back to step 1 discards the measurement and stops the meter if measuring
      wakeLockRef.current.release();
      meterRef.current?.reset();
      setMeterState('idle');
      setMeasuredKm(null);
      setHasStartedMeasuring(false);
      setStep(1);
    } else if (step === 3) {
      // Going back from step 3 to step 2 keeps the stopped measurement
      setStep(2);
    }
  };

  // ── GPS status line calculation for Step 2 ─────────────────────────────────
  const statusLine = getGpsStatusLine({
    status: gpsStatus,
    hasReceivedReading,
  });

  return (
    <div className="secondary-screen calibrar-screen">
      {/* ── Header: Back button + Title + Step counter ── */}
      <header className="secondary-header">
        <button
          type="button"
          className="btn-icon-secondary secondary-back-btn"
          aria-label="Volver"
          onClick={handleBack}
        >
          ‹
        </button>
        <h1 className="secondary-title">CALIBRAR ODÓMETRO</h1>
        <span className="calibration-step-counter label-md">{`${step}/3`}</span>
      </header>

      <div className="secondary-content">
        {step === 1 && (
          /* ── Step 1/3: Official Distance ──────────────────────────────── */
          <>
            <div className="card calibrar-card">
              <label className="calibrar-field-label" htmlFor="official-distance-input">
                DISTANCIA OFICIAL DE LA ZONA
              </label>
              <div className="calibrar-input-row">
                <input
                  id="official-distance-input"
                  type="text"
                  inputMode="decimal"
                  className="calibrar-input"
                  value={officialInput}
                  onChange={(e) => setOfficialInput(e.target.value)}
                  placeholder="0,000"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span className="calibrar-unit label-lg brass">KM</span>
              </div>
              <p className="calibrar-help">
                La indica la organización (por ejemplo, 8 km al inicio del evento).
              </p>
            </div>

            <div className="calibrar-actions">
              <button
                type="button"
                className="btn-primary btn-full"
                disabled={!isOfficialValid}
                aria-disabled={!isOfficialValid}
                onClick={handleStep1Next}
              >
                SIGUIENTE
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          /* ── Step 2/3: Measure Zone ──────────────────────────────────── */
          <>
            <div className="card calibrar-card">
              <div className="calibrar-field-label">MEDIDO POR LA APP</div>
              <div className="calibrar-measured-row">
                <span className="calibrar-measured-value headline-xl brass">
                  {hasStartedMeasuring
                    ? formatDistance(measuredKm, 3)
                    : '--,---'}
                </span>
                <span className="calibrar-unit label-lg brass">KM</span>
              </div>

              {/* GPS status line below measured distance */}
              <GpsStatusLine
                statusText={statusLine.text}
                statusKind={statusLine.kind}
                className="calibrar-gps-status"
              />

              <p className="calibrar-help">
                Iniciá al comienzo de la zona y detenela al final.
              </p>

              <div className="calibrar-buttons-row">
                <button
                  type="button"
                  className="btn-primary calibrar-action-btn"
                  onClick={handleStartMeter}
                  disabled={meterState === 'measuring'}
                  aria-disabled={meterState === 'measuring'}
                >
                  INICIAR
                </button>
                <button
                  type="button"
                  className="btn-primary calibrar-action-btn"
                  onClick={handleStopMeter}
                  disabled={meterState !== 'measuring'}
                  aria-disabled={meterState !== 'measuring'}
                >
                  PARAR
                </button>
              </div>

              {isMeasuredTooSmall && (
                <p className="calibrar-error-message" role="alert">
                  {CALIBRATION_ERROR_MESSAGES['too-small']}
                </p>
              )}
            </div>

            <div className="calibrar-actions">
              <button
                type="button"
                className="btn-primary btn-full"
                disabled={!isStep2NextAllowed}
                aria-disabled={!isStep2NextAllowed}
                onClick={handleStep2Next}
              >
                SIGUIENTE
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          /* ── Step 3/3: Review & Apply ────────────────────────────────── */
          <>
            <div className="card calibrar-card">
              <div className="calibrar-kv-row">
                <span className="calibrar-field-label">OFICIAL</span>
                <span className="calibrar-kv-value headline-md">
                  {formatDistance(officialKm, 3)} <span className="label-md brass">KM</span>
                </span>
              </div>

              <div className="calibrar-kv-row">
                <span className="calibrar-field-label">MEDIDO</span>
                <span className="calibrar-kv-value headline-md">
                  {formatDistance(measuredKm, 3)} <span className="label-md brass">KM</span>
                </span>
              </div>

              <div className="calibrar-factor-divider">
                <div className="calibrar-field-label">FACTOR DE CORRECCIÓN</div>
                <div className="calibrar-factor-display display brass">
                  {factorResult?.factor !== undefined
                    ? formatFactor(factorResult.factor)
                    : '--,----'}
                </div>
              </div>

              {factorResult && !factorResult.ok && (
                <p className="calibrar-error-message" role="alert">
                  {CALIBRATION_ERROR_MESSAGES[factorResult.error]}
                </p>
              )}

              {applyError && (
                <p className="calibrar-error-message" role="alert">
                  {applyError}
                </p>
              )}
            </div>

            <div className="calibrar-actions">
              <button
                type="button"
                className="btn-primary btn-full"
                disabled={!factorResult || !factorResult.ok}
                aria-disabled={!factorResult || !factorResult.ok}
                onClick={handleAplicar}
              >
                APLICAR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
