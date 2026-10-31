/**
 * Pure calculator state machine module for RR.
 *
 * Requirements:
 * - Pure logic: no React, DOM, or side effects.
 * - Left-to-right evaluation (no operator precedence).
 * - Immediate execution on operator or equals.
 * - At most 9 digits per input entry (sign and comma excluded).
 * - Avoid binary floating-point artifacts (0,1 + 0,2 = 0,3).
 * - Formatted result fits in 10 characters (including sign and comma),
 *   Argentine decimal comma, no thousands separators, no trailing zeros, never "-0".
 * - Division by zero -> "No se puede dividir por cero".
 * - Result overflow -> "Resultado demasiado grande".
 */

export type CalculatorOperator = '+' | '-' | '×' | '÷';

export type CalculatorKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | ','
  | '+' | '-' | '×' | '÷'
  | '='
  | 'C'
  | 'BACKSPACE'
  | '+/-';

export interface CalculatorState {
  display: string;
  accumulator: number | null;
  pendingOperator: CalculatorOperator | null;
  waitingForOperand: boolean;
  isResult: boolean;
  errorMessage: string | null;
}

export const INITIAL_CALCULATOR_STATE: Readonly<CalculatorState> = Object.freeze({
  display: '0',
  accumulator: null,
  pendingOperator: null,
  waitingForOperand: false,
  isResult: false,
  errorMessage: null,
});

export const ERROR_MESSAGES = {
  DIV_BY_ZERO: 'No se puede dividir por cero',
  OVERFLOW: 'Resultado demasiado grande',
} as const;

/**
 * Counts only digit characters (0-9), excluding negative sign and decimal comma.
 */
export function countDigits(str: string): number {
  return str.replace(/[^0-9]/g, '').length;
}

/**
 * Parses a display string formatted with Argentine comma into a JavaScript number.
 */
export function parseDisplayNumber(str: string): number {
  if (str === 'ERROR' || str === '' || str === '-') {
    return 0;
  }
  const normalized = str.replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Cleans binary floating-point artifacts by rounding to 12 significant digits.
 */
function cleanFloat(n: number): number {
  return parseFloat(n.toPrecision(12));
}

/**
 * Formats a raw arithmetic result into Argentine format:
 * - Max 10 characters total (including sign and comma).
 * - Decimal comma, no thousands separator, no trailing zeros, never "-0".
 * - If integer part alone cannot fit, returns overflow error.
 */
export function formatCalculatorResult(val: number): { formatted: string; error: string | null } {
  if (Number.isNaN(val) || !Number.isFinite(val)) {
    return { formatted: 'ERROR', error: ERROR_MESSAGES.OVERFLOW };
  }

  if (Object.is(val, -0) || val === 0) {
    return { formatted: '0', error: null };
  }

  const cleaned = cleanFloat(val);
  if (Object.is(cleaned, -0) || cleaned === 0) {
    return { formatted: '0', error: null };
  }

  const isNegative = cleaned < 0;
  const absVal = Math.abs(cleaned);

  // Integer part length check
  const intPart = Math.floor(absVal);
  const intStr = intPart.toString();
  const signLen = isNegative ? 1 : 0;
  const intTotalLen = signLen + intStr.length;

  if (intTotalLen > 10) {
    return { formatted: 'ERROR', error: ERROR_MESSAGES.OVERFLOW };
  }

  // Maximum decimals that can fit in remaining characters (leaving 1 char for comma)
  const maxDecimals = Math.max(0, 10 - intTotalLen - 1);

  let fixed = absVal.toFixed(maxDecimals);
  if (fixed.includes('.')) {
    fixed = fixed.replace(/\.?0+$/, '');
  }

  let resultStr = (isNegative && fixed !== '0' ? '-' : '') + fixed.replace('.', ',');
  if (resultStr === '-0') {
    resultStr = '0';
  }

  // If rounding up expanded the integer part (e.g. 9999999999.6 -> 10000000000)
  if (resultStr.length > 10) {
    const roundedIntStr = Math.floor(parseFloat(fixed)).toString();
    const newIntTotalLen = signLen + roundedIntStr.length;
    if (newIntTotalLen > 10) {
      return { formatted: 'ERROR', error: ERROR_MESSAGES.OVERFLOW };
    }
    const newMaxDecimals = Math.max(0, 10 - newIntTotalLen - 1);
    fixed = absVal.toFixed(newMaxDecimals).replace(/\.?0+$/, '');
    resultStr = (isNegative && fixed !== '0' ? '-' : '') + fixed.replace('.', ',');
    if (resultStr === '-0') {
      resultStr = '0';
    }
    if (resultStr.length > 10) {
      return { formatted: 'ERROR', error: ERROR_MESSAGES.OVERFLOW };
    }
  }

  return { formatted: resultStr, error: null };
}

/**
 * Executes a binary arithmetic operation.
 */
function evaluateOperation(
  a: number,
  b: number,
  op: CalculatorOperator
): { result: number | null; error: string | null } {
  if (op === '÷') {
    if (b === 0) {
      return { result: null, error: ERROR_MESSAGES.DIV_BY_ZERO };
    }
    return { result: a / b, error: null };
  }
  if (op === '×') {
    return { result: a * b, error: null };
  }
  if (op === '+') {
    return { result: a + b, error: null };
  }
  if (op === '-') {
    return { result: a - b, error: null };
  }
  return { result: b, error: null };
}

/**
 * Pure state transition function: (state, key) => nextState.
 */
export function stepCalculator(state: CalculatorState, key: CalculatorKey): CalculatorState {
  // ── 1. Clear All ('C') ─────────────────────────────────────────
  if (key === 'C') {
    return { ...INITIAL_CALCULATOR_STATE };
  }

  // ── 2. Error State Handling ────────────────────────────────────
  if (state.errorMessage !== null) {
    // In error: digits start a fresh entry; comma starts "0,"; all other keys are ignored
    if (/^[0-9]$/.test(key)) {
      return {
        ...INITIAL_CALCULATOR_STATE,
        display: key,
      };
    }
    if (key === ',') {
      return {
        ...INITIAL_CALCULATOR_STATE,
        display: '0,',
      };
    }
    return state;
  }

  // ── 3. Digits ('0' - '9') ──────────────────────────────────────
  if (/^[0-9]$/.test(key)) {
    // If starting fresh after equals
    if (state.isResult) {
      return {
        ...INITIAL_CALCULATOR_STATE,
        display: key,
      };
    }

    // If waiting for the second operand after an operator
    if (state.waitingForOperand) {
      return {
        ...state,
        display: key,
        waitingForOperand: false,
        isResult: false,
      };
    }

    // Currently typing an entry
    // Check 9-digit limit (excluding sign and comma)
    if (countDigits(state.display) >= 9) {
      return state;
    }

    // Leading zero handling: "0" then "5" -> "5", "0" then "0" -> "0"
    if (state.display === '0') {
      return {
        ...state,
        display: key,
      };
    }
    if (state.display === '-0') {
      return {
        ...state,
        display: key === '0' ? '-0' : `-${key}`,
      };
    }

    return {
      ...state,
      display: state.display + key,
    };
  }

  // ── 4. Decimal Comma (',') ─────────────────────────────────────
  if (key === ',') {
    if (state.isResult) {
      return {
        ...INITIAL_CALCULATOR_STATE,
        display: '0,',
      };
    }

    if (state.waitingForOperand) {
      return {
        ...state,
        display: '0,',
        waitingForOperand: false,
        isResult: false,
      };
    }

    // Only one decimal comma per number
    if (state.display.includes(',')) {
      return state;
    }

    return {
      ...state,
      display: state.display + ',',
    };
  }

  // ── 5. Backspace ('BACKSPACE') ─────────────────────────────────
  if (key === 'BACKSPACE') {
    // Backspace does nothing on a computed result or before typing second operand
    if (state.isResult || state.waitingForOperand) {
      return state;
    }

    // Removes the last character of the entry being typed; single char left shows "0"
    const next = state.display.slice(0, -1);
    if (next === '' || next === '-' || next === '-0') {
      return {
        ...state,
        display: '0',
      };
    }

    return {
      ...state,
      display: next,
    };
  }

  // ── 6. Plus / Minus ('+/-') ────────────────────────────────────
  if (key === '+/-') {
    // After an operator is pressed but before second operand is typed,
    // it applies to the second operand being typed (which is zero / unstarted).
    // Plus/minus does nothing on zero.
    if (state.waitingForOperand) {
      return state;
    }

    // Does nothing on zero (including "0", "0,", "0,0")
    if (parseDisplayNumber(state.display) === 0) {
      return state;
    }

    if (state.display.startsWith('-')) {
      return {
        ...state,
        display: state.display.slice(1),
      };
    }

    return {
      ...state,
      display: '-' + state.display,
    };
  }

  // ── 7. Binary Operators ('+', '-', '×', '÷') ───────────────────
  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    const currentVal = parseDisplayNumber(state.display);

    // If no operator is pending yet
    if (state.pendingOperator === null) {
      return {
        ...state,
        accumulator: currentVal,
        pendingOperator: key,
        waitingForOperand: true,
        isResult: false,
      };
    }

    // If operator is already pending and user hasn't typed second operand yet:
    // "Pressing two operators in a row replaces the pending operator (does not evaluate)"
    if (state.waitingForOperand) {
      return {
        ...state,
        pendingOperator: key,
      };
    }

    // Evaluate immediate left-to-right operation
    const evalRes = evaluateOperation(state.accumulator ?? 0, currentVal, state.pendingOperator);
    if (evalRes.error !== null || evalRes.result === null) {
      return {
        display: 'ERROR',
        accumulator: null,
        pendingOperator: null,
        waitingForOperand: false,
        isResult: false,
        errorMessage: evalRes.error ?? ERROR_MESSAGES.OVERFLOW,
      };
    }

    const formatted = formatCalculatorResult(evalRes.result);
    if (formatted.error !== null) {
      return {
        display: 'ERROR',
        accumulator: null,
        pendingOperator: null,
        waitingForOperand: false,
        isResult: false,
        errorMessage: formatted.error,
      };
    }

    return {
      display: formatted.formatted,
      accumulator: parseDisplayNumber(formatted.formatted),
      pendingOperator: key,
      waitingForOperand: true,
      isResult: false,
      errorMessage: null,
    };
  }

  // ── 8. Equals ('=') ────────────────────────────────────────────
  if (key === '=') {
    // If no pending operator, equals does nothing
    if (state.pendingOperator === null) {
      return state;
    }

    // "Equals with a pending operator but no second operand entered does nothing."
    if (state.waitingForOperand) {
      return state;
    }

    const currentVal = parseDisplayNumber(state.display);
    const evalRes = evaluateOperation(state.accumulator ?? 0, currentVal, state.pendingOperator);

    if (evalRes.error !== null || evalRes.result === null) {
      return {
        display: 'ERROR',
        accumulator: null,
        pendingOperator: null,
        waitingForOperand: false,
        isResult: false,
        errorMessage: evalRes.error ?? ERROR_MESSAGES.OVERFLOW,
      };
    }

    const formatted = formatCalculatorResult(evalRes.result);
    if (formatted.error !== null) {
      return {
        display: 'ERROR',
        accumulator: null,
        pendingOperator: null,
        waitingForOperand: false,
        isResult: false,
        errorMessage: formatted.error,
      };
    }

    return {
      display: formatted.formatted,
      accumulator: parseDisplayNumber(formatted.formatted),
      pendingOperator: null,
      waitingForOperand: false,
      isResult: true,
      errorMessage: null,
    };
  }

  return state;
}

/**
 * Alias for stepCalculator matching standard reducer naming.
 */
export const calculatorReducer = stepCalculator;

/**
 * Returns the display string from state.
 */
export function getCalculatorDisplay(state: CalculatorState): string {
  return state.display;
}

/**
 * Returns current error message (or null).
 */
export function getCalculatorErrorMessage(state: CalculatorState): string | null {
  return state.errorMessage;
}

/**
 * Returns pending operator (or null).
 */
export function getCalculatorPendingOperator(state: CalculatorState): CalculatorOperator | null {
  return state.pendingOperator;
}
