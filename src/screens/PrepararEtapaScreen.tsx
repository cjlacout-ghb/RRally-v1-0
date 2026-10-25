import { useState } from 'react';
import { parseStageSpeed, STAGE_SPEED_ERROR_MESSAGES } from '../logic/stageSpeed';
import { formatSpeed } from '../logic/format';
import type { SaveResult } from '../storage';
import './PrepararEtapaScreen.css';

interface PrepararEtapaScreenProps {
  /** Currently saved speed (null if not set yet). */
  savedSpeed: number | null;
  /** Called with the parsed+validated speed on APLICAR success. */
  onSave: (speed: number) => SaveResult;
  /** Called when the back button is pressed (does NOT save). */
  onBack: () => void;
}

export function PrepararEtapaScreen({ savedSpeed, onSave, onBack }: PrepararEtapaScreenProps) {
  // Pre-fill with saved value using Argentine comma format, or empty.
  const [inputValue, setInputValue] = useState<string>(
    savedSpeed !== null ? formatSpeed(savedSpeed) : ''
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleAplicar() {
    setFieldError(null);
    setSaveError(null);

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

        {/* Bottom actions */}
        <div className="preparar-actions">
          <button
            type="button"
            className="btn-primary btn-full"
            onClick={handleAplicar}
          >
            APLICAR
          </button>

          {/* Phase 4: calibration flow not yet implemented — button is disabled. */}
          <button
            type="button"
            className="btn-secondary btn-full"
            disabled
            aria-disabled="true"
            aria-label="Calibrar odómetro (no disponible aún)"
          >
            CALIBRAR ODÓMETRO
          </button>
        </div>
      </div>
    </div>
  );
}
