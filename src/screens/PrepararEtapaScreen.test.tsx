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
