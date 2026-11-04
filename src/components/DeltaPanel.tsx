import { type DeltaState, DELTA_LABELS } from '../logic/delta';
import { formatDelta, formatDeltaAria, formatSpeed } from '../logic/format';
import './DeltaPanel.css';

interface DeltaPanelProps {
  deltaSeconds: number | null;
  state: DeltaState;
  assignedSpeed?: number | null;
}

const STATE_CLASS: Record<DeltaState, string> = {
  ahead: 'delta-panel--ahead',
  behind: 'delta-panel--behind',
  neutral: 'delta-panel--neutral',
  'no-data': 'delta-panel--no-data',
};

export function DeltaPanel({ deltaSeconds, state, assignedSpeed }: DeltaPanelProps) {
  const { value: displayValue, unit } = formatDelta(state === 'no-data' ? null : deltaSeconds);
  const label = DELTA_LABELS[state];
  const assignedSpeedText = formatSpeed(assignedSpeed);
  const ariaLabel = formatDeltaAria(deltaSeconds, state);

  // Content-driven class: strings longer than 5 chars (e.g. "-1:05,9", "-12:05,9", "-123,4") scale fluidly;
  // standard strings up to 5 chars (e.g. "+12,3", "-59,9", "0,0", "--,-") use nominal display size.
  const isLong = displayValue.length > 5;

  return (
    <div
      className={`delta-panel ${STATE_CLASS[state]}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className={`delta-panel__value-row ${isLong ? 'delta-panel__value-row--long' : ''}`}>
        <b className="delta-panel__seconds delta-panel__value">{displayValue}</b>
        <span className="delta-panel__unit">{unit}</span>
      </div>
      <div className="delta-panel__label">{label}</div>
      <div className="delta-panel__assigned-strip">
        <span className="delta-panel__assigned-label">ASIGNADO</span>
        <span className="delta-panel__assigned-speed">{assignedSpeedText}</span>
        <span className="delta-panel__assigned-unit">KM/H</span>
      </div>
    </div>
  );
}
