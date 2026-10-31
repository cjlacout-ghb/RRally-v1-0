import { describe, it, expect } from 'vitest';
import {
  INITIAL_CALCULATOR_STATE,
  stepCalculator,
  getCalculatorDisplay,
  getCalculatorErrorMessage,
  getCalculatorPendingOperator,
  formatCalculatorResult,
  parseDisplayNumber,
  countDigits,
  ERROR_MESSAGES,
  type CalculatorState,
  type CalculatorKey,
} from './calculator';

function feedKeys(initial: CalculatorState, keys: CalculatorKey[]): CalculatorState {
  return keys.reduce((state, key) => stepCalculator(state, key), initial);
}

describe('Calculator Logic', () => {
  describe('Helper functions', () => {
    it('counts digits correctly ignoring sign and comma', () => {
      expect(countDigits('12345')).toBe(5);
      expect(countDigits('-123,45')).toBe(5);
      expect(countDigits('0,00000000')).toBe(9);
    });

    it('parses Argentine comma numbers into JS numbers', () => {
      expect(parseDisplayNumber('0')).toBe(0);
      expect(parseDisplayNumber('14,82')).toBe(14.82);
      expect(parseDisplayNumber('-3,5')).toBe(-3.5);
      expect(parseDisplayNumber('ERROR')).toBe(0);
      expect(parseDisplayNumber('5,')).toBe(5);
    });

    it('formats results avoiding binary floating-point artifacts', () => {
      expect(formatCalculatorResult(0.1 + 0.2)).toEqual({ formatted: '0,3', error: null });
      expect(formatCalculatorResult(10 / 4)).toEqual({ formatted: '2,5', error: null });
      expect(formatCalculatorResult(1 / 3)).toEqual({ formatted: '0,33333333', error: null });
      expect(formatCalculatorResult(-10 / 3)).toEqual({ formatted: '-3,3333333', error: null });
    });

    it('formats zero correctly and never produces -0', () => {
      expect(formatCalculatorResult(0)).toEqual({ formatted: '0', error: null });
      expect(formatCalculatorResult(-0)).toEqual({ formatted: '0', error: null });
      expect(formatCalculatorResult(-0.000000000001)).toEqual({ formatted: '0', error: null });
    });

    it('removes trailing zeros and trailing commas', () => {
      expect(formatCalculatorResult(2.0)).toEqual({ formatted: '2', error: null });
      expect(formatCalculatorResult(2.5)).toEqual({ formatted: '2,5', error: null });
      expect(formatCalculatorResult(2.500000)).toEqual({ formatted: '2,5', error: null });
    });

    it('flags integer overflow when result cannot fit in 10 characters', () => {
      expect(formatCalculatorResult(10000000000)).toEqual({
        formatted: 'ERROR',
        error: ERROR_MESSAGES.OVERFLOW,
      });
      expect(formatCalculatorResult(-1000000000)).toEqual({
        formatted: 'ERROR',
        error: ERROR_MESSAGES.OVERFLOW,
      });
      expect(formatCalculatorResult(9999999999.6)).toEqual({
        formatted: 'ERROR',
        error: ERROR_MESSAGES.OVERFLOW,
      });
    });
  });

  describe('Basic operations', () => {
    it('performs addition: 7 + 8 = 15', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['7', '+', '8', '=']);
      expect(getCalculatorDisplay(state)).toBe('15');
      expect(getCalculatorErrorMessage(state)).toBeNull();
      expect(getCalculatorPendingOperator(state)).toBeNull();
    });

    it('performs subtraction: 15 - 9 = 6', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '5', '-', '9', '=']);
      expect(getCalculatorDisplay(state)).toBe('6');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });

    it('performs multiplication: 6 × 7 = 42', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['6', '×', '7', '=']);
      expect(getCalculatorDisplay(state)).toBe('42');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });

    it('performs division: 10 ÷ 4 = 2,5', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '0', '÷', '4', '=']);
      expect(getCalculatorDisplay(state)).toBe('2,5');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });
  });

  describe('Chaining operations and left-to-right evaluation', () => {
    it('evaluates immediate left-to-right: 2 + 3 × 4 = 20', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['2', '+', '3', '×', '4', '=']);
      expect(getCalculatorDisplay(state)).toBe('20');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });

    it('displays intermediate result when an operator is pressed during chaining', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['2', '+', '3', '×']);
      expect(getCalculatorDisplay(state)).toBe('5');
      expect(getCalculatorPendingOperator(state)).toBe('×');
    });

    it('chains multiple operations: 10 - 2 ÷ 4 + 3 = 5', () => {
      // 10 - 2 = 8; 8 ÷ 4 = 2; 2 + 3 = 5
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '0', '-', '2', '÷', '4', '+', '3', '=']);
      expect(getCalculatorDisplay(state)).toBe('5');
    });
  });

  describe('Operator replacement', () => {
    it('replaces pending operator when pressed consecutively: 5 + - 3 = 2', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '-', '3', '=']);
      expect(getCalculatorDisplay(state)).toBe('2');
    });

    it('replaces operator multiple times', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '×', '÷', '-', '2', '=']);
      expect(getCalculatorDisplay(state)).toBe('3');
    });

    it('equals with a pending operator but no second operand entered does nothing', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '=']);
      expect(getCalculatorDisplay(state)).toBe('5');
      expect(getCalculatorPendingOperator(state)).toBe('+');
      // Afterwards, entering second operand and equals works
      const finalState = feedKeys(state, ['2', '=']);
      expect(getCalculatorDisplay(finalState)).toBe('7');
    });
  });

  describe('Equals behavior: continuing vs starting brand-new entry', () => {
    it('pressing an operator after equals continues with the result as first operand', () => {
      const state1 = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '5', '=']);
      expect(getCalculatorDisplay(state1)).toBe('10');

      const state2 = feedKeys(state1, ['+', '2', '=']);
      expect(getCalculatorDisplay(state2)).toBe('12');
    });

    it('entering a digit after equals starts a brand-new entry', () => {
      const state1 = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '5', '=']);
      expect(getCalculatorDisplay(state1)).toBe('10');

      const state2 = feedKeys(state1, ['3']);
      expect(getCalculatorDisplay(state2)).toBe('3');

      const state3 = feedKeys(state2, ['+', '2', '=']);
      expect(getCalculatorDisplay(state3)).toBe('5');
    });

    it('entering a comma after equals starts a brand-new entry "0,"', () => {
      const state1 = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '5', '=']);
      const state2 = feedKeys(state1, [',', '5', '=']);
      expect(getCalculatorDisplay(state2)).toBe('0,5');
    });
  });

  describe('Leading zeros and decimal comma rules', () => {
    it('does not accumulate leading zeros: 0 then 5 shows 5', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['0', '0', '5']);
      expect(getCalculatorDisplay(state)).toBe('5');
    });

    it('produces "0," when comma is typed first', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [',', '5']);
      expect(getCalculatorDisplay(state)).toBe('0,5');
    });

    it('produces "0," when comma is typed first for the second operand', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', ',']);
      expect(getCalculatorDisplay(state)).toBe('0,');
      const finalState = feedKeys(state, ['2', '=']);
      expect(getCalculatorDisplay(finalState)).toBe('5,2');
    });

    it('allows only one decimal comma per number', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', ',', '2', ',', '3']);
      expect(getCalculatorDisplay(state)).toBe('5,23');
    });

    it('accumulates zeros after decimal comma correctly', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', ',', '0', '0', '7']);
      expect(getCalculatorDisplay(state)).toBe('5,007');
    });
  });

  describe('Backspace edge cases', () => {
    it('removes last character of entry being typed', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '2', '3', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('12');
    });

    it('shows "0" when single character remains and backspace is pressed', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('0');
    });

    it('shows "0" when "-5" has backspace pressed', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+/-', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('0');
    });

    it('removes comma when backspace is pressed on "0,"', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [',', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('0');
    });

    it('removes comma when backspace is pressed on "12,"', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '2', ',', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('12');
    });

    it('does nothing on "0"', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('0');
    });

    it('does nothing on a computed result', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['2', '+', '3', '=', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('5');
    });

    it('does nothing when waiting for second operand', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', 'BACKSPACE']);
      expect(getCalculatorDisplay(state)).toBe('5');
      expect(getCalculatorPendingOperator(state)).toBe('+');
    });
  });

  describe('Sign toggle (+/-)', () => {
    it('does nothing on zero', () => {
      const state1 = feedKeys(INITIAL_CALCULATOR_STATE, ['+/-']);
      expect(getCalculatorDisplay(state1)).toBe('0');

      const state2 = feedKeys(INITIAL_CALCULATOR_STATE, [',', '+/-']);
      expect(getCalculatorDisplay(state2)).toBe('0,');

      const state3 = feedKeys(INITIAL_CALCULATOR_STATE, ['0', ',', '0', '+/-']);
      expect(getCalculatorDisplay(state3)).toBe('0,0');
    });

    it('toggles sign on single operand: 5 -> -5 -> 5', () => {
      let state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+/-']);
      expect(getCalculatorDisplay(state)).toBe('-5');
      state = feedKeys(state, ['+/-']);
      expect(getCalculatorDisplay(state)).toBe('5');
    });

    it('toggles sign on computed result and can continue calculation', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['3', '+', '2', '=', '+/-']);
      expect(getCalculatorDisplay(state)).toBe('-5');
      const next = feedKeys(state, ['+', '2', '=']);
      expect(getCalculatorDisplay(next)).toBe('-3');
    });

    it('applies to second operand being typed after an operator is pressed', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '3', '+/-', '=']);
      expect(getCalculatorDisplay(state)).toBe('2'); // 5 + (-3) = 2
    });

    it('does nothing if pressed after operator before typing second operand', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+', '+/-']);
      expect(getCalculatorDisplay(state)).toBe('5');
      expect(getCalculatorPendingOperator(state)).toBe('+');
    });

    it('handles negative minus negative: -5 - (-3) = -2', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '+/-', '-', '3', '+/-', '=']);
      expect(getCalculatorDisplay(state)).toBe('-2');
    });
  });

  describe('9-digit input limit', () => {
    it('limits entry to at most 9 digits (extra digits ignored)', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1',
      ]);
      expect(getCalculatorDisplay(state)).toBe('123456789');
    });

    it('does not count sign or comma against the 9-digit limit', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [
        '1', '2', '3', ',', '4', '5', '6', '7', '8', '9', '0',
      ]);
      // '123,456789' has 9 digits + 1 comma = 10 chars. Extra digit '0' is ignored.
      expect(getCalculatorDisplay(state)).toBe('123,456789');

      const negState = feedKeys(state, ['+/-']);
      expect(getCalculatorDisplay(negState)).toBe('-123,456789');
    });
  });

  describe('Floating point precision and Argentine formatting', () => {
    it('avoids floating point artifacts: 0,1 + 0,2 = 0,3', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [',', '1', '+', ',', '2', '=']);
      expect(getCalculatorDisplay(state)).toBe('0,3');
    });

    it('formats negative results properly: 3 - 5 = -2', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['3', '-', '5', '=']);
      expect(getCalculatorDisplay(state)).toBe('-2');
    });

    it('never produces -0', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['0', '×', '5', '+/-', '=']);
      expect(getCalculatorDisplay(state)).toBe('0');
    });

    it('fits results in 10 characters reducing decimals as needed', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['1', '÷', '3', '=']);
      expect(getCalculatorDisplay(state)).toBe('0,33333333');
      expect(getCalculatorDisplay(state).length).toBe(10);
    });
  });

  describe('Division by zero and recovery from error', () => {
    it('enters error state on division by zero: 5 ÷ 0 = ERROR', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '=']);
      expect(getCalculatorDisplay(state)).toBe('ERROR');
      expect(getCalculatorErrorMessage(state)).toBe(ERROR_MESSAGES.DIV_BY_ZERO);
    });

    it('enters error state on chained division by zero: 5 ÷ 0 +', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '+']);
      expect(getCalculatorDisplay(state)).toBe('ERROR');
      expect(getCalculatorErrorMessage(state)).toBe(ERROR_MESSAGES.DIV_BY_ZERO);
    });

    it('ignores operators, equals, backspace, and +/- while in error', () => {
      let state = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '=']);
      expect(getCalculatorDisplay(state)).toBe('ERROR');

      state = stepCalculator(state, '+');
      expect(getCalculatorDisplay(state)).toBe('ERROR');

      state = stepCalculator(state, '=');
      expect(getCalculatorDisplay(state)).toBe('ERROR');

      state = stepCalculator(state, 'BACKSPACE');
      expect(getCalculatorDisplay(state)).toBe('ERROR');

      state = stepCalculator(state, '+/-');
      expect(getCalculatorDisplay(state)).toBe('ERROR');
    });

    it('recovers from error by typing a digit (starts fresh entry)', () => {
      const errState = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '=']);
      const state = stepCalculator(errState, '3');
      expect(getCalculatorDisplay(state)).toBe('3');
      expect(getCalculatorErrorMessage(state)).toBeNull();
      expect(getCalculatorPendingOperator(state)).toBeNull();

      // Can continue calculating
      const next = feedKeys(state, ['+', '2', '=']);
      expect(getCalculatorDisplay(next)).toBe('5');
    });

    it('recovers from error with C (clear all)', () => {
      const errState = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '=']);
      const state = stepCalculator(errState, 'C');
      expect(getCalculatorDisplay(state)).toBe('0');
      expect(getCalculatorErrorMessage(state)).toBeNull();
      expect(getCalculatorPendingOperator(state)).toBeNull();
    });

    it('recovers from error by typing a comma (starts fresh entry "0,")', () => {
      const errState = feedKeys(INITIAL_CALCULATOR_STATE, ['5', '÷', '0', '=']);
      const state = stepCalculator(errState, ',');
      expect(getCalculatorDisplay(state)).toBe('0,');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });
  });

  describe('Large result overflow', () => {
    it('enters error state when integer part exceeds 10 characters', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [
        '9', '9', '9', '9', '9', '9', '9', '9', '9',
        '×',
        '9', '9', '9', '9', '9', '9', '9', '9', '9',
        '=',
      ]);
      expect(getCalculatorDisplay(state)).toBe('ERROR');
      expect(getCalculatorErrorMessage(state)).toBe(ERROR_MESSAGES.OVERFLOW);
    });

    it('recovers from overflow error with C or digits', () => {
      const state = feedKeys(INITIAL_CALCULATOR_STATE, [
        '9', '9', '9', '9', '9', '9', '9', '9', '9',
        '×',
        '9', '9', '9', '9', '9', '9', '9', '9', '9',
        '=',
        'C',
      ]);
      expect(getCalculatorDisplay(state)).toBe('0');
      expect(getCalculatorErrorMessage(state)).toBeNull();
    });
  });
});
