import { useState, useRef, useEffect } from 'react';
import {
  QUICK_TEXTS,
  MAX_SHEET_ROWS,
  formatRoadbookCounter,
  getRowDisplaySpeed,
  type RoadbookRow,
} from '../logic/roadbookModel';
import {
  parseTimeDigits,
  EMPTY_TIME_PLACEHOLDER,
  formatTimeHms,
} from '../logic/roadbookTime';
import './CargarHojaScreen.css';

interface CargarHojaScreenProps {
  rows: RoadbookRow[];
  onAddRows: () => void;
  onUpdateRow: (
    rowId: string,
    changes: Partial<Pick<RoadbookRow, 'mark' | 'assignedTimeSeconds' | 'speedKmH'>>
  ) => void;
  onBack: () => void;
  /** Testing escape-hatch for initial edit state */
  initialEditingRowId?: string | null;
  initialEditingField?: 'mark' | 'time' | 'speed' | null;
}

export function CargarHojaScreen({
  rows,
  onAddRows,
  onUpdateRow,
  onBack,
  initialEditingRowId = null,
  initialEditingField = null,
}: CargarHojaScreenProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(initialEditingRowId);
  const [editingField, setEditingField] = useState<'mark' | 'time' | 'speed' | null>(initialEditingField);
  const [timeDigits, setTimeDigits] = useState<string>('');
  const [speedInput, setSpeedInput] = useState<string>('');
  const [markInput, setMarkInput] = useState<string>(() => {
    if (initialEditingRowId) {
      const found = rows.find((r) => r.id === initialEditingRowId);
      return found ? found.mark : '';
    }
    return '';
  });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const canAddMore = rows.length < MAX_SHEET_ROWS;

  function startEditRow(row: RoadbookRow, field: 'mark' | 'time' | 'speed') {
    setEditingRowId(row.id);
    setEditingField(field);

    if (field === 'mark') {
      setMarkInput(row.mark);
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

  function handleQuickText(text: string) {
    if (!editingRowId) return;
    setMarkInput(text);
    onUpdateRow(editingRowId, { mark: text });
    // Edited row stays selected and quick-text panel stays visible.
  }

  function handleMarkInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setMarkInput(value);
    if (editingRowId) {
      onUpdateRow(editingRowId, { mark: value });
    }
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

      {/* Scrollable list area */}
      <div className="cargar-hoja-scroll-area" ref={scrollContainerRef}>
        {/* Column header */}
        <div className="cargar-hoja-col-header">
          <span className="cargar-hoja-col-num">N°</span>
          <span className="cargar-hoja-col-mark">MARCA</span>
          <span className="cargar-hoja-col-time">TIEMPO</span>
          <span className="cargar-hoja-col-speed">KM/H</span>
        </div>

        {/* Rows */}
        <div className="cargar-hoja-rows">
          {rows.map((row, idx) => {
            const isEditing = row.id === editingRowId;
            const timeText =
              row.assignedTimeSeconds !== null
                ? formatTimeHms(row.assignedTimeSeconds)
                : EMPTY_TIME_PLACEHOLDER;
            const speedDisplay = getRowDisplaySpeed(rows, idx);

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
                  aria-label={`Editar marca de la fila ${idx + 1}`}
                >
                  {row.mark || (
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
              </div>
            );
          })}
        </div>

        {/* "+ 10 FILAS" button as the last item of the list (scrolls with rows) */}
        {canAddMore && (
          <button
            type="button"
            className="btn-secondary btn-full cargar-hoja-add-btn"
            onClick={onAddRows}
          >
            + 10 FILAS
          </button>
        )}
      </div>

      {/* Pinned bottom panel directly above LISTO */}
      <div className="cargar-hoja-pinned-bottom">
        {/* Quick texts panel: visible only when editingField === 'mark' */}
        {editingField === 'mark' && editingRow && (
          <div className="cargar-hoja-section cargar-hoja-quicktexts-panel">
            <span className="preparar-field-label">TEXTOS RÁPIDOS</span>
            <div className="cargar-hoja-quicktexts">
              {QUICK_TEXTS.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  className="btn-secondary cargar-hoja-qt-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleQuickText(qt)}
                >
                  {qt}
                </button>
              ))}
            </div>
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

        {/* Time keypad: visible only when editingField === 'time' */}
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

        {/* Speed entry: visible only when editingField === 'speed' */}
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

        {/* LISTO button stays pinned at the very bottom */}
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
