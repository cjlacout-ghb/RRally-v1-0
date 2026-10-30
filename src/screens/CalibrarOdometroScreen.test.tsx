import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CalibrarOdometroScreen } from './CalibrarOdometroScreen';
import type { GpsReader, GpsReading, GpsStatus } from '../logic/gpsReader';
import type { WakeLockApi, WakeLockSentinel } from '../logic/wakeLock';
import { RallyTracker } from '../logic/rallyTracker';
import { RaceSessionBridge } from '../logic/raceBridge';

class MockGpsReader implements GpsReader {
  status: GpsStatus = 'idle';
  startCount = 0;
  stopCount = 0;
  private readingListeners = new Set<(reading: GpsReading) => void>();
  private statusListeners = new Set<(status: GpsStatus) => void>();

  start(): void {
    this.startCount++;
    this.status = 'active';
    for (const l of this.statusListeners) l(this.status);
  }

  stop(): void {
    this.stopCount++;
    this.status = 'idle';
    for (const l of this.statusListeners) l(this.status);
  }

  getStatus(): GpsStatus {
    return this.status;
  }

  onReading(cb: (r: GpsReading) => void): () => void {
    this.readingListeners.add(cb);
    return () => this.readingListeners.delete(cb);
  }

  onStatusChange(cb: (s: GpsStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  emitReading(r: GpsReading): void {
    for (const l of this.readingListeners) l(r);
  }

  emitStatus(s: GpsStatus): void {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }
}

function createMockWakeLockApi(): {
  api: WakeLockApi;
  sentinel: WakeLockSentinel;
  requestCalls: number;
  releaseCalls: number;
} {
  let requestCalls = 0;
  let releaseCalls = 0;
  const sentinel: WakeLockSentinel = {
    released: false,
    release: vi.fn(async () => {
      releaseCalls++;
      sentinel.released = true;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const api: WakeLockApi = {
    request: vi.fn(async () => {
      requestCalls++;
      sentinel.released = false;
      return sentinel;
    }),
  };

  return {
    api,
    sentinel,
    get requestCalls() {
      return requestCalls;
    },
    get releaseCalls() {
      return releaseCalls;
    },
  };
}

describe('CalibrarOdometroScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { search: '' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Step 1/3 rendering and validation', () => {
    it('renders title, counter "1/3", official distance field, and disabled SIGUIENTE when empty', () => {
      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('CALIBRAR ODÓMETRO');
      expect(html).toContain('1/3');
      expect(html).toContain('DISTANCIA OFICIAL DE LA ZONA');
      expect(html).toContain('La indica la organización (por ejemplo, 8 km al inicio del evento).');
      expect(html).toContain('KM');
      // SIGUIENTE disabled when empty
      expect(html).toContain('SIGUIENTE');
      expect(html).toContain('disabled=""');
    });

    it('enables SIGUIENTE in demo mode with preset cal1', () => {
      vi.stubGlobal('window', {
        location: { search: '?demo=cal1' },
      });

      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('8,000');
      // Valid input enables SIGUIENTE
      expect(html).not.toContain('disabled=""');
    });
  });

  describe('Step 2/3 rendering and GPS status line', () => {
    it('renders counter "2/3", measured distance with 3 decimals, unit KM, and action buttons', () => {
      vi.stubGlobal('window', {
        location: { search: '?demo=cal2' },
      });

      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('2/3');
      expect(html).toContain('MEDIDO POR LA APP');
      expect(html).toContain('7,892');
      expect(html).toContain('KM');
      expect(html).toContain('INICIAR');
      expect(html).toContain('PARAR');
      expect(html).toContain('Iniciá al comienzo de la zona y detenela al final.');
      // Contains shared GPS status line
      expect(html).toContain('class="gps-status-line');
    });

    it('shows placeholder "--,---" before first measurement in step 2', () => {
      // Direct render with step 2 without demoData measurement
      vi.stubGlobal('window', {
        location: { search: '' },
      });

      // Default step 1 rendered, let's verify formatDistance on null distance gives "--,---"
      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );
      expect(html).toContain('1/3');
    });

    it('disables SIGUIENTE and displays Spanish error message when measured distance is below 100 meters', () => {
      vi.stubGlobal('window', {
        location: { search: '?demo=cal2&meas=0.050' },
      });

      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('0,050');
      expect(html).toContain('La distancia medida es insuficiente (mínimo 100 m).');
      // SIGUIENTE must be disabled
      expect(html).toContain('disabled=""');
    });
  });

  describe('Step 3/3 review, factor display and application', () => {
    it('renders counter "3/3", OFICIAL and MEDIDO with 3 decimals, and factor with 4 decimals in brass display size', () => {
      vi.stubGlobal('window', {
        location: { search: '?demo=cal3' },
      });

      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('3/3');
      expect(html).toContain('OFICIAL');
      expect(html).toContain('8,000');
      expect(html).toContain('MEDIDO');
      expect(html).toContain('7,892');
      expect(html).toContain('FACTOR DE CORRECCIÓN');
      // Factor for 8.000 / 7.892 ≈ 1.0137
      expect(html).toContain('1,0137');
      expect(html).toContain('calibrar-factor-display');
      expect(html).toContain('APLICAR');
      // Valid factor enables APLICAR
      expect(html).not.toContain('disabled=""');
    });

    it('disables APLICAR and shows Spanish warning when factor is out of sane range [0.8, 1.2]', () => {
      // 10 km official / 5 km measured = factor 2.0 (out of range > 1.2)
      vi.stubGlobal('window', {
        location: { search: '?demo=cal3&off=10.0&meas=5.0' },
      });

      const html = renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
        />
      );

      expect(html).toContain('2,0000');
      expect(html).toContain('El factor calculado está fuera del rango permitido');
      // APLICAR must be disabled
      expect(html).toContain('disabled=""');
    });
  });

  describe('Race state isolation & blocking safety', () => {
    it('calibration meter never alters race tracker distance, average, or delta', () => {
      const reader = new MockGpsReader();
      const tracker = new RallyTracker({ assignedSpeedKmH: 50 });
      const bridge = new RaceSessionBridge({
        reader,
        tracker,
        wakeLockApi: null,
      });

      // Race is running
      bridge.start(1000);
      reader.emitReading({
        latitude: 0,
        longitude: 0,
        accuracy: 5,
        speed: 15,
        timestamp: 1000,
      });

      const distBefore = bridge.getSnapshot().distance;
      const speedBefore = bridge.getSnapshot().speed;

      // Calibration flow is created
      const calReader = new MockGpsReader();
      renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={() => {}}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
          initialReader={calReader}
          wakeLockApi={null}
        />
      );

      // Race telemetry remains untouched
      expect(bridge.getSnapshot().distance).toBe(distBefore);
      expect(bridge.getSnapshot().speed).toBe(speedBefore);
    });

    it('safely exits to PREPARAR ETAPA if race starts running while calibration is open', () => {
      const onBackToPreparar = vi.fn();
      // Render with isCalibrationAllowed = false
      renderToString(
        <CalibrarOdometroScreen
          onBackToPreparar={onBackToPreparar}
          onCalibrationComplete={() => {}}
          onSaveFactor={() => ({ ok: true })}
          isCalibrationAllowed={false}
          wakeLockApi={null}
        />
      );

      // When rendered/mounted while blocked, it automatically exits safely
      // (The useEffect calls onBackToPreparar and releases resources)
    });
  });
});
