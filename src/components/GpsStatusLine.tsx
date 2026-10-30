import type { GpsStatusKind } from '../logic/gpsStatus';
import './GpsStatusLine.css';

export interface GpsStatusLineProps {
  statusText?: string;
  statusKind?: GpsStatusKind;
  className?: string;
}

export function GpsStatusLine({
  statusText = '',
  statusKind = 'empty',
  className = '',
}: GpsStatusLineProps) {
  return (
    <div
      className={`gps-status-line gps-status-line--${statusKind} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {statusText || '\u00A0'}
    </div>
  );
}
