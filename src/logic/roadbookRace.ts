/**
 * Race marks state and deviation tracking for the Roadbook (Hoja de ruta).
 */

import { RoadbookRow } from './roadbookModel';
import { classifyDelta, DeltaState, NEUTRAL_BAND_SECONDS } from './delta';

export type RowMarkStatus = 'unmarked' | 'marked' | 'skipped';

export interface RowMark {
  status: RowMarkStatus;
  realElapsedMs?: number;
}

export type RoadbookAction =
  | { type: 'mark'; rowIndex: number; realElapsedMs: number }
  | { type: 'skip'; rowIndex: number };

export interface RoadbookRaceSnapshot {
  currentRowIndex: number | null;
  marks: Record<number, RowMark>;
  history: RoadbookAction[];
  isFinished: boolean;
  accumulatedDeviationSeconds: number | null;
  deltaState: DeltaState;
  lastMarkedRowIndex: number | null;
}

/**
 * Searches for the next loaded row (a row that has assignedTimeSeconds !== null)
 * starting at startIndex. Returns null if no further loaded row exists.
 */
export function findNextLoadedRowIndex(rows: RoadbookRow[], startIndex: number): number | null {
  for (let i = startIndex; i < rows.length; i++) {
    if (rows[i].assignedTimeSeconds !== null && !Number.isNaN(rows[i].assignedTimeSeconds!)) {
      return i;
    }
  }
  return null;
}

/**
 * Rounds elapsed milliseconds to displayed real seconds (with 1 decimal place),
 * using standard mathematical rounding (.x5 rounds up, .x4 rounds down).
 */
export function roundToDisplayedRealSeconds(realElapsedMs: number): number {
  return Math.round(realElapsedMs / 100) / 10;
}

/**
 * Computes deviation in seconds for a single marked row:
 * deviation = assignedTimeSeconds - displayedRealSeconds
 * Positive = ahead, negative = behind.
 *
 * Ensures mathematical consistency with displayed real time:
 * displayed deviation = assigned time - displayed real time.
 */
export function computeRowDeviation(
  assignedTimeSeconds: number | null | undefined,
  realElapsedMs: number | null | undefined
): number | null {
  if (
    assignedTimeSeconds === null ||
    assignedTimeSeconds === undefined ||
    Number.isNaN(assignedTimeSeconds) ||
    realElapsedMs === null ||
    realElapsedMs === undefined ||
    Number.isNaN(realElapsedMs)
  ) {
    return null;
  }
  const displayedRealSeconds = roundToDisplayedRealSeconds(realElapsedMs);
  const diff = assignedTimeSeconds - displayedRealSeconds;
  return Math.round(diff * 10) / 10;
}

export class RoadbookRaceTracker {
  private rows: RoadbookRow[];
  private marks: Record<number, RowMark> = {};
  private history: RoadbookAction[] = [];
  private currentRowIndex: number | null = null;
  private isFinishedState: boolean = false;

  constructor(
    rows: RoadbookRow[],
    initialMarks?: Record<number, RowMark>,
    initialHistory?: RoadbookAction[]
  ) {
    this.rows = rows;
    if (initialMarks && initialHistory) {
      this.marks = { ...initialMarks };
      this.history = [...initialHistory];
      this.reconstructState();
    } else {
      this.reset();
    }
  }

  private reconstructState(): void {
    const markedOrSkipped = new Set(this.history.map((h) => h.rowIndex));
    let next: number | null = null;
    for (let i = 0; i < this.rows.length; i++) {
      if (this.rows[i].assignedTimeSeconds !== null && !markedOrSkipped.has(i)) {
        next = i;
        break;
      }
    }
    this.currentRowIndex = next;
    this.isFinishedState = next === null;
  }

  setRows(rows: RoadbookRow[]): void {
    this.rows = rows;
    this.reconstructState();
  }

  /**
   * Captures the main stopwatch elapsed time in ms for the current row and advances.
   * Returns true if marked successfully, or false if race is finished / no current row.
   */
  mark(elapsedMs: number): boolean {
    if (this.isFinishedState || this.currentRowIndex === null) {
      return false;
    }
    const idx = this.currentRowIndex;
    const safeMs = Math.max(0, elapsedMs);

    this.marks[idx] = { status: 'marked', realElapsedMs: safeMs };
    this.history.push({ type: 'mark', rowIndex: idx, realElapsedMs: safeMs });

    const next = findNextLoadedRowIndex(this.rows, idx + 1);
    this.currentRowIndex = next;
    this.isFinishedState = next === null;
    return true;
  }

  /**
   * Marks the current row as skipped without a real time and advances.
   * Returns true if skipped successfully, or false if race is finished / no current row.
   */
  skip(): boolean {
    if (this.isFinishedState || this.currentRowIndex === null) {
      return false;
    }
    const idx = this.currentRowIndex;

    this.marks[idx] = { status: 'skipped' };
    this.history.push({ type: 'skip', rowIndex: idx });

    const next = findNextLoadedRowIndex(this.rows, idx + 1);
    this.currentRowIndex = next;
    this.isFinishedState = next === null;
    return true;
  }

  /**
   * Reverts the last mark or skip and moves the pointer back.
   * Does nothing and returns false if history is empty.
   */
  undo(): boolean {
    if (this.history.length === 0) {
      return false;
    }
    const lastAction = this.history.pop()!;
    delete this.marks[lastAction.rowIndex];
    this.currentRowIndex = lastAction.rowIndex;
    this.isFinishedState = false;
    return true;
  }

  /**
   * Clears all marks, history and pointer, keeping the loaded sheet.
   */
  reset(): void {
    this.marks = {};
    this.history = [];
    const first = findNextLoadedRowIndex(this.rows, 0);
    this.currentRowIndex = first;
    this.isFinishedState = first === null;
  }

  getCurrentRowIndex(): number | null {
    return this.currentRowIndex;
  }

  isFinished(): boolean {
    return this.isFinishedState;
  }

  getMarks(): Record<number, RowMark> {
    return { ...this.marks };
  }

  getHistory(): RoadbookAction[] {
    return [...this.history];
  }

  /**
   * Returns the row index of the last row that was marked (not skipped).
   */
  getLastMarkedRowIndex(): number | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'mark') {
        return this.history[i].rowIndex;
      }
    }
    return null;
  }

  /**
   * Returns the accumulated deviation in seconds of the last marked row (not skipped).
   * Returns null if no row has been marked yet.
   */
  getAccumulatedDeviation(): number | null {
    const lastIdx = this.getLastMarkedRowIndex();
    if (lastIdx === null) return null;

    const row = this.rows[lastIdx];
    const mark = this.marks[lastIdx];
    if (!row || !mark || mark.status !== 'marked' || mark.realElapsedMs === undefined) {
      return null;
    }
    return computeRowDeviation(row.assignedTimeSeconds, mark.realElapsedMs);
  }

  getSnapshot(): RoadbookRaceSnapshot {
    const dev = this.getAccumulatedDeviation();
    return {
      currentRowIndex: this.currentRowIndex,
      marks: { ...this.marks },
      history: [...this.history],
      isFinished: this.isFinishedState,
      accumulatedDeviationSeconds: dev,
      deltaState: classifyDelta(dev, NEUTRAL_BAND_SECONDS),
      lastMarkedRowIndex: this.getLastMarkedRowIndex(),
    };
  }
}
