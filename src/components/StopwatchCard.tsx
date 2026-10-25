import './StopwatchCard.css';

interface StopwatchCardProps {
  /** Display value already formatted (e.g. "18:42,34") */
  displayTime: string;
  isRunning: boolean;
  onStartStop: () => void;
  onReset: () => void;
  /** 'main' uses headline-xl (40px), 'secondary' uses headline-lg (26px) */
  variant?: 'main' | 'secondary';
  label?: string;
}

export function StopwatchCard({
  displayTime,
  isRunning,
  onStartStop,
  onReset,
  variant = 'main',
  label,
}: StopwatchCardProps) {
  return (
    <div className={`stopwatch-card card stopwatch-card--${variant}`}>
      {label && (
        <span className="label-md on-surface-variant stopwatch-card__label">{label}</span>
      )}
      <div className={`stopwatch-card__time stopwatch-time--${variant}`}>{displayTime}</div>
      <div className="stopwatch-card__buttons btn-row">
        <button
          type="button"
          className="btn-primary stopwatch-btn"
          onClick={onStartStop}
        >
          {isRunning ? 'PARAR' : 'INICIAR'}
        </button>
        <button
          type="button"
          className="btn-primary stopwatch-btn"
          onClick={onReset}
        >
          REINICIAR
        </button>
      </div>
    </div>
  );
}
