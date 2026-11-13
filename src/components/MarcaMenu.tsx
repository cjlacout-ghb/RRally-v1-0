import { useState, useRef } from 'react';
import {
  MARCA_TEXTOS_MAIN,
  MARCA_TEXTOS_CARTEL,
  filtrarMarcaTextos,
  esTerminoOficial,
} from '../logic/marcaTextos';
import './MarcaMenu.css';

interface MarcaMenuProps {
  /** Texto para filtrar en tiempo real mientras se escribe (null o vacío para menú jerárquico normal). */
  filterQuery: string | null;
  /** Callback al seleccionar un texto del menú con su texto completo. */
  onSeleccionar: (textoCompleto: string) => void;
}

interface TopLevelEntry {
  type: 'text' | 'cartel_group';
  textoCompleto: string;
  textoMostrado: string;
}

/**
 * Entradas del nivel superior ordenadas con colación española:
 * 49 textos principales + entrada "CARTEL ›" (que se ordena como la palabra "cartel").
 * Total: exactamente 50 entradas.
 */
const TOP_LEVEL_ENTRIES: readonly TopLevelEntry[] = (() => {
  const esCollator = new Intl.Collator('es', {
    sensitivity: 'base',
    usage: 'sort',
  });
  const items: TopLevelEntry[] = [
    ...MARCA_TEXTOS_MAIN.map((t) => ({
      type: 'text' as const,
      textoCompleto: t,
      textoMostrado: t,
    })),
    {
      type: 'cartel_group' as const,
      textoCompleto: 'cartel',
      textoMostrado: 'CARTEL ›',
    },
  ];
  return items.sort((a, b) => esCollator.compare(a.textoCompleto, b.textoCompleto));
})();

export function MarcaMenu({ filterQuery, onSeleccionar }: MarcaMenuProps) {
  const [submenu, setSubmenu] = useState<'cartel' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filterMatches = filterQuery !== null && filterQuery.trim() !== ''
    ? filtrarMarcaTextos(filterQuery)
    : null;

  function handleOpenCartel() {
    setSubmenu('cartel');
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }

  function handleVolver() {
    setSubmenu(null);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }

  // Modo filtrado mientras se escribe
  if (filterMatches !== null) {
    return (
      <div
        ref={containerRef}
        className="marca-menu"
        role="listbox"
        aria-label="Textos predefinidos para marca"
      >
        {filterMatches.length === 0 ? (
          <div
            className="marca-menu-item marca-menu-item--empty"
            aria-disabled="true"
            role="status"
          >
            SIN COINCIDENCIAS
          </div>
        ) : (
          filterMatches.map((item) => {
            const esOficial = esTerminoOficial(item.textoCompleto);
            return (
              <button
                key={item.textoCompleto}
                type="button"
                role="option"
                aria-selected="false"
                className={`marca-menu-item${esOficial ? ' marca-menu-item--oficial' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSeleccionar(item.textoCompleto)}
                aria-label={item.textoCompleto}
              >
                {item.textoMostrado}
              </button>
            );
          })
        )}
      </div>
    );
  }

  // Submenú CARTEL
  if (submenu === 'cartel') {
    return (
      <div
        ref={containerRef}
        className="marca-menu marca-menu--submenu"
        role="listbox"
        aria-label="Submenú de carteles para marca"
      >
        <button
          key="volver"
          type="button"
          role="option"
          aria-selected="false"
          className="marca-menu-item marca-menu-item--nav marca-menu-item--volver"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleVolver}
          aria-label="‹ VOLVER, volver al menú principal"
        >
          ‹ VOLVER
        </button>
        {MARCA_TEXTOS_CARTEL.map((textoCompleto) => {
          const textoMostrado = textoCompleto.replace(/^cartel\s+/i, '');
          return (
            <button
              key={textoCompleto}
              type="button"
              role="option"
              aria-selected="false"
              className="marca-menu-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSeleccionar(textoCompleto)}
              aria-label={textoCompleto}
            >
              {textoMostrado}
            </button>
          );
        })}
      </div>
    );
  }

  // Nivel superior (50 entradas: 49 textos principales + CARTEL ›)
  return (
    <div
      ref={containerRef}
      className="marca-menu"
      role="listbox"
      aria-label="Menú de textos predefinidos para marca"
    >
      {TOP_LEVEL_ENTRIES.map((entry) => {
        if (entry.type === 'cartel_group') {
          return (
            <button
              key="cartel-group"
              type="button"
              role="option"
              aria-selected="false"
              className="marca-menu-item marca-menu-item--nav marca-menu-item--cartel"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenCartel}
              aria-label="CARTEL ›, abrir submenú"
            >
              {entry.textoMostrado}
            </button>
          );
        }
        const esOficial = esTerminoOficial(entry.textoCompleto);
        return (
          <button
            key={entry.textoCompleto}
            type="button"
            role="option"
            aria-selected="false"
            className={`marca-menu-item${esOficial ? ' marca-menu-item--oficial' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSeleccionar(entry.textoCompleto)}
            aria-label={entry.textoCompleto}
          >
            {entry.textoMostrado}
          </button>
        );
      })}
    </div>
  );
}
