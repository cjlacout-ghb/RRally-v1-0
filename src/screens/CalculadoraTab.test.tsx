import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CalculadoraTab } from './CalculadoraTab';
import { INITIAL_CALCULATOR_STATE, type CalculatorState } from '../logic/calculator';

describe('CalculadoraTab Component', () => {
  it('renders display with initial "0" and empty message line', () => {
    const html = renderToString(
      <CalculadoraTab state={INITIAL_CALCULATOR_STATE} onKeyPress={() => {}} />
    );

    expect(html).toContain('class="calc-display-text"');
    expect(html).toContain('>0</div>');
    expect(html).toContain('class="calc-message-line"');
  });

  it('renders all 19 keys with proper Spanish aria-labels', () => {
    const html = renderToString(
      <CalculadoraTab state={INITIAL_CALCULATOR_STATE} onKeyPress={() => {}} />
    );

    // Row 1
    expect(html).toContain('aria-label="Borrar todo"');
    expect(html).toContain('aria-label="Borrar último dígito"');
    expect(html).toContain('aria-label="Cambiar signo"');
    expect(html).toContain('aria-label="Dividir"');

    // Row 2
    expect(html).toContain('aria-label="7"');
    expect(html).toContain('aria-label="8"');
    expect(html).toContain('aria-label="9"');
    expect(html).toContain('aria-label="Multiplicar"');

    // Row 3
    expect(html).toContain('aria-label="4"');
    expect(html).toContain('aria-label="5"');
    expect(html).toContain('aria-label="6"');
    expect(html).toContain('aria-label="Restar"');

    // Row 4
    expect(html).toContain('aria-label="1"');
    expect(html).toContain('aria-label="2"');
    expect(html).toContain('aria-label="3"');
    expect(html).toContain('aria-label="Sumar"');

    // Row 5
    expect(html).toContain('aria-label="0"');
    expect(html).toContain('aria-label="Coma decimal"');
    expect(html).toContain('aria-label="Igual"');

    // Check symbols / labels rendered
    expect(html).toContain('>C</button>');
    expect(html).toContain('>⌫</button>');
    expect(html).toContain('>+/-</button>');
    expect(html).toContain('>÷</button>');
    expect(html).toContain('>×</button>');
    expect(html).toContain('>-</button>');
    expect(html).toContain('>+</button>');
    expect(html).toContain('>,</button>');
    expect(html).toContain('>=</button>');
  });

  it('highlights pending operator key with pending class', () => {
    const stateWithPendingOp: CalculatorState = {
      ...INITIAL_CALCULATOR_STATE,
      display: '12',
      accumulator: 12,
      pendingOperator: '÷',
      waitingForOperand: true,
    };

    const html = renderToString(
      <CalculadoraTab state={stateWithPendingOp} onKeyPress={() => {}} />
    );

    // Dividir button has calc-key--pending
    expect(html).toMatch(/class="[^"]*calc-key--pending[^"]*"[^>]*aria-label="Dividir"/);
    // Multiplicar does not have calc-key--pending
    expect(html).not.toMatch(/class="[^"]*calc-key--pending[^"]*"[^>]*aria-label="Multiplicar"/);
  });

  it('renders error message in the message line during error state', () => {
    const errorState: CalculatorState = {
      ...INITIAL_CALCULATOR_STATE,
      display: 'ERROR',
      errorMessage: 'No se puede dividir por cero',
    };

    const html = renderToString(
      <CalculadoraTab state={errorState} onKeyPress={() => {}} />
    );

    expect(html).toContain('>ERROR</div>');
    expect(html).toContain('No se puede dividir por cero');
  });

  it('applies calc-key--equals and calc-key--span-2 correctly', () => {
    const html = renderToString(
      <CalculadoraTab state={INITIAL_CALCULATOR_STATE} onKeyPress={() => {}} />
    );

    // Equals key has calc-key--equals
    expect(html).toMatch(/class="[^"]*calc-key--equals[^"]*"[^>]*aria-label="Igual"/);

    // Zero key has calc-key--span-2
    expect(html).toMatch(/class="[^"]*calc-key--span-2[^"]*"[^>]*aria-label="0"/);
  });

  it('applies calc-key--operator to the four operators and not to digits or other keys', () => {
    const html = renderToString(
      <CalculadoraTab state={INITIAL_CALCULATOR_STATE} onKeyPress={() => {}} />
    );

    expect(html).toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Dividir"/);
    expect(html).toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Multiplicar"/);
    expect(html).toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Restar"/);
    expect(html).toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Sumar"/);

    // Non-operator keys must NOT have calc-key--operator
    expect(html).not.toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Borrar todo"/);
    expect(html).not.toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="Igual"/);
    expect(html).not.toMatch(/class="[^"]*calc-key--operator[^"]*"[^>]*aria-label="7"/);
  });
});
