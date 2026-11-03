/**
 * Roadbook sheet model, constants, and helper logic.
 */

import { formatSpeed } from './format';

export const INITIAL_SHEET_ROWS = 50;
export const ROWS_ADD_CHUNK = 10;
export const MAX_SHEET_ROWS = 300;
export const MAX_MARK_TEXT_LENGTH = 40;

export const QUICK_TEXTS = [
  'AUTOLARGADA',
  'AUTOCONTROL',
  'NEUTRALIZACIÓN',
  'CONTROL HORARIO',
  'FIN',
] as const;

export type QuickText = typeof QUICK_TEXTS[number];

export interface RoadbookRow {
  id: string;
  mark: string;
  assignedTimeSeconds: number | null;
  speedKmH: number | null;
}

export interface RoadbookCounts {
  loaded: number;
  total: number;
}

/**
 * Counts rows with an assigned time (loaded) vs total rows in the sheet.
 * Single source of truth for sheet loading counters across the app.
 */
export function countLoadedRows(rows: RoadbookRow[]): RoadbookCounts {
  const loaded = rows.filter(
    (r) => r.assignedTimeSeconds !== null && !Number.isNaN(r.assignedTimeSeconds)
  ).length;
  return { loaded, total: rows.length };
}

/**
 * Formats the loaded rows counter as "N DE M FILAS"
 * (e.g. "0 DE 50 FILAS", "38 DE 50 FILAS", "38 DE 60 FILAS").
 */
export function formatRoadbookCounter(rows: RoadbookRow[]): string {
  const { loaded, total } = countLoadedRows(rows);
  return `${loaded} DE ${total} FILAS`;
}

/**
 * Sanitizes mark text: trims whitespace and limits length to MAX_MARK_TEXT_LENGTH.
 */
export function sanitizeMarkText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  return text.trim().slice(0, MAX_MARK_TEXT_LENGTH);
}

/**
 * Validates roadbook speed in km/h.
 * Must be a positive finite number (> 0). Invalid input is treated as null.
 */
export function validateRowSpeed(speed: unknown): number | null {
  if (speed === null || speed === undefined) return null;
  const num = typeof speed === 'number' ? speed : Number(speed);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/**
 * Creates a single empty roadbook row.
 */
export function createEmptyRow(idOrIndex: string | number): RoadbookRow {
  const id = typeof idOrIndex === 'string' ? idOrIndex : `row-${idOrIndex}`;
  return {
    id,
    mark: '',
    assignedTimeSeconds: null,
    speedKmH: null,
  };
}

/**
 * Creates an initial sheet with 50 empty rows.
 */
export function createInitialSheet(rowCount: number = INITIAL_SHEET_ROWS): RoadbookRow[] {
  const count = Math.min(Math.max(1, rowCount), MAX_SHEET_ROWS);
  return Array.from({ length: count }, (_, i) => createEmptyRow(i + 1));
}

/**
 * Adds empty rows to the sheet (default 10), respecting the maximum limit of 300 rows.
 */
export function addSheetRows(
  rows: RoadbookRow[],
  count: number = ROWS_ADD_CHUNK,
  maxRows: number = MAX_SHEET_ROWS
): RoadbookRow[] {
  if (rows.length >= maxRows) {
    return rows;
  }
  const toAdd = Math.min(count, maxRows - rows.length);
  if (toAdd <= 0) return rows;

  const startIndex = rows.length + 1;
  const newRows = Array.from({ length: toAdd }, (_, i) => createEmptyRow(startIndex + i));
  return [...rows, ...newRows];
}

/**
 * Returns the effective speed of a row: its own speed if set (> 0),
 * otherwise the nearest previous row's effective speed, otherwise null.
 */
export function getEffectiveSpeed(rows: RoadbookRow[], rowIndex: number): number | null {
  if (rowIndex < 0 || rowIndex >= rows.length) return null;

  for (let i = rowIndex; i >= 0; i--) {
    const s = rows[i].speedKmH;
    if (s !== null && Number.isFinite(s) && s > 0) {
      return s;
    }
  }
  return null;
}

export interface RowSpeedDisplay {
  /** The formatted speed string (e.g. "60,0" or "--") */
  text: string;
  /** Whether the displayed speed is inherited from a previous row */
  isInherited: boolean;
  /** Whether the row has an explicit speed typed (> 0) */
  isExplicit: boolean;
}

/**
 * Returns the speed display info for a row in Cargar Hoja:
 * - If row has explicitly typed speed (> 0): shows formatted speed (explicit / brass).
 * - If row is empty (no mark text AND no assigned time): shows "--" (dimmed), regardless of inherited speed.
 * - If row is in use (has mark text OR assigned time) and has no explicit speed:
 *     inherits the nearest previous row's speed (dimmed), or "--" if no previous speed exists.
 */
export function getRowDisplaySpeed(rows: RoadbookRow[], rowIndex: number): RowSpeedDisplay {
  if (rowIndex < 0 || rowIndex >= rows.length) {
    return { text: '--', isInherited: false, isExplicit: false };
  }

  const row = rows[rowIndex];
  if (row.speedKmH !== null && Number.isFinite(row.speedKmH) && row.speedKmH > 0) {
    return {
      text: formatSpeed(row.speedKmH),
      isInherited: false,
      isExplicit: true,
    };
  }

  // Row has no explicit speed. Check if row is in use.
  const hasMark = typeof row.mark === 'string' && row.mark.trim().length > 0;
  const hasTime = row.assignedTimeSeconds !== null && !Number.isNaN(row.assignedTimeSeconds);
  const isInUse = hasMark || hasTime;

  if (!isInUse) {
    return { text: '--', isInherited: false, isExplicit: false };
  }

  // Row is in use, inherit from nearest previous row
  for (let i = rowIndex - 1; i >= 0; i--) {
    const s = rows[i].speedKmH;
    if (s !== null && Number.isFinite(s) && s > 0) {
      return {
        text: formatSpeed(s),
        isInherited: true,
        isExplicit: false,
      };
    }
  }

  return { text: '--', isInherited: false, isExplicit: false };
}
