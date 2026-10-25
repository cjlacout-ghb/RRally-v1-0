import { getDialTicks, getDialMarker, DIAL_VIEWBOX_SIZE, DIAL_CENTER, DIAL_OUTER_RADIUS } from '../logic/dial';
import { formatSpeed } from '../logic/format';
import './OdometerDial.css';

interface OdometerDialProps {
  speed: number | null;
  averageSpeed: number | null;
  distance: number | null;
  onAdjust?: (delta: -1 | 1) => void;
}

const TICKS = getDialTicks();
const DIAL_SIZE = 168;
const VB = DIAL_VIEWBOX_SIZE;

export function OdometerDial({ speed, averageSpeed, distance, onAdjust }: OdometerDialProps) {
  const marker = getDialMarker(speed);

  const speedText = formatSpeed(speed);
  const avgText = averageSpeed !== null ? formatSpeed(averageSpeed) : '--,-';
  const distText = distance !== null ? distance.toFixed(3).replace('.', ',') : '--,---';

  return (
    <div className="odometer-block card">
      <div className="dial-wrapper">
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          width={DIAL_SIZE}
          height={DIAL_SIZE}
          aria-hidden="true"
          className="dial-svg"
        >
          {/* Face */}
          <circle
            cx={DIAL_CENTER}
            cy={DIAL_CENTER}
            r={DIAL_OUTER_RADIUS}
            fill="var(--color-surface-container-lowest)"
            stroke="var(--color-outline)"
            strokeWidth="1"
          />

          {/* Tick marks */}
          {TICKS.map(tick => (
            <g key={tick.speed}>
              <line
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke="var(--color-secondary)"
                strokeWidth={tick.isMajor ? 3 : 1.5}
              />
              {tick.numeral && (
                <text
                  x={tick.numeral.x}
                  y={tick.numeral.y}
                  textAnchor="middle"
                  className="dial-numeral"
                >
                  {tick.numeral.label}
                </text>
              )}
            </g>
          ))}

          {/* Speed marker */}
          {marker && (
            <line
              x1={marker.x1}
              y1={marker.y1}
              x2={marker.x2}
              y2={marker.y2}
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Center readout */}
        <div className="dial-center">
          <span className="dial-speed">{speedText}</span>
          <span className="dial-unit label-lg brass">KM/H</span>
        </div>
      </div>

      {/* Average + Distance readouts */}
      <div className="readouts-grid">
        <div className="readout-cell">
          <span className="label-md on-surface-variant">PROMEDIO</span>
          <div className="readout-value">
            <span className="headline-lg brass">{avgText}</span>
            <span className="label-md on-surface-variant"> KM/H</span>
          </div>
        </div>
        <div className="readout-cell">
          <span className="label-md on-surface-variant">DISTANCIA</span>
          <div className="readout-value">
            <span className="headline-lg brass">{distText}</span>
            <span className="label-md on-surface-variant"> KM</span>
          </div>
        </div>

        {/* -1 / +1 adjust buttons – rendered but no-op until Phase 2 */}
        <div>{/* empty left cell to align buttons right */}</div>
        <div className="adjust-buttons">
          <button
            type="button"
            className="btn-primary btn-round"
            aria-label="Restar 10 metros"
            onClick={() => onAdjust?.(-1)}
          >
            -1
          </button>
          <button
            type="button"
            className="btn-primary btn-round"
            aria-label="Sumar 10 metros"
            onClick={() => onAdjust?.(1)}
          >
            +1
          </button>
        </div>
      </div>
    </div>
  );
}
