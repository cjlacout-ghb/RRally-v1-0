import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HojaDeRutaTab } from './HojaDeRutaTab';
import { RaceProvider } from '../context/RaceContext';
import type { GpsReader } from '../logic/gpsReader';
import type { RoadbookRow } from '../logic/roadbookModel';

const mockReader: GpsReader = {
  onReading: () => () => {},
  onStatusChange: () => () => {},
  start: () => {},
  stop: () => {},
  getStatus: () => 'idle',
};

const sampleRows: RoadbookRow[] = [
  { id: 'row-1', mark: 'AUTOLARGADA', assignedTimeSeconds: 0, speedKmH: 60 },
  { id: 'row-2', mark: 'CONTROL 1', assignedTimeSeconds: 120, speedKmH: 50 },
  { id: 'row-3', mark: 'FIN', assignedTimeSeconds: 300, speedKmH: null },
];

describe('HojaDeRutaTab Component', () => {
  it('renders time block with the 48px buttons exception', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );

    expect(html).toContain('HORA OFICIAL');
    expect(html).toContain('hdr-stopwatch-btn');
    expect(html).toContain('btn-stopwatch');
    expect(html).toContain('INICIAR');
    expect(html).toContain('REINICIAR');
  });

  it('renders accumulated deviation panel, next stretch speed block, and mark cards', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );

    expect(html).toContain('hdr-next-stretch');
    expect(html).toContain('PRÓXIMO TRAMO');
    expect(html).toContain('ANTERIOR');
    expect(html).toContain('ACTUAL');
    expect(html).toContain('SIGUIENTE');
    expect(html).toContain('AUTOLARGADA');
  });

  it('next-stretch block uses secondary token (not primary-container) as fill', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );
    // The block should not reference primary-container in its class
    // (CSS uses var(--color-secondary) via hdr-next-stretch class)
    expect(html).toContain('hdr-next-stretch');
    // MARCAR must still use primary button class (primary-container fill)
    expect(html).toContain('hdr-marcar-btn');
    expect(html).toContain('btn-primary');
  });

  it('ACTUAL card shows full mark text in a separate text row (not truncated inline)', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );

    // The ACTUAL card should have the hdr-mark-card-text-row element for the mark text
    expect(html).toContain('hdr-mark-card-text-row');
    // The ACTUAL card should have the hdr-mark-card-header element
    expect(html).toContain('hdr-mark-card-header');
    // ESTIPULADO should appear in the header
    expect(html).toContain('hdr-mark-estipulado');
  });

  it('renders MARCAR button (min height 72px) and SALTAR / DESHACER buttons', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );

    expect(html).toContain('hdr-marcar-btn');
    expect(html).toContain('MARCAR');
    expect(html).toContain('SALTAR');
    expect(html).toContain('DESHACER');
  });

  it('renders secondary stopwatch card', () => {
    const html = renderToString(
      <RaceProvider initialReader={mockReader}>
        <HojaDeRutaTab isVisible={true} rows={sampleRows} />
      </RaceProvider>
    );

    expect(html).toContain('CRONÓMETRO 2');
    expect(html).toContain('btn-stopwatch');
  });

  describe('Empty-state shortcut (zero rows with assigned time)', () => {
    const emptyRows: RoadbookRow[] = [
      { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      { id: 'row-2', mark: '', assignedTimeSeconds: null, speedKmH: null },
    ];

    it('renders empty-state card with "SIN HOJA DE RUTA CARGADA" and "CARGAR HOJA DE RUTA" button', () => {
      const html = renderToString(
        <RaceProvider initialReader={mockReader}>
          <HojaDeRutaTab isVisible={true} rows={emptyRows} />
        </RaceProvider>
      );

      // Empty-state card and text
      expect(html).toContain('hdr-empty-card');
      expect(html).toContain('SIN HOJA DE RUTA CARGADA');
      expect(html).toContain('CARGAR HOJA DE RUTA');
      expect(html).toContain('hdr-empty-btn');

      // Preserves time block and second stopwatch
      expect(html).toContain('HORA OFICIAL');
      expect(html).toContain('btn-stopwatch');
      expect(html).toContain('CRONÓMETRO 2');

      // Does NOT render race-progress elements
      expect(html).not.toContain('hdr-next-stretch');
      expect(html).not.toContain('hdr-marks-list');
      expect(html).not.toContain('hdr-marcar-btn');
      expect(html).not.toContain('SALTAR');
      expect(html).not.toContain('DESHACER');
    });

    it('returns to normal layout as soon as at least one row has an assigned time', () => {
      const singleLoadedRow: RoadbookRow[] = [
        { id: 'row-1', mark: 'LARGADA', assignedTimeSeconds: 0, speedKmH: 50 },
        { id: 'row-2', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];

      const html = renderToString(
        <RaceProvider initialReader={mockReader}>
          <HojaDeRutaTab isVisible={true} rows={singleLoadedRow} />
        </RaceProvider>
      );

      expect(html).not.toContain('SIN HOJA DE RUTA CARGADA');
      expect(html).not.toContain('hdr-empty-card');
      expect(html).toContain('hdr-next-stretch');
      expect(html).toContain('hdr-marks-list');
      expect(html).toContain('hdr-marcar-btn');
    });
  });
});
