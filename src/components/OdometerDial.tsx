import { getDialTicks, getDialMarker, DIAL_VIEWBOX_SIZE, DIAL_CENTER, DIAL_OUTER_RADIUS } from '../logic/dial';
import { formatSpeed, formatDistance } from '../logic/format';
import type { GpsStatusKind } from '../logic/gpsStatus';
import { GpsStatusLine } from './GpsStatusLine';
import './OdometerDial.css';

interface OdometerDialProps {
  speed: number | null;
  averageSpeed: number | null;
  distance: number | null;
  gpsStatusText?: string;
  gpsStatusKind?: GpsStatusKind;
  onAdjust?: (delta: -1 | 1) => void;
}

const TICKS = getDialTicks();
const VB = DIAL_VIEWBOX_SIZE;

// Faint decorative rings (only ornaments allowed per DESIGN.md exception)
// Outer faint ring: 1px outline-variant, just outside the dial face
const OUTER_RING_R = DIAL_OUTER_RADIUS + 4;
// Inner dotted guide ring: just inside the tick outer radius (DIAL_TICK_OUTER_RADIUS = 84)
const INNER_GUIDE_R = 79;

// ── Center text geometry (viewbox units — scales with the dial automatically) ──
// Safe inner zone: the 40/80 numerals sit at DIAL_NUMERAL_RADIUS (54) from center
// at ±45°, giving (x=49.8, y=49.8) and (x=126.2, y=49.8).
// The 0/120 numerals sit at ±135°, giving (x=49.8, y=126.2) and (x=126.2, y=126.2).
// In the vertical middle (y=88), the horizontal width between ticks is unobstructed
// up to the inner ring (r=79), but keeping generous clearance (>12 vu at all points).
// Speed digits centered vertically at dial center (y=88).
// With font-size 26 vu, Space Mono cap-height ≈ 18 vu; baseline at y=91 places vertical center at y≈82.
// "119,9" (5 chars) width ≈ 5 * 0.6 * 26 * 0.97 ≈ 75 vu (±37.5 from center, roughly half the 176 diameter).
// Left edge is at x ≈ 50.5 at y=73..91, while "40" numeral is at y=50, x=49.8.
// Clearance between (50.5, 73) and (49.8, 54) is sqrt(0.7^2 + 19^2) ≈ 19 vu (> 6px at any screen size).
// KM/H label: font-size 11 vu, baseline at y=107 (below speed digits).
// Top of KM/H is y=99, bottom is y=109. Distance to 0/120 numeral at (49.8, 126.2) is > 20 vu.
const SPEED_FONT_SIZE = 26; // viewbox units — single source of truth for speed digit size
const UNIT_FONT_SIZE = 11;  // viewbox units — single source of truth for KM/H label size
const SPEED_Y = 91;
const UNIT_Y = 107;

export function OdometerDial({ speed, averageSpeed, distance, gpsStatusText = '', gpsStatusKind = 'empty', onAdjust }: OdometerDialProps) {
  const marker = getDialMarker(speed);

  const speedText = formatSpeed(speed);
  const avgText = averageSpeed !== null ? formatSpeed(averageSpeed) : '--,-';
  const distText = formatDistance(distance, 2);

  return (
    <div className="odometer-block odometer-block--no-border">
      {/* ── Dial row: [-1] [dial] [+1] ─────────────────────── */}
      <div className="dial-row">
        {/* -1 button */}
        <button
          type="button"
          className="btn-adjust"
          aria-label="Restar 10 metros"
          onClick={() => onAdjust?.(-1)}
        >
          -1
        </button>

        {/* Dial */}
        <div className="dial-wrapper">
          <svg
            viewBox={`0 0 ${VB} ${VB}`}
            className="dial-svg"
            aria-hidden="true"
          >
            {/* Faint outer ring — exception to no-ornament rule per DESIGN.md */}
            <circle
              cx={DIAL_CENTER}
              cy={DIAL_CENTER}
              r={OUTER_RING_R}
              fill="none"
              stroke="var(--color-outline-variant)"
              strokeWidth="1"
              opacity="0.5"
            />

            {/* Dial face */}
            <circle
              cx={DIAL_CENTER}
              cy={DIAL_CENTER}
              r={DIAL_OUTER_RADIUS}
              fill="var(--color-surface-container-lowest)"
              stroke="var(--color-outline-variant)"
              strokeWidth="1"
            />

            {/* Dotted inner guide ring — exception to no-ornament rule per DESIGN.md */}
            <circle
              cx={DIAL_CENTER}
              cy={DIAL_CENTER}
              r={INNER_GUIDE_R}
              fill="none"
              stroke="var(--color-outline-variant)"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.5"
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

            {/* ── Center text: speed digits + KM/H, sized in viewbox units ── */}
            {/* Both elements scale proportionally with the dial at all sizes.  */}
            <text
              x={DIAL_CENTER}
              y={SPEED_Y}
              textAnchor="middle"
              className="dial-center-speed"
              fontSize={SPEED_FONT_SIZE}
            >
              {speedText}
            </text>
            <text
              x={DIAL_CENTER}
              y={UNIT_Y}
              textAnchor="middle"
              className="dial-center-unit"
              fontSize={UNIT_FONT_SIZE}
            >
              KM/H
            </text>
          </svg>
        </div>

        {/* +1 button */}
        <button
          type="button"
          className="btn-adjust"
          aria-label="Sumar 10 metros"
          onClick={() => onAdjust?.(1)}
        >
          +1
        </button>
      </div>

      {/* ── GPS status line: directly under dial, above readouts ── */}
      <GpsStatusLine statusText={gpsStatusText} statusKind={gpsStatusKind} />

      {/* Average + Distance readouts sit directly below the dial row */}
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
      </div>
    </div>
  );
}
