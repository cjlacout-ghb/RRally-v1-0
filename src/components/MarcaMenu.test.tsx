import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { MarcaMenu } from './MarcaMenu';
import { ETIQUETAS_VALIDAS } from '../logic/marcaTextos';

// Setup minimal DOM mock for interactive React tests in Node
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

function findAllElements(root: Record<string, unknown>, predicate: (el: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  if (predicate(root)) results.push(root);
  const children = (root.children as Record<string, unknown>[]) || [];
  for (const child of children) {
    results.push(...findAllElements(child, predicate));
  }
  return results;
}

function getReactProps(el: Record<string, unknown>): Record<string, unknown> | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps'));
  return key ? (el[key] as Record<string, unknown>) : null;
}

describe('MarcaMenu Component', () => {
  beforeEach(() => {
    setupMockDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Nivel superior', () => {
    it('muestra exactamente 39 entradas (38 textos de señales + CARTEL ›)', () => {
      const html = renderToString(<MarcaMenu filterQuery={null} onSeleccionar={() => {}} />);
      const options = html.match(/role="option"/g);
      expect(options).not.toBeNull();
      expect(options?.length).toBe(39);
      expect(html).toContain('CARTEL ›');
      expect(html).toContain('alcantarilla');
      expect(html).toContain('árbol');
    });

    it('no contiene ninguno de los 11 términos oficiales de carrera', () => {
      const html = renderToString(<MarcaMenu filterQuery={null} onSeleccionar={() => {}} />);
      for (const termino of ETIQUETAS_VALIDAS) {
        expect(html).not.toMatch(new RegExp(`>${termino}<`));
      }
    });

    it('ordena CARTEL › alfabéticamente entre cambio de velocidad y cementerio', () => {
      const html = renderToString(<MarcaMenu filterQuery={null} onSeleccionar={() => {}} />);
      const posCambio = html.indexOf('cambio de velocidad');
      const posCartel = html.indexOf('CARTEL ›');
      const posCementerio = html.indexOf('cementerio');

      expect(posCambio).toBeGreaterThan(-1);
      expect(posCartel).toBeGreaterThan(-1);
      expect(posCementerio).toBeGreaterThan(-1);
      expect(posCambio).toBeLessThan(posCartel);
      expect(posCartel).toBeLessThan(posCementerio);
    });

    it('aplica el estilo de navegación (borde primary 2px y texto primary) a CARTEL › y a ningún otro ítem del nivel superior', () => {
      const html = renderToString(<MarcaMenu filterQuery={null} onSeleccionar={() => {}} />);
      const navMatches = html.match(/marca-menu-item--nav/g);
      expect(navMatches).not.toBeNull();
      expect(navMatches?.length).toBe(1);
      expect(html).toContain('marca-menu-item--cartel');
    });

    it('anuncia CARTEL › como apertura de submenú en su aria-label', () => {
      const html = renderToString(<MarcaMenu filterQuery={null} onSeleccionar={() => {}} />);
      expect(html).toContain('aria-label="CARTEL ›, abrir submenú"');
    });

    it('al hacer click en un texto principal llama a onSeleccionar con el texto', () => {
      const onSeleccionar = vi.fn();
      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(<MarcaMenu filterQuery={null} onSeleccionar={onSeleccionar} />);
      });

      const arbolBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'árbol';
      });
      expect(arbolBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(arbolBtn!)?.onClick as () => void)?.();
      });

      expect(onSeleccionar).toHaveBeenCalledWith('árbol');
    });
  });

  describe('Submenú CARTEL', () => {
    it('al tocar CARTEL › abre el submenú con VOLVER y exactamente 31 carteles sin el prefijo "cartel"', () => {
      const onSeleccionar = vi.fn();
      const container = (globalThis as unknown as { document: { createElement: (tag: string) => Record<string, unknown> } }).document.createElement('div');
      container.ownerDocument = (globalThis as unknown as { document: unknown }).document;
      const root = createRoot(container as unknown as HTMLElement);

      flushSync(() => {
        root.render(<MarcaMenu filterQuery={null} onSeleccionar={onSeleccionar} />);
      });

      // 1. Tocar CARTEL ›
      const cartelBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'CARTEL ›';
      });
      expect(cartelBtn).not.toBeNull();

      flushSync(() => {
        (getReactProps(cartelBtn!)?.onClick as () => void)?.();
      });

      // 2. Comprobar botón VOLVER
      const volverBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === '‹ VOLVER';
      });
      expect(volverBtn).not.toBeNull();
      const volverProps = getReactProps(volverBtn!);
      expect(String(volverProps?.className)).toContain('marca-menu-item--nav');
      expect(String(volverProps?.className)).toContain('marca-menu-item--volver');
      expect(volverProps?.['aria-label']).toBe('‹ VOLVER, volver al menú principal');

      // 3. Comprobar que hay 31 opciones de cartel (más el botón volver = 32 opciones con role="option")
      const allOptions = findAllElements(container, (el) => {
        const props = getReactProps(el);
        return props?.role === 'option';
      });
      expect(allOptions.length).toBe(32);

      // Comprobar que ningún cartel tiene clase nav
      const cartelOptionsWithNav = allOptions.filter((opt) => {
        const props = getReactProps(opt);
        return props?.children !== '‹ VOLVER' && String(props?.className).includes('marca-menu-item--nav');
      });
      expect(cartelOptionsWithNav).toHaveLength(0);

      // Comprobar que se muestran sin "cartel "
      const curvaDerBtn = findElement(container, (el) => {
        const props = getReactProps(el);
        return props?.children === 'curva derecha';
      });
      expect(curvaDerBtn).not.toBeNull();

      // 4. Al seleccionar un cartel, escribe el texto COMPLETO (con "cartel ")
      flushSync(() => {
        (getReactProps(curvaDerBtn!)?.onClick as () => void)?.();
      });
      expect(onSeleccionar).toHaveBeenCalledWith('cartel curva derecha');

      // 5. Tocar VOLVER regresa al nivel principal (39 entradas)
      flushSync(() => {
        (getReactProps(volverBtn!)?.onClick as () => void)?.();
      });
      const topOptions = findAllElements(container, (el) => {
        const props = getReactProps(el);
        return props?.role === 'option';
      });
      expect(topOptions.length).toBe(39);
    });
  });

  describe('Filtrado en tiempo real', () => {
    it('muestra lista plana con textos principales y carteles que coinciden', () => {
      const html = renderToString(<MarcaMenu filterQuery="curva" onSeleccionar={() => {}} />);
      expect(html).toContain('cartel curva derecha');
      expect(html).toContain('cartel curva izquierda');
      expect(html).not.toContain('‹ VOLVER');
      expect(html).not.toContain('CARTEL ›');
      expect(html).toMatch(/>cartel curva derecha</);
    });

    it('muestra SIN COINCIDENCIAS cuando nada coincide', () => {
      const html = renderToString(<MarcaMenu filterQuery="zzzincoincidencia123" onSeleccionar={() => {}} />);
      expect(html).toContain('SIN COINCIDENCIAS');
      expect(html).toContain('marca-menu-item--empty');
      expect(html).not.toContain('role="option"');
    });

    it('no busca términos oficiales porque fueron removidos del menú MARCA', () => {
      const html = renderToString(<MarcaMenu filterQuery="autolargada" onSeleccionar={() => {}} />);
      expect(html).toContain('SIN COINCIDENCIAS');
      expect(html).not.toContain('AUTOLARGADA');
    });

    it('vuelve al menú normal cuando la consulta está vacía', () => {
      const html = renderToString(<MarcaMenu filterQuery="" onSeleccionar={() => {}} />);
      const options = html.match(/role="option"/g);
      expect(options?.length).toBe(39);
    });
  });
});
