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

  describe('Menú de textos predefinidos: visibilidad', () => {
    it('muestra el menú de marca únicamente cuando se edita MARCA', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];

      // 1. Inicial / nada seleccionado
      const htmlNada = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );
      expect(htmlNada).not.toContain('cargar-hoja-marca-panel');
      expect(htmlNada).not.toContain('marca-menu');
      expect(htmlNada).not.toContain('TEXTOS RÁPIDOS');

      // 2. Editando MARCA
      const htmlMarca = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="mark"
        />
      );
      expect(htmlMarca).toContain('cargar-hoja-marca-panel');
      expect(htmlMarca).toContain('marca-menu');
      expect(htmlMarca).toContain('marca-menu-item--oficial');
      expect(htmlMarca).toContain('marca-menu-item--nav');
      expect(htmlMarca).not.toContain('TEXTOS RÁPIDOS');

      // 3. Editando TIEMPO
      const htmlTiempo = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="time"
        />
      );
      expect(htmlTiempo).not.toContain('cargar-hoja-marca-panel');
      expect(htmlTiempo).toContain('TIEMPO (H:MM:SS)');

      // 4. Editando VELOCIDAD
      const htmlVel = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="speed"
        />
      );
      expect(htmlVel).not.toContain('cargar-hoja-marca-panel');
      expect(htmlVel).toContain('VELOCIDAD (KM/H)');
    });
  });

  describe('Selección de ítem, colapso del menú y reapertura', () => {
    it('al seleccionar un ítem escribe el texto completo, colapsa el menú y mantiene la fila seleccionada', () => {
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

      // 1. Tocar campo MARCA de la fila 1
      const markBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      expect(markBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(markBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Fila 1 en edición y menú visible
      const editingRowBefore = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-row--editing');
      });
      expect(editingRowBefore).not.toBeNull();

      const menuBefore = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('marca-menu');
      });
      expect(menuBefore).not.toBeNull();

      // 2. Seleccionar AUTOLARGADA en el menú
      const autolargadaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'AUTOLARGADA';
      });
      expect(autolargadaBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(autolargadaBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Verifica que onUpdateRow fue llamado con el texto completo
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'AUTOLARGADA' });
      expect(rows[0].mark).toBe('AUTOLARGADA');

      // Verifica que la fila SIGUE seleccionada
      const editingRowAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-row--editing');
      });
      expect(editingRowAfter).not.toBeNull();

      // Verifica que el menú se colapsó (no está en el DOM), pero el campo libre sigue visible con el texto
      const menuAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('marca-menu');
      });
      expect(menuAfter).toBeNull();

      const textInput = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.placeholder === 'Texto libre';
      });
      expect(textInput).not.toBeNull();
      expect(getReactProps(textInput!)?.value).toBe('AUTOLARGADA');

      // 3. Tocar el campo MARCA de la fila nuevamente reabre el menú en el nivel superior
      flushSync(() => {
        (getReactProps(markBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      const menuReopened = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('marca-menu');
      });
      expect(menuReopened).not.toBeNull();

      // El menú reabierto está en el nivel superior (contiene CARTEL ›)
      const cartelEntry = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'CARTEL ›';
      });
      expect(cartelEntry).not.toBeNull();
    });
  });

  describe('Campo libre y filtrado en tiempo real', () => {
    it('actualiza la fila en tiempo real al escribir y filtra el menú con carteles incluidos', () => {
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

      // Escribir "curva" en el campo libre
      flushSync(() => {
        const props = getReactProps(textInput!);
        (props?.onChange as (e: unknown) => void)?.({ target: { value: 'curva' } });
      });
      renderApp();

      // Se actualizó la fila en vivo
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'curva' });
      expect(rows[0].mark).toBe('curva');

      // El menú muestra los carteles con texto completo
      const cartelCurvaDer = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'cartel curva derecha';
      });
      expect(cartelCurvaDer).not.toBeNull();

      // Probar búsqueda sin coincidencias
      flushSync(() => {
        const props = getReactProps(textInput!);
        (props?.onChange as (e: unknown) => void)?.({ target: { value: 'xyzsincoincidencia999' } });
      });
      renderApp();

      const emptyMatch = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'SIN COINCIDENCIAS';
      });
      expect(emptyMatch).not.toBeNull();
    });
  });

  describe('Contador de filas cargadas en Cargar Hoja y Preparar Etapa', () => {
    it('muestra el contador exacto "N DE M FILAS" en ambas pantallas', () => {
      // 1. Hoja vacía (50 filas, ninguna cargada)
      const emptySheet = createInitialSheet();
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

      // 2. Hoja parcialmente cargada (38 de 50)
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

      // 3. Después de agregar 10 filas (38 de 60)
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

  describe('Espaciado del check en PrepararEtapaScreen', () => {
    it('renderiza el check con espacio visible antes de la etiqueta', () => {
      const html = renderToString(
        <PrepararEtapaScreen
          savedSpeed={null}
          onSave={() => ({ ok: true })}
          onBack={() => {}}
          controlSystem="carrera"
        />
      );
      expect(html).toContain('class="system-check" aria-hidden="true">✓</span>');
      expect(html).toContain('<span>CARRERA</span>');
    });
  });
});
