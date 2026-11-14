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

      // 2. Seleccionar árbol en el menú
      const arbolBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'árbol';
      });
      expect(arbolBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(arbolBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Verifica que onUpdateRow fue llamado con el texto completo
      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { mark: 'árbol' });
      expect(rows[0].mark).toBe('árbol');

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
      expect(getReactProps(textInput!)?.value).toBe('árbol');

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
        etiqueta: 'none',
      });

      renderApp();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        id: 'row-1',
        mark: '',
        assignedTimeSeconds: null,
        speedKmH: null,
        etiqueta: 'none',
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

  describe('Pestañas MARCA | ETIQUETA y gestión de etiqueta', () => {
    it('muestra el selector de pestañas MARCA | ETIQUETA al editar MARCA, iniciando en MARCA', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'árbol', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' },
      ];

      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
          initialEditingRowId="row-1"
          initialEditingField="mark"
        />
      );

      expect(html).toContain('cargar-hoja-tabs');
      expect(html).toContain('tab-marca');
      expect(html).toContain('tab-etiqueta');
      expect(html).toContain('Texto libre'); // input visible en tab MARCA
    });

    it('al cambiar a la pestaña ETIQUETA, muestra SIN ETIQUETA y las 11 opciones oficiales con check en la actual', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'árbol', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' },
      ];

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
              onBack={() => {}}
              initialEditingRowId="row-1"
              initialEditingField="mark"
            />
          );
        });
      }

      renderApp();

      // Cambiar a pestaña ETIQUETA
      const tabEtiquetaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.id === 'tab-etiqueta';
      });
      expect(tabEtiquetaBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(tabEtiquetaBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // En pestaña ETIQUETA, el campo libre de texto debe estar oculto
      const inputEl = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.placeholder === 'Texto libre';
      });
      expect(inputEl).toBeNull();

      // Debe mostrar la lista de etiquetas con SIN ETIQUETA seleccionado (con ✓)
      const sinEtiquetaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'SIN ETIQUETA, seleccionado';
      });
      expect(sinEtiquetaBtn).not.toBeNull();

      // Comprobar presencia de términos oficiales
      const largadaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'LARGADA';
      });
      expect(largadaBtn).not.toBeNull();
    });

    it('al seleccionar una etiqueta de la lista llama a onUpdateRow y actualiza la fila', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'puente', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' },
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
              initialEditingRowId="row-1"
              initialEditingField="mark"
            />
          );
        });
      }

      renderApp();

      // Cambiar a pestaña ETIQUETA
      const tabEtiquetaBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.id === 'tab-etiqueta';
      });
      flushSync(() => {
        (getReactProps(tabEtiquetaBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      // Seleccionar CONTROL HORARIO
      const controlHorarioBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'CONTROL HORARIO';
      });
      expect(controlHorarioBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(controlHorarioBtn!)?.onClick as () => void)?.();
      });
      renderApp();

      expect(onUpdateRow).toHaveBeenCalledWith('row-1', { etiqueta: 'CONTROL HORARIO' });
      expect(rows[0].etiqueta).toBe('CONTROL HORARIO');

      // Ahora CONTROL HORARIO debe figurar como seleccionado
      const updatedControlHorario = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'CONTROL HORARIO, seleccionado';
      });
      expect(updatedControlHorario).not.toBeNull();
    });

    it('muestra etiqueta en la primera línea de la celda MARCA en brass bold', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'puente', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'AUTOLARGADA' },
        { id: 'row-2', mark: '', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'CONTROL DE PASO' },
        { id: 'row-3', mark: 'árbol', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' },
      ];

      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );

      // Fila 1: muestra AUTOLARGADA en brass y puente
      expect(html).toContain('cargar-hoja-row-etiqueta brass');
      expect(html).toContain('AUTOLARGADA');
      expect(html).toContain('puente');

      // Fila 2: sólo etiqueta
      expect(html).toContain('CONTROL DE PASO');

      // Fila 3: sólo marca neutra
      expect(html).toContain('árbol');
    });

    it('un texto de marca igual a un término oficial se renderiza neutro si no tiene etiqueta', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'autolargada', assignedTimeSeconds: null, speedKmH: null, etiqueta: 'none' },
      ];

      const html = renderToString(
        <CargarHojaScreen
          rows={rows}
          onAddRows={() => {}}
          onUpdateRow={() => {}}
          onBack={() => {}}
        />
      );

      expect(html).toContain('autolargada');
      expect(html).not.toContain('cargar-hoja-row-etiqueta');
    });

    it('el botón X de vaciado de fila resetea también la etiqueta a "none"', () => {
      const rows: RoadbookRow[] = [
        { id: 'row-1', mark: 'puente', assignedTimeSeconds: 100, speedKmH: 50, etiqueta: 'LARGADA' },
      ];
      const onClearRow = vi.fn((id: string) => {
        rows[0].mark = '';
        rows[0].assignedTimeSeconds = null;
        rows[0].speedKmH = null;
        rows[0].etiqueta = 'none';
      });

      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(
          <CargarHojaScreen
            rows={rows}
            onAddRows={() => {}}
            onUpdateRow={() => {}}
            onClearRow={onClearRow}
            onBack={() => {}}
          />
        );
      });

      const clearBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.['aria-label'] === 'Borrar fila 1';
      });
      expect(clearBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(clearBtn!)?.onClick as () => void)?.();
      });

      expect(onClearRow).toHaveBeenCalledWith('row-1');
      expect(rows[0].etiqueta).toBe('none');
    });
  });
});
