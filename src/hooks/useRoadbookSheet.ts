/**
 * React hook for reading and writing the loaded roadbook sheet.
 */

import { useState, useCallback, useRef } from 'react';
import {
  readRoadbookSheet,
  writeRoadbookSheet,
  clearAllRoadbookData,
} from '../storage';
import {
  addSheetRows,
  clearRowInSheet,
  sanitizeMarkText,
  validateRowSpeed,
  ROWS_ADD_CHUNK,
  MAX_SHEET_ROWS,
  type RoadbookRow,
} from '../logic/roadbookModel';
import type { SaveResult } from '../storage';

export interface UseRoadbookSheetResult {
  rows: RoadbookRow[];
  addRows: () => void;
  updateRow: (rowId: string, changes: Partial<Pick<RoadbookRow, 'mark' | 'assignedTimeSeconds' | 'speedKmH'>>) => SaveResult;
  clearRow: (rowId: string) => SaveResult;
  clearAllRows: () => SaveResult;
  replaceSheet: (rows: RoadbookRow[]) => SaveResult;
}

export function useRoadbookSheet(): UseRoadbookSheetResult {
  const [rows, setRows] = useState<RoadbookRow[]>(() => readRoadbookSheet());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const persist = useCallback((newRows: RoadbookRow[]): SaveResult => {
    const result = writeRoadbookSheet(newRows);
    if (result.ok) {
      setRows(newRows);
    }
    return result;
  }, []);

  const addRows = useCallback(() => {
    const updated = addSheetRows(rowsRef.current, ROWS_ADD_CHUNK, MAX_SHEET_ROWS);
    const result = writeRoadbookSheet(updated);
    if (result.ok) {
      setRows(updated);
    }
  }, []);

  const updateRow = useCallback(
    (
      rowId: string,
      changes: Partial<Pick<RoadbookRow, 'mark' | 'assignedTimeSeconds' | 'speedKmH'>>
    ): SaveResult => {
      const updated = rowsRef.current.map((row) => {
        if (row.id !== rowId) return row;
        const mark = 'mark' in changes ? sanitizeMarkText(changes.mark) : row.mark;
        const assignedTimeSeconds =
          'assignedTimeSeconds' in changes
            ? changes.assignedTimeSeconds ?? null
            : row.assignedTimeSeconds;
        const speedKmH =
          'speedKmH' in changes ? validateRowSpeed(changes.speedKmH) : row.speedKmH;
        return { ...row, mark, assignedTimeSeconds, speedKmH };
      });
      const result = writeRoadbookSheet(updated);
      if (result.ok) {
        setRows(updated);
      }
      return result;
    },
    []
  );

  const clearRow = useCallback(
    (rowId: string): SaveResult => {
      const updated = clearRowInSheet(rowsRef.current, rowId);
      const result = writeRoadbookSheet(updated);
      if (result.ok) {
        setRows(updated);
      }
      return result;
    },
    []
  );

  const clearAllRows = useCallback((): SaveResult => {
    const { rows: initialRows, saveResult } = clearAllRoadbookData();
    if (saveResult.ok) {
      setRows(initialRows);
    }
    return saveResult;
  }, []);

  const replaceSheet = useCallback(
    (newRows: RoadbookRow[]): SaveResult => {
      return persist(newRows);
    },
    [persist]
  );

  return { rows, addRows, updateRow, clearRow, clearAllRows, replaceSheet };
}
