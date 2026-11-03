import { useState } from 'react';
import { parseStageSpeed, STAGE_SPEED_ERROR_MESSAGES } from '../logic/stageSpeed';
import { formatSpeed } from '../logic/format';
import type { SaveResult } from '../storage';
import { useRaceSession } from '../context/RaceContext';
import type { ControlSystem } from '../logic/controlSystem';
import { formatRoadbookCounter, type RoadbookRow } from '../logic/roadbookModel';
import './PrepararEtapaScreen.css';

interface PrepararEtapaScreenProps {
  /** Currently saved speed (null if not set yet). */
  savedSpeed: number | null;
  /** Called with the parsed+validated speed on APLICAR success. */
  onSave: (speed: number) => SaveResult;
  /** Called when the back button is pressed (does NOT save). */
  onBack: () => void;
  /** Called when CALIBRAR ODÓMETRO is pressed. */
  onCalibrate?: () => void;
  /** Single source of truth for whether calibration is allowed. If omitted, read from RaceSession. */
  isCalibrationAllowed?: boolean;
  /** Currently selected control system. */
  controlSystem?: ControlSystem;
  /** Called when the user switches control system. */
  onChangeControlSystem?: (system: ControlSystem) => void;
  /** Loaded roadbook sheet rows (for Hoja de ruta mode). Single source of truth for counter. */
  roadbookRows?: RoadbookRow[];
  /** Legacy row count fallback (for backwards compatibility). */
  roadbookRowCount?: number;
  /** Called when CARGAR HOJA DE RUTA is pressed. */
  onOpenCargarHoja?: () => void;
}

export function PrepararEtapaScreen({
  savedSpeed,
  onSave,
  onBack,
  onCalibrate,
  isCalibrationAllowed: isCalibrationAllowedProp,
  controlSystem = 'carrera',
  onChangeControlSystem,
  roadbookRows,
  roadbookRowCount = 0,
  onOpenCargarHoja,
}: PrepararEtapaScreenProps) {
  let isCalibrationAllowed = isCalibrationAllowedProp ?? true;
  let isRaceRunning = false;
  try {
    const raceSession = useRaceSession();
    if (isCalibrationAllowedProp === undefined) {
      isCalibrationAllowed = raceSession.isCalibrationAllowed;
    }
    isRaceRunning = raceSession.snapshot.isRunning;
  } catch {
    // If rendered outside RaceProvider in isolated unit tests
  }

  const isSystemSelectorDisabled = isRaceRunning;
  const roadbookCounterText = roadbookRows
    ? formatRoadbookCounter(roadbookRows)
    : `${roadbookRowCount} FILAS`;
  // Pre-fill with saved value using Argentine comma format, or empty.
  const [inputValue, setInputValue] = useState<string>(
    savedSpeed !== null ? formatSpeed(savedSpeed) : ''
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleAplicar() {
    setFieldError(null);
    setSaveError(null);

    if (controlSystem === 'carrera') {
      const parsed = parseStageSpeed(inputValue);
      if (!parsed.ok) {
        setFieldError(STAGE_SPEED_ERROR_MESSAGES[parsed.error]);
        return;
      }

      const result = onSave(parsed.value);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
    }

    onBack();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    // Clear errors as the user types.
    if (fieldError) setFieldError(null);
    if (saveError) setSaveError(null);
  }

  const errorMessage = fieldError ?? saveError;

  return (
    <div className="secondary-screen">
      {/* Secondary screen header: back + title */}
      <header className="secondary-header">
        <button
          type="button"
          className="btn-icon-secondary secondary-back-btn"
          aria-label="Volver"
          onClick={onBack}
        >
          ‹
        </button>
        <h1 className="secondary-title">PREPARAR ETAPA</h1>
      </header>

      <div className="secondary-content">
        {/* ── Control system selector ──────────────────────── */}
        <div className="card preparar-card">
          <span className="preparar-field-label">SISTEMA DE CONTROL</span>
          <div className="preparar-system-selector">
            <button
              type="button"
              className={`btn-system-selector${controlSystem === 'carrera' ? ' btn-system-selector--active' : ''}`}
              disabled={isSystemSelectorDisabled}
              aria-pressed={controlSystem === 'carrera'}
              onClick={() => !isSystemSelectorDisabled && onChangeControlSystem?.('carrera')}
            >
              {controlSystem === 'carrera' && <span className="system-check" aria-hidden="true">✓</span>}
              <span>CARRERA</span>
            </button>
            <button
              type="button"
              className={`btn-system-selector${controlSystem === 'hoja-de-ruta' ? ' btn-system-selector--active' : ''}`}
              disabled={isSystemSelectorDisabled}
              aria-pressed={controlSystem === 'hoja-de-ruta'}
              onClick={() => !isSystemSelectorDisabled && onChangeControlSystem?.('hoja-de-ruta')}
            >
              {controlSystem === 'hoja-de-ruta' && <span className="system-check" aria-hidden="true">✓</span>}
              <span>HOJA DE RUTA</span>
            </button>
          </div>
          <div className="calibration-blocked-msg" role="status" aria-live="polite">
            {isSystemSelectorDisabled ? 'DETENÉ LA CARRERA PARA CAMBIAR EL SISTEMA' : '\u00A0'}
          </div>
        </div>

        {/* ── Carrera mode: speed field ────────────────────── */}
        {controlSystem === 'carrera' && (
          <div className="card preparar-card">
            {/* Speed field */}
            <label className="preparar-field-label" htmlFor="stage-speed-input">
              VELOCIDAD MEDIA DE LA ETAPA
            </label>
            <div className={`preparar-input-row${errorMessage ? ' preparar-input-row--error' : ''}`}>
              <input
                id="stage-speed-input"
                type="text"
                inputMode="decimal"
                className={`preparar-input${errorMessage ? ' preparar-input--error' : ''}`}
                value={inputValue}
                onChange={handleInputChange}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={errorMessage ? 'speed-error' : undefined}
                aria-invalid={errorMessage ? true : undefined}
              />
              <span className="preparar-unit label-lg brass">KM/H</span>
            </div>

            {/* Inline validation/save error */}
            {errorMessage && (
              <p id="speed-error" className="preparar-error" role="alert">
                {errorMessage}
              </p>
            )}

            {/* Help copy from the mockup */}
            <p className="preparar-help">
              Es la velocidad media que indica la organización para esta etapa.
            </p>
          </div>
        )}

        {/* ── Hoja de ruta mode: sheet card ────────────────── */}
        {controlSystem === 'hoja-de-ruta' && (
          <div className="card preparar-card preparar-roadbook-card">
            <span className="preparar-field-label">HOJA CARGADA</span>
            <span className="preparar-roadbook-count brass">
              {roadbookCounterText}
            </span>
            <button
              type="button"
              className="btn-secondary btn-full"
              onClick={onOpenCargarHoja}
            >
              CARGAR HOJA DE RUTA
            </button>
          </div>
        )}

        {/* Bottom actions */}
        <div className="preparar-actions">
          <button
            type="button"
            className="btn-primary btn-full"
            onClick={handleAplicar}
          >
            APLICAR
          </button>

          {controlSystem === 'carrera' && (
            <div className="calibration-blocked-container">
              <button
                type="button"
                className={`btn-secondary btn-full ${!isCalibrationAllowed ? 'btn-secondary--disabled' : ''}`}
                disabled={!isCalibrationAllowed}
                aria-disabled={!isCalibrationAllowed}
                onClick={onCalibrate}
              >
                CALIBRAR ODÓMETRO
              </button>
              <div
                className="calibration-blocked-msg"
                role="status"
                aria-live="polite"
              >
                {!isCalibrationAllowed ? 'DETENÉ LA CARRERA PARA CALIBRAR' : '\u00A0'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
