import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AyudaScreen } from './AyudaScreen';

describe('AyudaScreen', () => {
  it('renders the header with title AYUDA and back button', () => {
    const html = renderToString(<AyudaScreen onBack={() => {}} />);
    expect(html).toContain('AYUDA');
    expect(html).toContain('aria-label="Volver"');
  });

  it('renders the 4 numbered steps with exact copy', () => {
    const html = renderToString(<AyudaScreen onBack={() => {}} />);
    expect(html).toContain('Calibrá el odómetro en la zona de control de la organización.');
    expect(html).toContain('Cargá la velocidad media de la etapa.');
    expect(html).toContain('Sincronizá con la hora oficial e iniciá el cronómetro.');
    expect(html).toContain('Mantené la diferencia lo más cerca de cero.');
  });

  it('renders the 4 warnings with exact copy', () => {
    const html = renderToString(<AyudaScreen onBack={() => {}} />);
    expect(html).toContain('ADVERTENCIAS');
    expect(html).toContain('El GPS del teléfono no es un odómetro de rueda.');
    expect(html).toContain('Mantené la app abierta, con la pantalla encendida y el teléfono cargando.');
    expect(html).toContain('Probala antes de la carrera.');
    expect(html).toContain('Es para el copiloto: el piloto no debe usarla mientras maneja.');
  });
});
