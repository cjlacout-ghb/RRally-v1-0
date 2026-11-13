/**
 * Textos predefinidos para el campo MARCA de la hoja de ruta.
 *
 * Fuente única de verdad: agregar o editar un texto requiere
 * modificar únicamente este módulo.
 *
 * Los dos grupos se ordenan al cargar el módulo con colación española,
 * insensible a mayúsculas y acentos, para que "árbol", "AUTOCONTROL"
 * y "NEUTRALIZACIÓN" queden en su posición alfabética correcta.
 */

/** Comparador de orden español, insensible a mayúsculas y acentos. */
const esCollator = new Intl.Collator('es', {
  sensitivity: 'base',
  usage: 'sort',
});

function sortEs(arr: readonly string[]): string[] {
  return [...arr].sort((a, b) => esCollator.compare(a, b));
}

/** Los 49 textos principales del campo MARCA. */
const MARCA_TEXTOS_MAIN_RAW = [
  'alcantarilla',
  'antena',
  'árbol',
  'AUTOCONTROL',
  'AUTOLARGADA',
  'badén',
  'cables alta tensión',
  'cambio de velocidad',
  'cementerio',
  'chapón rojo y amarillo',
  'chapón rojo y blanco',
  'cinta',
  'columna alumbrado',
  'CONTROL DE PASO',
  'CONTROL HORARIO',
  'CONTROL SECRETO',
  'cubierta blanca',
  'cubierta negra',
  'cubierta tractor',
  'divisorio vertical',
  'edificación',
  'escuela',
  'estación de servicio',
  'ETAPA FIN',
  'ETAPA INICIO',
  'garita parada ómnibus',
  'gomería',
  'guardacanto',
  'guardarail',
  'iglesia',
  'ingreso',
  'kiosko',
  'LARGADA',
  'LLEGADA',
  'loma de burro',
  'mojón km',
  'NEUTRALIZACIÓN',
  'pantalla electrónica',
  'portal ingreso',
  'poste con cables',
  'poste con cámara',
  'poste pintado',
  'puente',
  'REINICIO',
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

/** Lista principal ordenada (49 textos). */
export const MARCA_TEXTOS_MAIN: readonly string[] = sortEs(MARCA_TEXTOS_MAIN_RAW);

/** Lista completa del grupo cartel, ordenada (31 textos con prefijo "cartel"). */
export const MARCA_TEXTOS_CARTEL: readonly string[] = sortEs(MARCA_TEXTOS_CARTEL_RAW);

/**
 * Conjunto de los 11 términos oficiales de carrera, derivados de la lista principal
 * (textos escritos totalmente en mayúsculas).
 *
 * Fuente única de verdad para el énfasis visual oficial:
 * AUTOCONTROL, AUTOLARGADA, CONTROL DE PASO, CONTROL HORARIO, CONTROL SECRETO,
 * ETAPA FIN, ETAPA INICIO, LARGADA, LLEGADA, NEUTRALIZACIÓN, REINICIO.
 */
const TERMINOS_OFICIALES_SET: ReadonlySet<string> = new Set(
  MARCA_TEXTOS_MAIN_RAW.filter((t) => t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t))
);

/**
 * Determina si un texto de marca corresponde a un término oficial de carrera.
 * Un término oficial se renderiza con color brass (secondary) y peso negrita.
 */
export function esTerminoOficial(texto: string): boolean {
  return TERMINOS_OFICIALES_SET.has(texto);
}

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
 * Lista combinada de todos los textos (principales + carteles) ordenados alfabéticamente
 * para la búsqueda filtrada.
 */
const TODOS_TEXTOS_ORDENADOS: readonly string[] = sortEs([
  ...MARCA_TEXTOS_MAIN_RAW,
  ...MARCA_TEXTOS_CARTEL_RAW,
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
 * Filtra los textos (principales + carteles juntos) según la consulta escrita.
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
