import { describe, it, expect } from 'vitest';
import {
  MARCA_TEXTOS_MAIN,
  MARCA_TEXTOS_CARTEL,
  filtrarMarcaTextos,
  coincideFiltro,
  normalizarTexto,
  ETIQUETAS_VALIDAS,
  isEtiquetaValida,
} from './marcaTextos';

describe('marcaTextos — listas y orden alfabético', () => {
  it('la lista principal contiene exactamente 38 textos de señales de ruta', () => {
    expect(MARCA_TEXTOS_MAIN).toHaveLength(38);
  });

  it('el grupo cartel contiene exactamente 31 textos', () => {
    expect(MARCA_TEXTOS_CARTEL).toHaveLength(31);
  });

  it('ninguno de los 11 términos oficiales está en la lista principal de MARCA', () => {
    for (const termino of ETIQUETAS_VALIDAS) {
      expect(MARCA_TEXTOS_MAIN).not.toContain(termino);
      expect(MARCA_TEXTOS_CARTEL).not.toContain(termino);
    }
  });

  it('todos los textos de la lista principal son señales de ruta en minúsculas', () => {
    for (const texto of MARCA_TEXTOS_MAIN) {
      expect(texto).toBe(texto.toLowerCase());
    }
  });

  it('todos los textos de carteles inician con "cartel "', () => {
    for (const texto of MARCA_TEXTOS_CARTEL) {
      expect(texto.startsWith('cartel ')).toBe(true);
    }
  });

  it('la lista principal está ordenada con colación en español, insensible a acentos', () => {
    const idx = (t: string) => MARCA_TEXTOS_MAIN.indexOf(t);

    // alcantarilla al inicio y vías tren al final
    expect(MARCA_TEXTOS_MAIN[0]).toBe('alcantarilla');
    expect(MARCA_TEXTOS_MAIN[MARCA_TEXTOS_MAIN.length - 1]).toBe('vías tren');

    // badén después de árbol
    expect(idx('árbol')).toBeLessThan(idx('badén'));
  });

  it('el grupo cartel está ordenado alfabéticamente', () => {
    const idx = (t: string) => MARCA_TEXTOS_CARTEL.indexOf(t);
    expect(idx('cartel amarillo')).toBeLessThan(idx('cartel azul'));
    expect(idx('cartel curva derecha')).toBeLessThan(idx('cartel curva izquierda'));
    expect(idx('cartel máxima 60')).toBeLessThan(idx('cartel máxima 80'));
    expect(MARCA_TEXTOS_CARTEL[0]).toBe('cartel amarillo');
    expect(MARCA_TEXTOS_CARTEL[MARCA_TEXTOS_CARTEL.length - 1]).toBe('cartel verde');
  });
});

describe('marcaTextos — normalizarTexto', () => {
  it('convierte a minúsculas y quita acentos', () => {
    expect(normalizarTexto('ÁRBOL')).toBe('arbol');
    expect(normalizarTexto('NEUTRALIZACIÓN')).toBe('neutralizacion');
    expect(normalizarTexto('badén')).toBe('baden');
    expect(normalizarTexto('garita parada ómnibus')).toBe('garita parada omnibus');
  });
});

describe('marcaTextos — coincideFiltro', () => {
  it('coincide de forma insensible a mayúsculas y acentos', () => {
    expect(coincideFiltro('árbol', 'arbol')).toBe(true);
    expect(coincideFiltro('badén', 'baden')).toBe(true);
  });

  it('coincide cuando cada palabra de la consulta está contenida en alguna palabra del texto', () => {
    expect(coincideFiltro('cartel curva derecha', 'curva')).toBe(true);
    expect(coincideFiltro('cartel curva derecha', 'curva cartel')).toBe(true);
    expect(coincideFiltro('cartel curva derecha', 'cur der')).toBe(true);
    expect(coincideFiltro('cartel curva derecha', 'curva izquierda')).toBe(false);
  });
});

describe('marcaTextos — filtrarMarcaTextos', () => {
  it('devuelve null cuando la consulta está vacía o es sólo espacios', () => {
    expect(filtrarMarcaTextos('')).toBeNull();
    expect(filtrarMarcaTextos('   ')).toBeNull();
  });

  it('devuelve coincidencias en la lista principal y carteles juntos con texto completo', () => {
    const res = filtrarMarcaTextos('curva');
    expect(res).not.toBeNull();
    const textos = res!.map((r) => r.textoCompleto);
    expect(textos).toContain('cartel curva derecha');
    expect(textos).toContain('cartel curva izquierda');
    const item = res!.find((r) => r.textoCompleto === 'cartel curva derecha');
    expect(item?.textoMostrado).toBe('cartel curva derecha');
  });

  it('busca textos principales sin importar acentos en la consulta', () => {
    const conAcento = filtrarMarcaTextos('árbol');
    const sinAcento = filtrarMarcaTextos('arbol');
    expect(conAcento?.map((r) => r.textoCompleto)).toContain('árbol');
    expect(sinAcento?.map((r) => r.textoCompleto)).toContain('árbol');
  });

  it('no encuentra términos oficiales porque fueron removidos del campo MARCA', () => {
    expect(filtrarMarcaTextos('AUTOLARGADA')).toEqual([]);
    expect(filtrarMarcaTextos('autocontrol')).toEqual([]);
    expect(filtrarMarcaTextos('neutralizacion')).toEqual([]);
  });

  it('devuelve array vacío cuando no hay coincidencias', () => {
    expect(filtrarMarcaTextos('texto que no existe 12345')).toEqual([]);
  });
});

describe('marcaTextos — ETIQUETAS_VALIDAS e isEtiquetaValida', () => {
  const terminosEsperados = [
    'AUTOCONTROL',
    'AUTOLARGADA',
    'CONTROL DE PASO',
    'CONTROL HORARIO',
    'CONTROL SECRETO',
    'ETAPA FIN',
    'ETAPA INICIO',
    'LARGADA',
    'LLEGADA',
    'NEUTRALIZACIÓN',
    'REINICIO',
  ];

  it('ETIQUETAS_VALIDAS contiene exactamente los 11 términos oficiales en orden alfabético español', () => {
    expect(ETIQUETAS_VALIDAS).toHaveLength(11);
    expect(ETIQUETAS_VALIDAS).toEqual(terminosEsperados);
  });

  it('isEtiquetaValida acepta "none" y todos los 11 términos oficiales canónicos', () => {
    expect(isEtiquetaValida('none')).toBe(true);
    for (const etiqueta of ETIQUETAS_VALIDAS) {
      expect(isEtiquetaValida(etiqueta)).toBe(true);
    }
  });

  it('isEtiquetaValida rechaza variantes en minúsculas, sin acentos o con espaciado incorrecto', () => {
    expect(isEtiquetaValida('autocontrol')).toBe(false);
    expect(isEtiquetaValida('Autocontrol')).toBe(false);
    expect(isEtiquetaValida('largada')).toBe(false);
    expect(isEtiquetaValida('control horario')).toBe(false);

    expect(isEtiquetaValida('NEUTRALIZACION')).toBe(false);
    expect(isEtiquetaValida('neutralizacion')).toBe(false);

    expect(isEtiquetaValida('  AUTOCONTROL  ')).toBe(false);
    expect(isEtiquetaValida(' none ')).toBe(false);
  });

  it('isEtiquetaValida rechaza cadenas vacías, valores desconocidos o no-string', () => {
    expect(isEtiquetaValida('')).toBe(false);
    expect(isEtiquetaValida('   ')).toBe(false);
    expect(isEtiquetaValida('OTHER')).toBe(false);
    expect(isEtiquetaValida('árbol')).toBe(false);
    expect(isEtiquetaValida('cartel curva derecha')).toBe(false);
    expect(isEtiquetaValida(null)).toBe(false);
    expect(isEtiquetaValida(undefined)).toBe(false);
    expect(isEtiquetaValida(123)).toBe(false);
    expect(isEtiquetaValida({})).toBe(false);
  });
});
