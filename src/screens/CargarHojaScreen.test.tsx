import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { CargarHojaScreen } from './CargarHojaScreen';
import { PrepararEtapaScreen } from './PrepararEtapaScreen';
import { createInitialSheet, addSheetRows, type RoadbookRow } from '../logic/roadbookModel';

// Lightweight DOM mock for React 19 interactive component testing in Node
function setupMockDom() {
  function createElementMock(tag: string) {
    const listeners: Record<string, ((e: unknown) => void)[]> = {};
    const el: Record<string, unknown> = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      style: {},
      attributes: {} as Record<string, string>,
      children: [] as unknown[],
      setAttribute: (k: string, v: string) => { (el.attributes as Record<string, string>)[k] = v; },
      getAttribute: (k: string) => (el.attributes as Record<string, string>)[k],
      removeAttribute: (k: string) => { delete (el.attributes as Record<string, string>)[k]; },
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      removeEventListener: () => {},
      appendChild: (child: Record<string, unknown>) => {
        (el.children as unknown[]).push(child);
        child.parentNode = el;
        return child;
      },
      insertBefore: (child: Record<string, unknown>) => {
        (el.children as unknown[]).push(child);
        child.parentNode = el;
        return child;
      },
      removeChild: (child: unknown) => {
        const arr = el.children as unknown[];
        const i = arr.indexOf(child);
        if (i !== -1) arr.splice(i, 1);
        return child;
      },
      getBoundingClientRect: () => ({ top: 0, bottom: 50, left: 0, right: 300, width: 300, height: 50 }),
      scrollTop: 0,
    };
    return el;
  }

  const doc = {
    nodeType: 9,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: createElementMock,
    createElementNS: (_: unknown, tag: string) => createElementMock(tag),
    createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text, textContent: text }),
    activeElement: null,
  };

  (globalThis as unknown as { document: unknown }).document = doc;
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    document: doc,
    HTMLIFrameElement: class {},
    Element: class {},
    Node: class {},
  };

  return { doc, createElementMock };
}

function findElement(root: Record<string, unknown>, predicate: (el: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (predicate(root)) return root;
  const children = (root.children as Record<string, unknown>[]) || [];
  for (const child of children) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function getReactProps(el: Record<string, unknown>): Record<string, unknown> | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps'));
  return key ? (el[key] as Record<string, unknown>) : null;
}

describe('CargarHojaScreen Component', () => {
  beforeEach(() => {
    setupMockDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bug 1 reproduction and fix: Quick-text application & focus loss', () => {
    it('applies quick-text when pressed, keeps the row selected and the panel visible (including focus-loss sequence)', () => {
      let rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-2', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];

      const onUpdateRow = vi.fn((rowId: string, changes: Partial<RoadbookRow>) => {
        rows = rows.map((r) => (r.id === rowId ? { ...r, ...changes } : r));
      });

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      function renderApp() {
        flushSync(() => {
          root.render(
            <CargarHojaScreen
              rows={rows}
              onAddRows={() => {}}
              onUpdateRow={onUpdateRow}
              onBack={() => {}}
            />
          );
        });
      }

      renderApp();

      // 1. Select row 1 MARCA field
      const markBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      expect(markBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(markBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Assert row is editing and quick-text panel is visible
      const editingRowBefore = findElement(container, (el) => {
        const props = getReactProps(el);
        const className = String(props?.className || '');
        return className.includes('cargar-hoja-row--editing');
      });
      expect(editingRowBefore).not.toBeNull();

      const qtPanel = findElement(container, (el) => {
        const props = getReactProps(el);
        const className = String(props?.className || '');
        return className.includes('cargar-hoja-quicktexts-panel');
      });
      expect(qtPanel).not.toBeNull();

      // 2. Focus-loss sequence: find free-text input and trigger onBlur
      // In the old buggy code, onBlur ran commitEdit which cleared editingRowId and unmounted the panel.
      const textInput = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.placeholder === 'Texto libre';
      });
      expect(textInput).not.toBeNull();

      const inputProps = getReactProps(textInput!);
      if (typeof inputProps?.onBlur === 'function') {
        flushSync(() => {
          (inputProps.onBlur as () => void)();
        });
        renderApp();
      }

      // 3. Press quick-text button AUTOLARGADA
      const autolargadaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'AUTOLARGADA';
      });
      expect(autolargadaBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(autolargadaBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Assert row 1 text is updated to AUTOLARGADA
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'AUTOLARGADA' });
      expect(rows[0].mark).toBe('AUTOLARGADA');

      // Assert row 1 is STILL selected
      const editingRowAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        const className = String(props?.className || '');
        return className.includes('cargar-hoja-row--editing');
      });
      expect(editingRowAfter).not.toBeNull();

      // Assert quick-text panel is STILL visible
      const qtPanelAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        const className = String(props?.className || '');
        return className.includes('cargar-hoja-quicktexts-panel');
      });
      expect(qtPanelAfter).not.toBeNull();
    });

    it('updates row mark live as the user types in the free-text field', () => {
      let rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];

      const onUpdateRow = vi.fn((rowId: string, changes: Partial<RoadbookRow>) => {
        rows = rows.map((r) => (r.id === rowId ? { ...r, ...changes } : r));
      });

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      function renderApp() {
        flushSync(() => {
          root.render(
            <CargarHojaScreen
              rows={rows}
              onAddRows={() => {}}
              onUpdateRow={onUpdateRow}
              onBack={() => {}}
              initialEditingRowId="row-1"
              initialEditingField="mark"
            />
          );
        });
      }

      renderApp();

      const textInput = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.placeholder === 'Texto libre';
      });
      expect(textInput).not.toBeNull();

      // Type "Control Curva" into the input
      flushSync(() => {
        const props = getReactProps(textInput!);
        (props?.onChange as (e: unknown) => void)?.({ target: { value: 'Control Curva' } });
      });

      // Assert onUpdateRow was called live without needing blur or a confirm button
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'Control Curva' });
      expect(rows[0].mark).toBe('Control Curva');

      // Assert row is still selected
      renderApp();
      const editingRow = findElement(container, (el) => {
        const props = getReactProps(el);
        const className = String(props?.className || '');
        return className.includes('cargar-hoja-row--editing');
      });
      expect(editingRow).not.toBeNull();
    });

    it('hides the quick-text panel when no MARCA is being edited and shows it when one is', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];

      // 1. Initial / Nothing selected
      const htmlNothing = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );
      expect(htmlNothing).not.toContain('TEXTOS RÁPIDOS');
      expect(htmlNothing).not.toContain('cargar-hoja-quicktexts-panel');

      // 2. Editing MARCA
      const htmlMark = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="mark"
        />
      );
      expect(htmlMark).toContain('TEXTOS RÁPIDOS');
      expect(htmlMark).toContain('cargar-hoja-quicktexts-panel');
      expect(htmlMark).toContain('AUTOLARGADA');

      // 3. Editing TIEMPO
      const htmlTime = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="time"
        />
      );
      expect(htmlTime).not.toContain('TEXTOS RÁPIDOS');
      expect(htmlTime).toContain('TIEMPO (H:MM:SS)');

      // 4. Editing SPEED
      const htmlSpeed = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="speed"
        />
      );
      expect(htmlSpeed).not.toContain('TEXTOS RÁPIDOS');
      expect(htmlSpeed).toContain('VELOCIDAD (KM/H)');
    });
  });

  describe('Small Fix B: Loaded rows counter text on both screens', () => {
    it('displays the exact "N DE M FILAS" counter on both screens across empty, partially loaded, and expanded sheets', () => {
      // 1. Empty sheet (50 rows, none loaded)
      const emptySheet = createInitialSheet(); // 50 rows
      const htmlCargarEmpty = renderToString(
        <CargarHojaScreen
          rows={emptySheet}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );
      const htmlPrepararEmpty = renderToString(
        <PrepararEtapaScreen
          savedSpeed={null}
          onSave={() => ({ ok: true })}
          onBack={() => {}}
          controlSystem="hoja-de-ruta"
          roadbookRows={emptySheet}
        />
      );
      expect(htmlCargarEmpty).toContain('0 DE 50 FILAS');
      expect(htmlPrepararEmpty).toContain('0 DE 50 FILAS');

      // 2. Partially loaded sheet (38 of 50 loaded)
      const partialSheet = createInitialSheet();
      for (let i = 0; i < 38; i++) {
        partialSheet[i].assignedTimeSeconds = (i + 1) * 30;
      }
      const htmlCargarPartial = renderToString(
        <CargarHojaScreen
          rows={partialSheet}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );
      const htmlPrepararPartial = renderToString(
        <PrepararEtapaScreen
          savedSpeed={null}
          onSave={() => ({ ok: true })}
          onBack={() => {}}
          controlSystem="hoja-de-ruta"
          roadbookRows={partialSheet}
        />
      );
      expect(htmlCargarPartial).toContain('38 DE 50 FILAS');
      expect(htmlPrepararPartial).toContain('38 DE 50 FILAS');

      // 3. After adding 10 rows (38 of 60 loaded)
      const expandedSheet = addSheetRows(partialSheet, 10);
      const htmlCargarExpanded = renderToString(
        <CargarHojaScreen
          rows={expandedSheet}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );
      const htmlPrepararExpanded = renderToString(
        <PrepararEtapaScreen
          savedSpeed={null}
          onSave={() => ({ ok: true })}
          onBack={() => {}}
          controlSystem="hoja-de-ruta"
          roadbookRows={expandedSheet}
        />
      );
      expect(htmlCargarExpanded).toContain('38 DE 60 FILAS');
      expect(htmlPrepararExpanded).toContain('38 DE 60 FILAS');
    });
  });

  describe('Small Fix A: Check mark spacing in PrepararEtapaScreen selector', () => {
    it('renders checkmark with visible space before label', () => {
      const html = renderToString(
        <PrepararEtapaScreen
          savedSpeed={null}
          onSave={() => ({ ok: true })}
          onBack={() => {}}
          controlSystem="carrera"
        />
      );
      // Selected Carrera has system-check class and separate span for CARRERA
      expect(html).toContain('class="system-check" aria-hidden="true">✓</span>');
      expect(html).toContain('<span>CARRERA</span>');
    });
  });
});
