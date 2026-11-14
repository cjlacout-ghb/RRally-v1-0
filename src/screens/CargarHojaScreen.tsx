import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MAX_SHEET_ROWS,
  formatRoadbookCounter,
  getRowDisplaySpeed,
  rowHasContent,
  isRoadbookClearingAllowed,
  ROADBOOK_CLEAR_BLOCKED_MESSAGE,
  type RoadbookRow,
} from '../logic/roadbookModel';
import {
  parseTimeDigits,
  EMPTY_TIME_PLACEHOLDER,
  formatTimeHms,
} from '../logic/roadbookTime';
import { clearAllRoadbookData } from '../storage';
import { useConfirmReset } from '../hooks/useConfirmReset';
import { useRaceSession } from '../context/RaceContext';
import { MarcaMenu } from '../components/MarcaMenu';
import { ETIQUETAS_VALIDAS } from '../logic/marcaTextos';
import './CargarHojaScreen.css';

interface CargarHojaScreenProps {
  rows: RoadbookRow[];
  onAddRows: () => void;
  onUpdateRow: (
    rowId: string,
    changes: Partial<Pick<RoadbookRow, 'mark' | 'assignedTimeSeconds' | 'speedKmH' | 'etiqueta'>>
  ) => void;
  onBack: () => void;
  /** Optional handler to clear a single row */
  onClearRow?: (rowId: string) => void;
  /** Optional handler to clear all rows and race state */
  onClearAll?: () => void;
  /** Single source of truth for whether race is running. If omitted, read from RaceSession. */
  isRaceRunning?: boolean;
  /** Testing escape-hatch for initial edit state */
  initialEditingRowId?: string | null;
  initialEditingField?: 'mark' | 'time' | 'speed' | null;
}

export function CargarHojaScreen({
  rows,
  onAddRows,
  onUpdateRow,
  onBack,
  onClearRow,
  onClearAll,
  isRaceRunning: isRaceRunningProp,
  initialEditingRowId = null,
  initialEditingField = null,
}: CargarHojaScreenProps) {
  let isRaceRunning = isRaceRunningProp ?? false;
  if (isRaceRunningProp === undefined) {
    try {
      const raceSession = useRaceSession();
      isRaceRunning = raceSession.snapshot.isRunning;
    } catch {
      // Outside RaceProvider in isolated unit tests
    }
  }

  const isClearBlocked = !isRoadbookClearingAllowed(isRaceRunning);
  const [editingRowId, setEditingRowId] = useState<string | null>(initialEditingRowId);
  const [editingField, setEditingField] = useState<'mark' | 'time' | 'speed' | null>(initialEditingField);
  const [activeMarcaTab, setActiveMarcaTab] = useState<'marca' | 'etiqueta'>('marca');
  const [timeDigits, setTimeDigits] = useState<string>('');
  const [speedInput, setSpeedInput] = useState<string>('');
  const [markInput, setMarkInput] = useState<string>(() => {
    if (initialEditingRowId) {
      const found = rows.find((r) => r.id === initialEditingRowId);
      return found ? found.mark : '';
    }
    return '';
  });
  const [isMenuCollapsed, setIsMenuCollapsed] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string | null>(null);
  const [menuResetKey, setMenuResetKey] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const canAddMore = rows.length < MAX_SHEET_ROWS;

  const handleConfirmClearAll = useCallback(() => {
    if (isClearBlocked) return;
    setEditingRowId(null);
    setEditingField(null);
    setMarkInput('');
    setTimeDigits('');
    setSpeedInput('');
    setIsMenuCollapsed(false);
    setFilterQuery(null);
    setActiveMarcaTab('marca');

    if (onClearAll) {
      onClearAll();
    } else {
      clearAllRoadbookData();
    }
  }, [isClearBlocked, onClearAll]);

  const confirmReset = useConfirmReset({
    onReset: handleConfirmClearAll,
    hasSomethingToLose: true,
    unarmedLabel: 'BORRAR TODO',
    armedLabel: 'CONFIRMAR',
  });

  useEffect(() => {
    if (isClearBlocked && confirmReset.isArmed) {
      confirmReset.disarm();
    }
  }, [isClearBlocked, confirmReset]);

  function handleClearRow(row: RoadbookRow) {
    if (isClearBlocked) return;
    confirmReset.disarm();

    if (onClearRow) {
      onClearRow(row.id);
    } else {
      onUpdateRow(row.id, { mark: '', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' });
    }

    if (editingRowId === row.id) {
      setMarkInput('');
      setIsMenuCollapsed(true);
      setFilterQuery(null);
      if (editingField === 'time') {
        setTimeDigits('');
      } else if (editingField === 'speed') {
        setSpeedInput('');
      }
    }
  }

  function startEditRow(row: RoadbookRow, field: 'mark' | 'time' | 'speed') {
    confirmReset.disarm();
    setEditingRowId(row.id);
    setEditingField(field);

    if (field === 'mark') {
      setActiveMarcaTab('marca');
      setMarkInput(row.mark);
      setIsMenuCollapsed(false);
      setFilterQuery(null);
      setMenuResetKey((k) => k + 1);
    } else if (field === 'time') {
      if (row.assignedTimeSeconds !== null) {
        const h = Math.floor(row.assignedTimeSeconds / 3600);
        const m = Math.floor((row.assignedTimeSeconds % 3600) / 60);
        const s = row.assignedTimeSeconds % 60;
        const raw =
          (h > 0 ? String(h) : '') +
          String(m).padStart(h > 0 ? 2 : 1, '0') +
          String(s).padStart(2, '0');
        setTimeDigits(raw.replace(/^0+/, '') || '0');
      } else {
        setTimeDigits('');
      }
    } else if (field === 'speed') {
      setSpeedInput(row.speedKmH !== null ? String(row.speedKmH) : '');
    }
  }

  // Minimum scroll needed to keep the edited row visible above the pinned bottom panel.
  // Never moves the list if the row is already fully visible.
  useEffect(() => {
    if (editingRowId && scrollContainerRef.current) {
      const rowEl = rowRefs.current.get(editingRowId);
      const container = scrollContainerRef.current;
      if (rowEl && container) {
        const rowRect = rowEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (rowRect.bottom > containerRect.bottom) {
          container.scrollTop += rowRect.bottom - containerRect.bottom;
        } else if (rowRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - rowRect.top;
        }
      }
    }
  }, [editingRowId, editingField]);

  function handleMenuSeleccionar(textoCompleto: string) {
    if (!editingRowId) return;
    setMarkInput(textoCompleto);
    onUpdateRow(editingRowId, { mark: textoCompleto });
    setIsMenuCollapsed(true);
    setFilterQuery(null);
  }

  function handleMarkInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setMarkInput(value);
    if (editingRowId) {
      onUpdateRow(editingRowId, { mark: value });
    }
    setIsMenuCollapsed(false);
    setFilterQuery(value);
  }

  function handleTimeDigit(digit: string) {
    const newDigits = (timeDigits + digit).replace(/^0+/, '') || digit;
    if (newDigits.length <= 6) {
      setTimeDigits(newDigits);
    }
  }

  function handleTimeBackspace() {
    setTimeDigits((prev) => prev.slice(0, -1));
  }

  function commitTimeEdit() {
    if (!editingRowId) return;
    const parsed = parseTimeDigits(timeDigits);
    onUpdateRow(editingRowId, { assignedTimeSeconds: parsed.valid ? parsed.totalSeconds : null });
    setEditingRowId(null);
    setEditingField(null);
  }

  function handleSpeedInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSpeedInput(val);
    if (!editingRowId) return;
    const num = parseFloat(val.replace(',', '.'));
    onUpdateRow(editingRowId, { speedKmH: Number.isFinite(num) && num > 0 ? num : null });
  }

  function handleListo() {
    confirmReset.disarm();
    if (editingField === 'time' && editingRowId) {
      const parsed = parseTimeDigits(timeDigits);
      onUpdateRow(editingRowId, { assignedTimeSeconds: parsed.valid ? parsed.totalSeconds : null });
    }
    setEditingRowId(null);
    setEditingField(null);
    onBack();
  }

  const editingRow = editingRowId ? rows.find((r) => r.id === editingRowId) : null;

  return (
    <div className="secondary-screen cargar-hoja-screen">
      <header className="secondary-header">
        <button
          type="button"
          className="btn-icon-secondary secondary-back-btn"
          aria-label="Volver"
          onClick={handleListo}
        >
          ‹
        </button>
        <h1 className="secondary-title">CARGAR HOJA</h1>
        <span className="cargar-hoja-count brass">
          {formatRoadbookCounter(rows)}
        </span>
      </header>

      {/* Área de lista con scroll */}
      <div className="cargar-hoja-scroll-area" ref={scrollContainerRef}>
        {/* Encabezado de columnas */}
        <div className="cargar-hoja-col-header">
          <span className="cargar-hoja-col-num">N°</span>
          <span className="cargar-hoja-col-mark">MARCA</span>
          <span className="cargar-hoja-col-time">TIEMPO</span>
          <span className="cargar-hoja-col-speed">KM/H</span>
          <span className="cargar-hoja-col-clear" aria-hidden="true" />
        </div>

        {/* Filas */}
        <div className="cargar-hoja-rows">
          {rows.map((row, idx) => {
            const isEditing = row.id === editingRowId;
            const timeText =
              row.assignedTimeSeconds !== null
                ? formatTimeHms(row.assignedTimeSeconds)
                : EMPTY_TIME_PLACEHOLDER;
            const speedDisplay = getRowDisplaySpeed(rows, idx);
            const hasContent = rowHasContent(row);
            const hasEtiqueta = Boolean(row.etiqueta && row.etiqueta !== 'none');
            const hasMark = Boolean(row.mark && row.mark.trim());

            return (
              <div
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
                className={`cargar-hoja-row card${isEditing ? ' cargar-hoja-row--editing' : ''}`}
              >
                <span className="cargar-hoja-row-num label-md on-surface-variant">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  className="cargar-hoja-row-mark"
                  onClick={() => startEditRow(row, 'mark')}
                  aria-label={`Editar marca de la fila ${idx + 1}${hasEtiqueta ? `, etiqueta: ${row.etiqueta}` : ''}`}
                >
                  {hasEtiqueta ? (
                    <>
                      <span className="cargar-hoja-row-etiqueta brass">{row.etiqueta}</span>
                      {hasMark && (
                        <span className="cargar-hoja-row-mark-text">{row.mark}</span>
                      )}
                    </>
                  ) : hasMark ? (
                    <span className="cargar-hoja-row-mark-text">{row.mark}</span>
                  ) : (
                    <span className="cargar-hoja-placeholder">
                      Tocá para elegir texto
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="cargar-hoja-row-time"
                  onClick={() => startEditRow(row, 'time')}
                  aria-label={`Editar tiempo de la fila ${idx + 1}`}
                >
                  {timeText}
                </button>
                <button
                  type="button"
                  className={`cargar-hoja-row-speed${speedDisplay.isExplicit ? ' brass' : ' cargar-hoja-row-speed--inherited'}`}
                  onClick={() => startEditRow(row, 'speed')}
                  aria-label={`Editar velocidad de la fila ${idx + 1}`}
                >
                  {speedDisplay.text}
                </button>
                <div className="cargar-hoja-row-clear-cell">
                  {hasContent && (
                    <button
                      type="button"
                      className={`cargar-hoja-row-clear${isClearBlocked ? ' cargar-hoja-row-clear--disabled' : ''}`}
                      disabled={isClearBlocked}
                      aria-disabled={isClearBlocked}
                      onClick={() => handleClearRow(row)}
                      aria-label={`Borrar fila ${idx + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón "+ 10 FILAS" como ítem de la lista (se desplaza con las filas) */}
        {canAddMore && (
          <button
            type="button"
            className="btn-secondary btn-full cargar-hoja-add-btn"
            onClick={() => {
              confirmReset.disarm();
              onAddRows();
            }}
          >
            + 10 FILAS
          </button>
        )}

        {/* Botón BORRAR TODO como último ítem de la lista (debajo de "+ 10 FILAS") */}
        <div className="cargar-hoja-borrar-container">
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="visually-hidden"
          >
            {confirmReset.isArmed ? 'Confirmar borrar todo' : ''}
          </span>
          <button
            type="button"
            ref={confirmReset.buttonRef}
            className={`btn-secondary btn-full cargar-hoja-borrar-btn${
              confirmReset.isArmed ? ' cargar-hoja-borrar-btn--armed' : ''
            }${isClearBlocked ? ' btn-secondary--disabled' : ''}`}
            disabled={isClearBlocked}
            aria-disabled={isClearBlocked}
            onClick={confirmReset.handleResetClick}
            aria-label={confirmReset.isArmed ? 'Confirmar borrar todo' : 'Borrar todo'}
          >
            {confirmReset.buttonLabel}
          </button>
          <div
            className="cargar-hoja-blocked-msg"
            role="status"
            aria-live="polite"
          >
            {isClearBlocked ? ROADBOOK_CLEAR_BLOCKED_MESSAGE : '\u00A0'}
          </div>
        </div>
      </div>

      {/* Panel anclado directamente encima de LISTO */}
      <div className="cargar-hoja-pinned-bottom">
        {/* Menú de opciones MARCA / ETIQUETA y campo libre */}
        {editingField === 'mark' && editingRow && (
          <div className="cargar-hoja-section cargar-hoja-marca-panel">
            {/* Selector de pestañas MARCA | ETIQUETA */}
            <div className="cargar-hoja-tabs" role="tablist" aria-label="Opciones de marca y etiqueta">
              <button
                type="button"
                role="tab"
                id="tab-marca"
                aria-controls="panel-marca"
                aria-selected={activeMarcaTab === 'marca'}
                className={`cargar-hoja-tab-btn${activeMarcaTab === 'marca' ? ' active' : ''}`}
                onClick={() => setActiveMarcaTab('marca')}
              >
                MARCA
              </button>
              <button
                type="button"
                role="tab"
                id="tab-etiqueta"
                aria-controls="panel-etiqueta"
                aria-selected={activeMarcaTab === 'etiqueta'}
                className={`cargar-hoja-tab-btn${activeMarcaTab === 'etiqueta' ? ' active' : ''}`}
                onClick={() => setActiveMarcaTab('etiqueta')}
              >
                ETIQUETA
              </button>
            </div>

            {/* Pestaña MARCA */}
            {activeMarcaTab === 'marca' && (
              <div id="panel-marca" role="tabpanel" aria-labelledby="tab-marca" className="cargar-hoja-tab-panel">
                {!isMenuCollapsed && (
                  <MarcaMenu
                    key={`marca-menu-${menuResetKey}`}
                    filterQuery={filterQuery}
                    onSeleccionar={handleMenuSeleccionar}
                  />
                )}
                <div className="cargar-hoja-mark-edit">
                  <input
                    type="text"
                    className="preparar-input cargar-hoja-mark-input"
                    value={markInput}
                    onChange={handleMarkInputChange}
                    placeholder="Texto libre"
                    maxLength={40}
                  />
                </div>
              </div>
            )}

            {/* Pestaña ETIQUETA */}
            {activeMarcaTab === 'etiqueta' && (
              <div id="panel-etiqueta" role="tabpanel" aria-labelledby="tab-etiqueta" className="cargar-hoja-tab-panel">
                <div
                  className="marca-menu etiqueta-menu"
                  role="listbox"
                  aria-label="Etiquetas oficiales de carrera"
                >
                  {/* Opción SIN ETIQUETA */}
                  {(() => {
                    const isSinEtiquetaSelected = !editingRow.etiqueta || editingRow.etiqueta === 'none';
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSinEtiquetaSelected}
                        aria-checked={isSinEtiquetaSelected}
                        className={`marca-menu-item etiqueta-menu-item${isSinEtiquetaSelected ? ' etiqueta-menu-item--selected' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onUpdateRow(editingRow.id, { etiqueta: 'none' })}
                        aria-label={isSinEtiquetaSelected ? 'SIN ETIQUETA, seleccionado' : 'SIN ETIQUETA'}
                      >
                        {isSinEtiquetaSelected && <span className="etiqueta-check">✓ </span>}
                        SIN ETIQUETA
                      </button>
                    );
                  })()}

                  {/* 11 opciones oficiales */}
                  {ETIQUETAS_VALIDAS.map((etiqueta) => {
                    const isSelected = editingRow.etiqueta === etiqueta;
                    return (
                      <button
                        key={etiqueta}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-checked={isSelected}
                        className={`marca-menu-item etiqueta-menu-item etiqueta-menu-item--oficial${isSelected ? ' etiqueta-menu-item--selected' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onUpdateRow(editingRow.id, { etiqueta })}
                        aria-label={isSelected ? `${etiqueta}, seleccionado` : etiqueta}
                      >
                        {isSelected && <span className="etiqueta-check">✓ </span>}
                        {etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teclado de tiempo: visible sólo cuando editingField === 'time' */}
        {editingField === 'time' && editingRow && (
          <div className="cargar-hoja-section">
            <span className="preparar-field-label">TIEMPO (H:MM:SS)</span>
            <div className="cargar-hoja-time-display">
              {(() => {
                const parsed = parseTimeDigits(timeDigits);
                return parsed.valid && parsed.totalSeconds !== null
                  ? parsed.formatted
                  : EMPTY_TIME_PLACEHOLDER;
              })()}
            </div>
            <div className="cargar-hoja-numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`cargar-hoja-numpad-key${key === 'OK' ? ' btn-primary' : ' btn-secondary'}`}
                  onClick={() => {
                    if (key === '⌫') {
                      handleTimeBackspace();
                    } else if (key === 'OK') {
                      commitTimeEdit();
                    } else {
                      handleTimeDigit(key);
                    }
                  }}
                  aria-label={key === '⌫' ? 'Borrar dígito' : key === 'OK' ? 'Confirmar' : key}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entrada de velocidad: visible sólo cuando editingField === 'speed' */}
        {editingField === 'speed' && editingRow && (
          <div className="cargar-hoja-section">
            <span className="preparar-field-label">
              VELOCIDAD (KM/H) — dejar vacío para heredar
            </span>
            <div className="cargar-hoja-mark-edit">
              <input
                type="text"
                inputMode="decimal"
                className="preparar-input cargar-hoja-mark-input"
                value={speedInput}
                onChange={handleSpeedInputChange}
                placeholder="--"
              />
              <span className="preparar-unit label-lg brass">KM/H</span>
            </div>
          </div>
        )}

        {/* Botón LISTO anclado al fondo */}
        <button
          type="button"
          className="btn-primary btn-full cargar-hoja-listo-btn"
          onClick={handleListo}
        >
          LISTO
        </button>
      </div>
    </div>
  );
}
