/**
 * Textos predefinidos para el campo MARCA y etiquetas de la hoja de ruta.
 *
 * Fuente única de verdad:
 * - ETIQUETAS_VALIDAS contiene exclusivamente los 11 términos oficiales de carrera.
 * - MARCA_TEXTOS_MAIN contiene exclusivamente las 38 señales de ruta en minúsculas.
 * - MARCA_TEXTOS_CARTEL contiene los 31 textos del grupo CARTEL.
 *
 * Los grupos se ordenan al cargar el módulo con colación española,
 * insensible a mayúsculas y acentos.
 */

/** Comparador de orden español, insensible a mayúsculas y acentos. */
const esCollator = new Intl.Collator('es', {
  sensitivity: 'base',
  usage: 'sort',
});

function sortEs(arr: readonly string[]): string[] {
  return [...arr].sort((a, b) => esCollator.compare(a, b));
}

/**
 * Los 11 términos oficiales de carrera, en su forma canónica en mayúsculas.
 * Fuente única de verdad para las etiquetas oficiales de carrera (ETIQUETAS_VALIDAS).
 */
const TERMINOS_OFICIALES_CANONICOS = [
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
] as const;

/**
 * Lista ordenada (con colación española) de los 11 términos oficiales de carrera.
 * Es la fuente única de verdad para los valores válidos del campo `etiqueta`
 * de cada fila de hoja de ruta.
 */
export const ETIQUETAS_VALIDAS: readonly string[] = sortEs(TERMINOS_OFICIALES_CANONICOS);

/**
 * Determina si un valor es una etiqueta de fila válida (uno de los 11 términos oficiales
 * canónicos en mayúsculas) o "none".
 * - "none" → válido (sin etiqueta asignada).
 * - Un término oficial canónico en mayúsculas → válido.
 * - Cualquier otro valor (vacío, desconocido, minúsculas, con acento diferente) → inválido.
 * La comparación es de igualdad estricta sobre la cadena canónica.
 */
export function isEtiquetaValida(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === 'none') return true;
  return ETIQUETAS_VALIDAS.includes(value);
}

/**
 * Los 38 textos principales del campo MARCA (únicamente señales de ruta en minúsculas).
 * Los 11 términos oficiales han sido removidos y pertenecen exclusivamente a ETIQUETAS_VALIDAS.
 */
const MARCA_TEXTOS_MAIN_RAW = [
  'alcantarilla',
  'antena',
  'árbol',
  'badén',
  'cables alta tensión',
  'cambio de velocidad',
  'cementerio',
  'chapón rojo y amarillo',
  'chapón rojo y blanco',
  'cinta',
  'columna alumbrado',
  'cubierta blanca',
  'cubierta negra',
  'cubierta tractor',
  'divisorio vertical',
  'edificación',
  'escuela',
  'estación de servicio',
  'garita parada ómnibus',
  'gomería',
  'guardacanto',
  'guardarail',
  'iglesia',
  'ingreso',
  'kiosko',
  'loma de burro',
  'mojón km',
  'pantalla electrónica',
  'portal ingreso',
  'poste con cables',
  'poste con cámara',
  'poste pintado',
  'puente',
  'rotonda',
  'semáforo',
  'tranquera',
  'transformador',
  'vías tren',
] as const;

/**
 * Los 31 textos del grupo CARTEL, almacenados como texto completo
 * incluyendo la palabra "cartel".
 */
const MARCA_TEXTOS_CARTEL_RAW = [
  'cartel amarillo',
  'cartel azul',
  'cartel blanco',
  'cartel camino lateral',
  'cartel camino resbaladizo',
  'cartel camiones',
  'cartel ceda el paso',
  'cartel cruce caminos',
  'cartel cruce peatonal',
  'cartel curva derecha',
  'cartel curva izquierda',
  'cartel escuela',
  'cartel estrella amarilla',
  'cartel estrella negra',
  'cartel ferrocarril',
  'cartel gris',
  'cartel incorporación camino',
  'cartel luces bajas',
  'cartel mantener derecha',
  'cartel marrón',
  'cartel máxima 60',
  'cartel máxima 80',
  'cartel negro',
  'cartel no adelantar',
  'cartel parada ómnibus',
  'cartel puente',
  'cartel redondo atrás',
  'cartel retome',
  'cartel rombo atrás',
  'cartel uso cinturón',
  'cartel verde',
] as const;

/** Conjunto para exclusión garantizada de términos oficiales. */
const oficialesSet = new Set<string>(ETIQUETAS_VALIDAS);

/**
 * Lista principal ordenada (38 textos). Excluye rigurosamente los 11 términos oficiales.
 */
export const MARCA_TEXTOS_MAIN: readonly string[] = sortEs(
  MARCA_TEXTOS_MAIN_RAW.filter((t) => !oficialesSet.has(t))
);

/** Lista completa del grupo cartel, ordenada (31 textos con prefijo "cartel"). */
export const MARCA_TEXTOS_CARTEL: readonly string[] = sortEs(MARCA_TEXTOS_CARTEL_RAW);

/**
 * Normaliza una cadena para comparación: minúsculas, sin acentos ni diacríticos.
 */
export function normalizarTexto(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Estructura de un ítem para el menú de textos de marca.
 */
export interface MarcaMenuItem {
  /** Texto completo que se escribe en la fila al seleccionar. */
  textoCompleto: string;
  /** Texto mostrado en la interfaz. */
  textoMostrado: string;
}

/**
 * Lista combinada de todos los textos de MARCA (38 principales + 31 carteles = 69 textos)
 * ordenados alfabéticamente para la búsqueda filtrada.
 */
const TODOS_TEXTOS_ORDENADOS: readonly string[] = sortEs([
  ...MARCA_TEXTOS_MAIN,
  ...MARCA_TEXTOS_CARTEL,
]);

/**
 * Comprueba si un texto coincide con la consulta.
 * Un texto coincide cuando cada palabra de la consulta está contenida
 * en alguna palabra del texto, de forma insensible a mayúsculas y acentos.
 */
export function coincideFiltro(texto: string, consulta: string): boolean {
  const palabrasConsulta = normalizarTexto(consulta).trim().split(/\s+/).filter(Boolean);
  if (palabrasConsulta.length === 0) return true;

  const palabrasTexto = normalizarTexto(texto).trim().split(/\s+/).filter(Boolean);
  return palabrasConsulta.every((pConsulta) =>
    palabrasTexto.some((pTexto) => pTexto.includes(pConsulta))
  );
}

/**
 * Filtra los textos de MARCA (principales + carteles juntos) según la consulta escrita.
 * - Si la consulta está vacía o contiene sólo espacios, devuelve null (indica modo jerárquico normal).
 * - Si no está vacía, devuelve la lista plana de ítems coincidentes con su texto completo.
 * - Si no hay coincidencias, devuelve un array vacío [].
 */
export function filtrarMarcaTextos(consulta: string): MarcaMenuItem[] | null {
  const trimmed = consulta.trim();
  if (trimmed === '') {
    return null;
  }

  const matches: MarcaMenuItem[] = [];
  for (const texto of TODOS_TEXTOS_ORDENADOS) {
    if (coincideFiltro(texto, trimmed)) {
      matches.push({
        textoCompleto: texto,
        textoMostrado: texto,
      });
    }
  }

  return matches;
}
