import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { CargarHojaScreen } from './CargarHojaScreen';
import { PrepararEtapaScreen } from './PrepararEtapaScreen';
import { createInitialSheet, addSheetRows, INITIAL_SHEET_ROWS, type RoadbookRow } from '../logic/roadbookModel';
import { CONFIRM_RESET_TIMEOUT_MS } from '../hooks/useConfirmReset';
import { isSetupPending } from '../logic/setupStatus';

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
    clearTimeout: (id: number) => clearTimeout(id),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
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
      // 1. Hoja vacía (20 filas, ninguna cargada)
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
      expect(htmlCargarEmpty).toContain('0 DE 20 FILAS');
      expect(htmlPrepararEmpty).toContain('0 DE 20 FILAS');

      // 2. Hoja parcialmente cargada (15 de 20)
      const partialSheet = createInitialSheet();
      for (let i = 0; i < 15; i++) {
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
      expect(htmlCargarPartial).toContain('15 DE 20 FILAS');
      expect(htmlPrepararPartial).toContain('15 DE 20 FILAS');

      // 3. Después de agregar 10 filas (15 de 30)
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
      expect(htmlCargarExpanded).toContain('15 DE 30 FILAS');
      expect(htmlPrepararExpanded).toContain('15 DE 30 FILAS');
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

  describe('Botón de vaciar fila ("X")', () => {
    it('muestra "✕" sólo en filas con contenido, reservando siempre la columna fija', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'LARGADA', assignedTimeSeconds: null, speedKmH: 50 }, // content: mark + speed
        { id: 'row-2', mark: '', assignedTimeSeconds: 120, speedKmH: null }, // content: time
        { id: 'row-3', mark: '', assignedTimeSeconds: null, speedKmH: null }, // empty (inherits speed 50 in display)
      ];

      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );

      // Header has reserved empty cell
      expect(html).toContain('cargar-hoja-col-clear');

      // Row 1 and 2 have clear buttons
      expect(html).toContain('aria-label="Borrar fila 1"');
      expect(html).toContain('aria-label="Borrar fila 2"');

      // Row 3 is empty (even though it inherits speed 50 in display), so NO clear button
      expect(html).not.toContain('aria-label="Borrar fila 3"');

      // But row 3 still has the reserved cell
      const matches = html.match(/cargar-hoja-row-clear-cell/g);
      expect(matches).toHaveLength(3); // All 3 rows have the reserved cell!
    });

    it('al tocar "✕" vacía MARCA, tiempo y velocidad sin eliminar la fila ni alterar la numeración', () => {
      let rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'PC1', assignedTimeSeconds: 100, speedKmH: 60 },
        { id: 'row-2', mark: 'PC2', assignedTimeSeconds: 200, speedKmH: 70 },
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

      const clearBtn1 = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Borrar fila 1';
      });
      expect(clearBtn1).not.toBeNull();

      flushSync(() => {
        (getReactProps(clearBtn1!)?.onClick as () => void)?.();
      });

      expect(onUpdateRow).toHaveBeenCalledWith('row-1', {
        mark: '',
        assignedTimeSeconds: null,
        speedKmH: null,
      });

      renderApp();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        id: 'row-1',
        mark: '',
        assignedTimeSeconds: null,
        speedKmH: null,
      });
      expect(rows[1].mark).toBe('PC2');
    });

    it('si se vacía la fila en edición, permanece seleccionada con campos vacíos y cierra el menú', () => {
      let rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'LARGADA', assignedTimeSeconds: 60, speedKmH: 50 },
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

      // Fila 1 está seleccionada y el menú de marca está abierto
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

      // Tocar el botón de borrar de la fila 1
      const clearBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Borrar fila 1';
      });
      expect(clearBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(clearBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // La fila sigue seleccionada
      const editingRowAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-row--editing');
      });
      expect(editingRowAfter).not.toBeNull();

      // El menú se cerró coherentemente
      const menuAfter = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('marca-menu');
      });
      expect(menuAfter).toBeNull();

      // El input de texto libre de MARCA está vacío
      const input = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-mark-input');
      });
      expect(getReactProps(input!)?.value).toBe('');
    });

    it('está deshabilitado con aria-disabled mientras corre la carrera', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'TEST', assignedTimeSeconds: 10, speedKmH: 50 },
      ];
      const onUpdateRow = vi.fn();

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(
          <CargarHojaScreen
            rows={rows}
            onAddRows={() => {}}
            onUpdateRow={onUpdateRow}
            onBack={() => {}}
            isRaceRunning={true}
          />
        );
      });

      const clearBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Borrar fila 1';
      });
      expect(clearBtn).not.toBeNull();

      const props = getReactProps(clearBtn!);
      expect(props?.disabled).toBe(true);
      expect(props?.['aria-disabled']).toBe(true);
      expect(String(props?.className || '')).toContain('cargar-hoja-row-clear--disabled');

      // Al hacer click no llama a onUpdateRow
      flushSync(() => {
        (props?.onClick as () => void)?.();
      });
      expect(onUpdateRow).not.toHaveBeenCalled();
    });
  });

  describe('Botón BORRAR TODO', () => {
    it('renderiza como botón secundario de min 64px debajo de "+ 10 FILAS"', () => {
      const rows = createInitialSheet();
      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );

      expect(html).toContain('+ 10 FILAS');
      expect(html).toContain('cargar-hoja-borrar-btn');
      expect(html).toContain('BORRAR TODO');
      // Aparece después de + 10 FILAS en el HTML
      const idxAdd = html.indexOf('+ 10 FILAS');
      const idxBorrar = html.indexOf('BORRAR TODO');
      expect(idxBorrar).toBeGreaterThan(idxAdd);
    });

    it('confirmación de dos pasos: primer toque CONFIRMAR con borde rojo, caduca en 4s', () => {
      vi.useFakeTimers();
      const rows = createInitialSheet();
      const onClearAll = vi.fn();

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      function renderApp() {
        flushSync(() => {
          root.render(
            <CargarHojaScreen
              rows={rows}
              onAddRows={() => {}}
              onUpdateRow={() => {}}
              onClearAll={onClearAll}
              onBack={() => {}}
            />
          );
        });
      }

      renderApp();

      const getBorrarBtn = () =>
        findElement(container, (el) => {
          const props = getReactProps(el);
          return String(props?.className || '').includes('cargar-hoja-borrar-btn');
        });

      // Inicialmente dice BORRAR TODO
      expect(getReactProps(getBorrarBtn()!)?.children).toBe('BORRAR TODO');

      // Primer toque: se arma con CONFIRMAR y borde status-behind
      flushSync(() => {
        (getReactProps(getBorrarBtn()!)?.onClick as () => void)?.();
      });
      renderApp();

      const armedBtn = getBorrarBtn();
      const armedProps = getReactProps(armedBtn!);
      expect(armedProps?.children).toBe('CONFIRMAR');
      expect(String(armedProps?.className || '')).toContain('cargar-hoja-borrar-btn--armed');
      expect(onClearAll).not.toHaveBeenCalled();

      // Caduca a los 4 segundos
      flushSync(() => {
        vi.advanceTimersByTime(CONFIRM_RESET_TIMEOUT_MS + 10);
      });
      renderApp();

      const expiredBtn = getBorrarBtn();
      expect(getReactProps(expiredBtn!)?.children).toBe('BORRAR TODO');
      expect(String(getReactProps(expiredBtn!)?.className || '')).not.toContain('cargar-hoja-borrar-btn--armed');
      expect(onClearAll).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('segundo toque confirma y vacía todo (20 filas vacías, contador 0 DE 20 FILAS)', () => {
      let rows: RoadbookRow[] = Array.from({ length: 30 }, (_, i) => ({
        id: `row-${i + 1}`,
        mark: `Marca ${i + 1}`,
        assignedTimeSeconds: (i + 1) * 20,
        speedKmH: 50,
      }));

      const onClearAll = vi.fn(() => {
        rows = createInitialSheet();
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
              onUpdateRow={() => {}}
              onClearAll={onClearAll}
              onBack={() => {}}
            />
          );
        });
      }

      renderApp();

      const getBorrarBtn = () =>
        findElement(container, (el) => {
          const props = getReactProps(el);
          return String(props?.className || '').includes('cargar-hoja-borrar-btn');
        });

      // Primer toque: armar
      flushSync(() => {
        (getReactProps(getBorrarBtn()!)?.onClick as () => void)?.();
      });
      renderApp();

      // Segundo toque: confirmar
      flushSync(() => {
        (getReactProps(getBorrarBtn()!)?.onClick as () => void)?.();
      });
      renderApp();

      expect(onClearAll).toHaveBeenCalledTimes(1);
      expect(rows).toHaveLength(INITIAL_SHEET_ROWS);
      expect(rows.every((r) => r.mark === '' && r.assignedTimeSeconds === null && r.speedKmH === null)).toBe(true);

      // Contador se actualiza a 0 DE 20 FILAS
      const countEl = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-count');
      });
      expect(getReactProps(countEl!)?.children).toBe('0 DE 20 FILAS');

      // Botón vuelve a mostrar BORRAR TODO desarmado
      expect(getReactProps(getBorrarBtn()!)?.children).toBe('BORRAR TODO');

      // Comprobación de setupStatus: PREPARAR ETAPA vuelve a requerir configuración
      expect(isSetupPending('hoja-de-ruta', null, rows)).toBe(true);
    });

    it('está deshabilitado mientras corre la carrera, con mensaje "DETENÉ LA CARRERA PARA BORRAR"', () => {
      const rows = createInitialSheet();
      const onClearAll = vi.fn();

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(
          <CargarHojaScreen
            rows={rows}
            onAddRows={() => {}}
            onUpdateRow={() => {}}
            onClearAll={onClearAll}
            onBack={() => {}}
            isRaceRunning={true}
          />
        );
      });

      const borrarBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return String(props?.className || '').includes('cargar-hoja-borrar-btn');
      });
      expect(borrarBtn).not.toBeNull();

      const props = getReactProps(borrarBtn!);
      expect(props?.disabled).toBe(true);
      expect(props?.['aria-disabled']).toBe(true);
      expect(String(props?.className || '')).toContain('btn-secondary--disabled');

      // Mensaje de bloqueo visible
      const msgEl = findElement(container, (el) => {
        const p = getReactProps(el);
        return String(p?.className || '').includes('cargar-hoja-blocked-msg');
      });
      expect(msgEl).not.toBeNull();
      expect(getReactProps(msgEl!)?.children).toBe('DETENÉ LA CARRERA PARA BORRAR');

      // Al hacer click no se arma ni llama a onClearAll
      flushSync(() => {
        (props?.onClick as () => void)?.();
      });
      expect(onClearAll).not.toHaveBeenCalled();
    });
  });

  describe('Énfasis de términos oficiales de carrera en filas', () => {
    it('muestra término oficial en mayúsculas canónicas y clase brass bold (cargar-hoja-row-mark--oficial)', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'AUTOLARGADA', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-2', mark: 'autolargada', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-3', mark: 'neutralizacion', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-4', mark: 'árbol', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-5', mark: 'autocontrol 2', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-6', mark: 'cartel curva derecha', assignedTimeSeconds: null, speedKmH: null },
      ];

      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );

      // Fila 1 (AUTOLARGADA): clase oficial y texto canónico
      expect(html).toContain('cargar-hoja-row-mark--oficial');
      // Fila 2 ('autolargada' en minúsculas): se renderiza como AUTOLARGADA en mayúsculas
      // Fila 3 ('neutralizacion' sin acento): se renderiza como NEUTRALIZACIÓN con acento canónico
      expect(html).toContain('NEUTRALIZACIÓN');

      // Filas 4, 5 y 6 no son términos oficiales y se muestran tal cual
      expect(html).toContain('árbol');
      expect(html).toContain('autocontrol 2');
      expect(html).toContain('cartel curva derecha');
    });

    it('escribir "autolargada" a mano muestra AUTOLARGADA en brass bold sin cambiar el texto almacenado', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];
      const onUpdateRow = vi.fn((_id: string, changes: Partial<RoadbookRow>) => {
        Object.assign(rows[0], changes);
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

      // Iniciar edición de la fila 1
      const markBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      flushSync(() => {
        (getReactProps(markBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Simular tipear "autolargada" en minúsculas en el input de texto libre
      const inputEl = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.placeholder === 'Texto libre';
      });
      expect(inputEl).not.toBeNull();

      flushSync(() => {
        (getReactProps(inputEl!)?.onChange as (e: unknown) => void)?.({
          target: { value: 'autolargada' },
        });
      });
      renderApp();

      // El valor almacenado es exactamente lo que tipeó el usuario
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'autolargada' });
      expect(rows[0].mark).toBe('autolargada');

      // Pero el botón de la fila muestra AUTOLARGADA en mayúsculas con la clase de énfasis oficial
      const updatedMarkBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      expect(updatedMarkBtn).not.toBeNull();
      const markProps = getReactProps(updatedMarkBtn!);
      expect(String(markProps?.className || '')).toContain('cargar-hoja-row-mark--oficial');
      expect(markProps?.children).toBe('AUTOLARGADA');
    });

    it('seleccionar AUTOLARGADA del menú lo muestra en brass bold en la fila', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: '', assignedTimeSeconds: null, speedKmH: null },
      ];
      const onUpdateRow = vi.fn((_id: string, changes: Partial<RoadbookRow>) => {
        Object.assign(rows[0], changes);
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

      // Iniciar edición
      const markBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      flushSync(() => {
        (getReactProps(markBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Seleccionar AUTOLARGADA
      const autolargadaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'AUTOLARGADA';
      });
      expect(autolargadaBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(autolargadaBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'AUTOLARGADA' });
      const updatedMarkBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      const markProps = getReactProps(updatedMarkBtn!);
      expect(String(markProps?.className || '')).toContain('cargar-hoja-row-mark--oficial');
      expect(markProps?.children).toBe('AUTOLARGADA');
    });

    it('textos no oficiales como "autocontrol 2" o señales de ruta no reciben clase oficial', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'autocontrol 2', assignedTimeSeconds: null, speedKmH: null },
        { id: 'row-2', mark: 'árbol', assignedTimeSeconds: null, speedKmH: null },
      ];

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(
          <CargarHojaScreen
            rows={rows}
            onAddRows={() => {}}
            onUpdateRow={() => {}}
            onBack={() => {}}
          />
        );
      });

      const markBtn1 = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 1';
      });
      const props1 = getReactProps(markBtn1!);
      expect(String(props1?.className || '')).not.toContain('cargar-hoja-row-mark--oficial');
      expect(props1?.children).toBe('autocontrol 2');

      const markBtn2 = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Editar marca de la fila 2';
      });
      const props2 = getReactProps(markBtn2!);
      expect(String(props2?.className || '')).not.toContain('cargar-hoja-row-mark--oficial');
      expect(props2?.children).toBe('árbol');
    });
  });
});
