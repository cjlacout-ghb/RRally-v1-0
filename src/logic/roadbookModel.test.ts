import { describe, it, expect } from 'vitest';
import {
  createInitialSheet,
  addSheetRows,
  createEmptyRow,
  getEffectiveSpeed,
  getRowDisplaySpeed,
  sanitizeMarkText,
  validateRowSpeed,
  countLoadedRows,
  formatRoadbookCounter,
  INITIAL_SHEET_ROWS,
  ROWS_ADD_CHUNK,
  MAX_SHEET_ROWS,
  MAX_MARK_TEXT_LENGTH,
  QUICK_TEXTS,
  RoadbookRow,
} from './roadbookModel';

describe('roadbookModel', () => {
  it('creates an initial sheet with 50 empty rows', () => {
    const sheet = createInitialSheet();
    expect(sheet).toHaveLength(INITIAL_SHEET_ROWS);
    expect(sheet[0]).toEqual({
      id: 'row-1',
      mark: '',
      assignedTimeSeconds: null,
      speedKmH: null,
    });
    expect(sheet[49].id).toBe('row-50');
  });

  it('adds 10 rows when addSheetRows is called', () => {
    const sheet = createInitialSheet();
    const updated = addSheetRows(sheet, ROWS_ADD_CHUNK);
    expect(updated).toHaveLength(60);
    expect(updated[50].id).toBe('row-51');
    expect(updated[59].id).toBe('row-60');
  });

  it('enforces maximum row limit of 300', () => {
    let sheet = createInitialSheet(); // 50
    for (let i = 0; i < 30; i++) {
      sheet = addSheetRows(sheet, 10);
    }
    expect(sheet).toHaveLength(MAX_SHEET_ROWS);

    // Calling addSheetRows again should not exceed 300
    const extra = addSheetRows(sheet, 10);
    expect(extra).toHaveLength(MAX_SHEET_ROWS);
  });

  it('partially adds rows if approaching the maximum limit', () => {
    const sheet: RoadbookRow[] = Array.from({ length: 295 }, (_, i) => createEmptyRow(i + 1));
    const updated = addSheetRows(sheet, 10);
    expect(updated).toHaveLength(300);
  });

  it('inherits speed from nearest previous row (effective speed)', () => {
    const rows: RoadbookRow[] = [
      { id: '1', mark: 'Start', assignedTimeSeconds: 0, speedKmH: null },
      { id: '2', mark: 'PC1', assignedTimeSeconds: 100, speedKmH: 50 },
      { id: '3', mark: 'PC2', assignedTimeSeconds: 200, speedKmH: null },
      { id: '4', mark: 'PC3', assignedTimeSeconds: 300, speedKmH: null },
      { id: '5', mark: 'PC4', assignedTimeSeconds: 400, speedKmH: 60 },
      { id: '6', mark: 'PC5', assignedTimeSeconds: 500, speedKmH: null },
    ];

    expect(getEffectiveSpeed(rows, 0)).toBeNull(); // leading blank
    expect(getEffectiveSpeed(rows, 1)).toBe(50);
    expect(getEffectiveSpeed(rows, 2)).toBe(50); // inherited from row 1
    expect(getEffectiveSpeed(rows, 3)).toBe(50); // inherited from row 1
    expect(getEffectiveSpeed(rows, 4)).toBe(60); // own speed
    expect(getEffectiveSpeed(rows, 5)).toBe(60); // inherited from row 4
    expect(getEffectiveSpeed(rows, -1)).toBeNull();
    expect(getEffectiveSpeed(rows, 99)).toBeNull();
  });

  it('validates speed: must be a positive finite number (> 0)', () => {
    expect(validateRowSpeed(50)).toBe(50);
    expect(validateRowSpeed('61.5')).toBe(61.5);
    expect(validateRowSpeed(0)).toBeNull();
    expect(validateRowSpeed(-10)).toBeNull();
    expect(validateRowSpeed(NaN)).toBeNull();
    expect(validateRowSpeed(Infinity)).toBeNull();
    expect(validateRowSpeed(null)).toBeNull();
    expect(validateRowSpeed(undefined)).toBeNull();
    expect(validateRowSpeed('abc')).toBeNull();
  });

  it('sanitizes and truncates mark text to 40 characters', () => {
    expect(sanitizeMarkText('  Autocontrol  ')).toBe('Autocontrol');
    const longText = 'A'.repeat(50);
    const sanitized = sanitizeMarkText(longText);
    expect(sanitized).toHaveLength(MAX_MARK_TEXT_LENGTH);
    expect(sanitized).toBe('A'.repeat(40));
    expect(sanitizeMarkText(null)).toBe('');
    expect(sanitizeMarkText(undefined)).toBe('');
  });

  it('counts loaded rows and formats as N DE M FILAS', () => {
    const emptySheet = createInitialSheet(); // 50 rows
    expect(countLoadedRows(emptySheet)).toEqual({ loaded: 0, total: 50 });
    expect(formatRoadbookCounter(emptySheet)).toBe('0 DE 50 FILAS');

    // Load 38 rows
    for (let i = 0; i < 38; i++) {
      emptySheet[i].assignedTimeSeconds = (i + 1) * 10;
    }
    expect(countLoadedRows(emptySheet)).toEqual({ loaded: 38, total: 50 });
    expect(formatRoadbookCounter(emptySheet)).toBe('38 DE 50 FILAS');

    // Add 10 rows
    const expanded = addSheetRows(emptySheet, 10);
    expect(countLoadedRows(expanded)).toEqual({ loaded: 38, total: 60 });
    expect(formatRoadbookCounter(expanded)).toBe('38 DE 60 FILAS');
  });

  it('provides all 5 quick texts as constants', () => {
    expect(QUICK_TEXTS).toEqual([
      'AUTOLARGADA',
      'AUTOCONTROL',
      'NEUTRALIZACIÓN',
      'CONTROL HORARIO',
      'FIN',
    ]);
  });
});

describe('getRowDisplaySpeed', () => {
  const makeRow = (opts: Partial<RoadbookRow> & { id: string }): RoadbookRow => ({
    mark: '',
    assignedTimeSeconds: null,
    speedKmH: null,
    ...opts,
  });

  it('shows explicit (brass) speed for a row with its own speed set', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', speedKmH: 60, mark: 'START', assignedTimeSeconds: 0 }),
    ];
    const result = getRowDisplaySpeed(rows, 0);
    expect(result.text).toBe('60,0');
    expect(result.isExplicit).toBe(true);
    expect(result.isInherited).toBe(false);
  });

  it('shows "--" for an empty row (no mark, no time, no speed), regardless of previous rows', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', speedKmH: 60, mark: 'START', assignedTimeSeconds: 0 }),
      makeRow({ id: '2' }), // empty: no mark, no time, no speed
    ];
    const result = getRowDisplaySpeed(rows, 1);
    expect(result.text).toBe('--');
    expect(result.isExplicit).toBe(false);
    expect(result.isInherited).toBe(false);
  });

  it('shows inherited (dimmed) speed for an in-use row with no explicit speed', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', speedKmH: 50, mark: 'A', assignedTimeSeconds: 0 }),
      makeRow({ id: '2', mark: 'B', assignedTimeSeconds: 100 }), // in-use, no speed
    ];
    const result = getRowDisplaySpeed(rows, 1);
    expect(result.text).toBe('50,0');
    expect(result.isInherited).toBe(true);
    expect(result.isExplicit).toBe(false);
  });

  it('shows inherited speed when row has mark but no time', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', speedKmH: 40, mark: 'A', assignedTimeSeconds: 0 }),
      makeRow({ id: '2', mark: 'AUTOCONTROL' }), // mark only, no time
    ];
    const result = getRowDisplaySpeed(rows, 1);
    expect(result.text).toBe('40,0');
    expect(result.isInherited).toBe(true);
  });

  it('shows "--" for an in-use row with no previous speed available', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', mark: 'A', assignedTimeSeconds: 100 }), // in-use but no speed
    ];
    const result = getRowDisplaySpeed(rows, 0);
    expect(result.text).toBe('--');
    expect(result.isInherited).toBe(false);
    expect(result.isExplicit).toBe(false);
  });

  it('skips empty rows in between when searching for inherited speed', () => {
    const rows: RoadbookRow[] = [
      makeRow({ id: '1', speedKmH: 70, mark: 'A', assignedTimeSeconds: 0 }),
      makeRow({ id: '2' }), // empty — should not contribute to inheritance chain
      makeRow({ id: '3', mark: 'C', assignedTimeSeconds: 200 }),
    ];
    // Row 3 should inherit speed from row 1 (row 2 is empty but has a null speed, so skipped)
    const result = getRowDisplaySpeed(rows, 2);
    expect(result.text).toBe('70,0');
    expect(result.isInherited).toBe(true);
  });

  it('returns "--" for out-of-bounds indices', () => {
    const rows: RoadbookRow[] = [makeRow({ id: '1', speedKmH: 60, mark: 'X', assignedTimeSeconds: 0 })];
    expect(getRowDisplaySpeed(rows, -1).text).toBe('--');
    expect(getRowDisplaySpeed(rows, 99).text).toBe('--');
  });
});
