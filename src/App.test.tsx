import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

class MockStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

const mockStore = new MockStorage();
vi.stubGlobal('localStorage', mockStore);

if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '' },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe('App Header - Pending setup emphasis', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('renders PREPARAR ETAPA button with pending brass border class when setup is fresh', async () => {
    const { default: App } = await import('./App');
    const html = renderToString(<App />);

    expect(html).toContain('PREPARAR ETAPA');
    // Fresh state in carrera mode with no speed saved -> pending class is present
    expect(html).toContain('btn-secondary--pending');
  });

  it('renders PREPARAR ETAPA button without pending class when stage speed is saved', async () => {
    const { writeStageSpeed } = await import('./storage');
    writeStageSpeed(55);

    const { default: App } = await import('./App');
    const html = renderToString(<App />);

    expect(html).toContain('PREPARAR ETAPA');
    expect(html).not.toContain('btn-secondary--pending');
  });

  it('renders pending button and empty-state card in hoja-de-ruta mode when sheet is empty', async () => {
    const { writeControlSystem } = await import('./storage');
    writeControlSystem('hoja-de-ruta');

    const { default: App } = await import('./App');
    const html = renderToString(<App />);

    expect(html).toContain('PREPARAR ETAPA');
    expect(html).toContain('btn-secondary--pending');
    expect(html).toContain('SIN HOJA DE RUTA CARGADA');
    expect(html).toContain('CARGAR HOJA DE RUTA');
  });

  it('renders normal button and race view in hoja-de-ruta mode when at least one row is timed', async () => {
    const { writeControlSystem, writeRoadbookSheet } = await import('./storage');
    writeControlSystem('hoja-de-ruta');
    writeRoadbookSheet([
      { id: '1', mark: 'INICIO', assignedTimeSeconds: 0, speedKmH: 50 },
    ]);

    const { default: App } = await import('./App');
    const html = renderToString(<App />);

    expect(html).toContain('PREPARAR ETAPA');
    expect(html).not.toContain('btn-secondary--pending');
    expect(html).not.toContain('SIN HOJA DE RUTA CARGADA');
    expect(html).toContain('hdr-next-stretch');
  });
});
