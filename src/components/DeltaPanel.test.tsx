import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DeltaPanel } from './DeltaPanel';

describe('DeltaPanel Component', () => {
  it('renders seconds with SEG unit below 60,0 s and no long class', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={52.9} state="ahead" assignedSpeed={50} />
    );

    expect(html).toContain('+52,9');
    expect(html).toContain('SEG');
    expect(html).toContain('ADELANTADO');
    expect(html).toContain('delta-panel--ahead');
    expect(html).not.toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="52,9 segundos adelantado"');
  });

  it('renders 0,0 with SEG unit and no sign', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={0.0} state="neutral" assignedSpeed={50} />
    );

    expect(html).toContain('0,0');
    expect(html).toContain('SEG');
    expect(html).toContain('EN TIEMPO');
    expect(html).toContain('delta-panel--neutral');
    expect(html).not.toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="0,0 segundos en tiempo"');
  });

  it('renders minutes with MIN unit for 60,0 s or more', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={60.0} state="ahead" assignedSpeed={50} />
    );

    expect(html).toContain('+1:00,0');
    expect(html).toContain('MIN');
    expect(html).toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="1 minuto 0,0 segundos adelantado"');
  });

  it('rounds 59,96 s to +1:00,0 MIN, never 60,0 SEG', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={59.96} state="ahead" assignedSpeed={50} />
    );

    expect(html).toContain('+1:00,0');
    expect(html).toContain('MIN');
    expect(html).not.toContain('60,0');
    expect(html).not.toContain('SEG');
    expect(html).toContain('delta-panel__value-row--long');
  });

  it('renders 65,9 s behind as -1:05,9 MIN with fluid long class and natural Spanish aria-label', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={-65.9} state="behind" assignedSpeed={50} />
    );

    expect(html).toContain('-1:05,9');
    expect(html).toContain('MIN');
    expect(html).toContain('ATRASADO');
    expect(html).toContain('delta-panel--behind');
    expect(html).toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="1 minuto 5,9 segundos atrasado"');
  });

  it('renders 125,4 s behind as -2:05,4 MIN', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={-125.4} state="behind" assignedSpeed={50} />
    );

    expect(html).toContain('-2:05,4');
    expect(html).toContain('MIN');
    expect(html).toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="2 minutos 5,4 segundos atrasado"');
  });

  it('renders no-data state with --,- and SEG and SIN DATOS label', () => {
    const html = renderToString(
      <DeltaPanel deltaSeconds={null} state="no-data" assignedSpeed={null} />
    );

    expect(html).toContain('--,-');
    expect(html).toContain('SEG');
    expect(html).toContain('SIN DATOS');
    expect(html).toContain('delta-panel--no-data');
    expect(html).not.toContain('delta-panel__value-row--long');
    expect(html).toContain('aria-label="Sin datos"');
  });
});
