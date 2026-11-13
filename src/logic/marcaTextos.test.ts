import { describe, it, expect } from 'vitest';
import {
  MARCA_TEXTOS_MAIN,
  MARCA_TEXTOS_CARTEL,
  filtrarMarcaTextos,
  coincideFiltro,
  normalizarTexto,
  esTerminoOficial,
} from './marcaTextos';

describe('marcaTextos — listas y orden alfabético', () => {
  it('la lista principal contiene exactamente 49 textos', () => {
    expect(MARCA_TEXTOS_MAIN).toHaveLength(49);
  });

  it('el grupo cartel contiene exactamente 31 textos', () => {
    expect(MARCA_TEXTOS_CARTEL).toHaveLength(31);
  });

  it('AUTOLARGADA y CONTROL HORARIO están en la lista principal', () => {
    expect(MARCA_TEXTOS_MAIN).toContain('AUTOLARGADA');
    expect(MARCA_TEXTOS_MAIN).toContain('CONTROL HORARIO');
  });

  it('FIN no está en la lista principal ni en el grupo cartel', () => {
    expect(MARCA_TEXTOS_MAIN).not.toContain('FIN');
    expect(MARCA_TEXTOS_CARTEL).not.toContain('FIN');
  });

  it('todos los textos de carteles inician con "cartel "', () => {
    for (const texto of MARCA_TEXTOS_CARTEL) {
      expect(texto.startsWith('cartel ')).toBe(true);
    }
  });

  it('la lista principal está ordenada con colación en español, insensible a mayúsculas y acentos', () => {
    const idx = (t: string) => MARCA_TEXTOS_MAIN.indexOf(t);

    // árbol debe ir antes de AUTOCONTROL, y este antes de AUTOLARGADA
    expect(idx('árbol')).toBeLessThan(idx('AUTOCONTROL'));
    expect(idx('AUTOCONTROL')).toBeLessThan(idx('AUTOLARGADA'));

    // NEUTRALIZACIÓN debe ir entre mojón km y pantalla electrónica
    expect(idx('mojón km')).toBeLessThan(idx('NEUTRALIZACIÓN'));
    expect(idx('NEUTRALIZACIÓN')).toBeLessThan(idx('pantalla electrónica'));

    // alcantarilla al inicio y vías tren al final
    expect(MARCA_TEXTOS_MAIN[0]).toBe('alcantarilla');
    expect(MARCA_TEXTOS_MAIN[MARCA_TEXTOS_MAIN.length - 1]).toBe('vías tren');
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
    expect(coincideFiltro('NEUTRALIZACIÓN', 'neutralizacion')).toBe(true);
    expect(coincideFiltro('AUTOLARGADA', 'autolargada')).toBe(true);
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
    // Para carteles filtrados, textoMostrado es el texto completo
    const item = res!.find((r) => r.textoCompleto === 'cartel curva derecha');
    expect(item?.textoMostrado).toBe('cartel curva derecha');
  });

  it('busca textos principales sin importar acentos en la consulta', () => {
    const conAcento = filtrarMarcaTextos('árbol');
    const sinAcento = filtrarMarcaTextos('arbol');
    expect(conAcento?.map((r) => r.textoCompleto)).toContain('árbol');
    expect(sinAcento?.map((r) => r.textoCompleto)).toContain('árbol');
  });

  it('busca NEUTRALIZACIÓN y AUTOLARGADA', () => {
    const resNeu = filtrarMarcaTextos('neutralizacion');
    expect(resNeu?.map((r) => r.textoCompleto)).toContain('NEUTRALIZACIÓN');

    const resAuto = filtrarMarcaTextos('autolargada');
    expect(resAuto?.map((r) => r.textoCompleto)).toContain('AUTOLARGADA');
  });

  it('devuelve array vacío cuando no hay coincidencias', () => {
    const res = filtrarMarcaTextos('xyztextoinexistente999');
    expect(res).not.toBeNull();
    expect(res).toEqual([]);
  });
});

describe('marcaTextos — esTerminoOficial', () => {
  it('identifica exactamente 11 términos oficiales de carrera en la lista principal', () => {
    const oficialesEnMain = MARCA_TEXTOS_MAIN.filter((t) => esTerminoOficial(t));
    expect(oficialesEnMain).toHaveLength(11);
  });

  it('devuelve true para cada uno de los 11 términos oficiales en mayúsculas', () => {
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

    for (const termino of terminosEsperados) {
      expect(esTerminoOficial(termino)).toBe(true);
    }
  });

  it('devuelve false para todos los textos en minúsculas y para todos los carteles', () => {
    const noOficialesEnMain = MARCA_TEXTOS_MAIN.filter((t) => !esTerminoOficial(t));
    expect(noOficialesEnMain).toHaveLength(49 - 11);

    for (const cartel of MARCA_TEXTOS_CARTEL) {
      expect(esTerminoOficial(cartel)).toBe(false);
    }
  });
});
