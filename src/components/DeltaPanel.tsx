import { type DeltaState, DELTA_LABELS } from '../logic/delta';
import { formatDelta, formatSpeed } from '../logic/format';
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
  const displayValue = state === 'no-data' ? '--,-' : formatDelta(deltaSeconds);
  const label = DELTA_LABELS[state];
  const assignedSpeedText = formatSpeed(assignedSpeed);

  return (
    <div className={`delta-panel ${STATE_CLASS[state]}`} role="status" aria-live="polite">
      <div className="delta-panel__value-row">
        <b className="delta-panel__seconds">{displayValue}</b>
        <span className="delta-panel__unit">SEG</span>
      </div>
      <div className="delta-panel__label">{label}</div>
      <div className="delta-panel__assigned">
        <span className="delta-panel__assigned-text">
          ASIGNADO {assignedSpeedText} KM/H
        </span>
      </div>
    </div>
  );
}
