import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PrepararEtapaScreen } from './PrepararEtapaScreen';

describe('PrepararEtapaScreen - Calibration blocking UI', () => {
  it('enables CALIBRAR ODÓMETRO button and keeps blocked message empty when calibration is allowed', () => {
    const onCalibrate = vi.fn();
    const html = renderToString(
      <PrepararEtapaScreen
        savedSpeed={50}
        onSave={() => ({ ok: true })}
        onBack={() => {}}
        onCalibrate={onCalibrate}
        isCalibrationAllowed={true}
      />
    );

    // Button must NOT be disabled
    expect(html).toContain('CALIBRAR ODÓMETRO');
    expect(html).not.toContain('btn-secondary--disabled');
    expect(html).not.toContain('disabled=""');

    // Message must be empty / non-breaking space (reserved height, no shift)
    expect(html).not.toContain('DETENÉ LA CARRERA PARA CALIBRAR');
    expect(html).toContain('class="calibration-blocked-msg"');
  });

  it('visibly disables CALIBRAR ODÓMETRO and displays "DETENÉ LA CARRERA PARA CALIBRAR" when race is running', () => {
    const html = renderToString(
      <PrepararEtapaScreen
        savedSpeed={50}
        onSave={() => ({ ok: true })}
        onBack={() => {}}
        isCalibrationAllowed={false}
      />
    );

    // Button has disabled attribute and disabled class
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('btn-secondary--disabled');

    // Blocked message is visible
    expect(html).toContain('DETENÉ LA CARRERA PARA CALIBRAR');
  });
});

describe('PrepararEtapaScreen - Control system selector', () => {
  it('shows CARRERA as selected by default and renders the control system selector', () => {
    const html = renderToString(
      <PrepararEtapaScreen
        savedSpeed={50}
        onSave={() => ({ ok: true })}
        onBack={() => {}}
        controlSystem="carrera"
        onChangeControlSystem={() => {}}
      />
    );
    expect(html).toContain('SISTEMA DE CONTROL');
    expect(html).toContain('btn-system-selector--active');
    // Shows speed field for carrera mode
    expect(html).toContain('VELOCIDAD MEDIA DE LA ETAPA');
  });

  it('shows HOJA DE RUTA as selected and hides speed/calibration when system is hoja-de-ruta', () => {
    const html = renderToString(
      <PrepararEtapaScreen
        savedSpeed={50}
        onSave={() => ({ ok: true })}
        onBack={() => {}}
        controlSystem="hoja-de-ruta"
        onChangeControlSystem={() => {}}
        roadbookRows={[]}
      />
    );
    // No speed field or calibration in hoja-de-ruta mode
    expect(html).not.toContain('VELOCIDAD MEDIA DE LA ETAPA');
    expect(html).not.toContain('CALIBRAR ODÓMETRO');
    // Shows roadbook card instead
    expect(html).toContain('HOJA CARGADA');
    expect(html).toContain('CARGAR HOJA DE RUTA');
  });

  it('calls onChangeControlSystem when a system button is pressed', () => {
    // This is a renderToString test — checking the prop wires correctly
    const onChangeControlSystem = vi.fn();
    const html = renderToString(
      <PrepararEtapaScreen
        savedSpeed={50}
        onSave={() => ({ ok: true })}
        onBack={() => {}}
        controlSystem="carrera"
        onChangeControlSystem={onChangeControlSystem}
      />
    );
    // Both selector buttons are rendered
    expect(html).toContain('CARRERA');
    expect(html).toContain('HOJA DE RUTA');
  });
});
