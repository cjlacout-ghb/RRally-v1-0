import type { CalculatorKey, CalculatorState } from '../logic/calculator';
import './CalculadoraTab.css';

interface CalculadoraTabProps {
  state: CalculatorState;
  onKeyPress: (key: CalculatorKey) => void;
}

interface KeyConfig {
  key: CalculatorKey;
  label: string;
  ariaLabel: string;
  isPending?: boolean;
  isEquals?: boolean;
  isSpan2?: boolean;
  isOperator?: boolean;
}

export function CalculadoraTab({ state, onKeyPress }: CalculadoraTabProps) {
  const keys: KeyConfig[] = [
    // Row 1
    { key: 'C', label: 'C', ariaLabel: 'Borrar todo' },
    { key: 'BACKSPACE', label: '⌫', ariaLabel: 'Borrar último dígito' },
    { key: '+/-', label: '+/-', ariaLabel: 'Cambiar signo' },
    {
      key: '÷',
      label: '÷',
      ariaLabel: 'Dividir',
      isPending: state.pendingOperator === '÷',
      isOperator: true,
    },
    // Row 2
    { key: '7', label: '7', ariaLabel: '7' },
    { key: '8', label: '8', ariaLabel: '8' },
    { key: '9', label: '9', ariaLabel: '9' },
    {
      key: '×',
      label: '×',
      ariaLabel: 'Multiplicar',
      isPending: state.pendingOperator === '×',
      isOperator: true,
    },
    // Row 3
    { key: '4', label: '4', ariaLabel: '4' },
    { key: '5', label: '5', ariaLabel: '5' },
    { key: '6', label: '6', ariaLabel: '6' },
    {
      key: '-',
      label: '-',
      ariaLabel: 'Restar',
      isPending: state.pendingOperator === '-',
      isOperator: true,
    },
    // Row 4
    { key: '1', label: '1', ariaLabel: '1' },
    { key: '2', label: '2', ariaLabel: '2' },
    { key: '3', label: '3', ariaLabel: '3' },
    {
      key: '+',
      label: '+',
      ariaLabel: 'Sumar',
      isPending: state.pendingOperator === '+',
      isOperator: true,
    },
    // Row 5
    { key: '0', label: '0', ariaLabel: '0', isSpan2: true },
    { key: ',', label: ',', ariaLabel: 'Coma decimal' },
    { key: '=', label: '=', ariaLabel: 'Igual', isEquals: true },
  ];

  return (
    <div className="calculadora-screen" data-testid="calculadora-content">
      {/* ── Single display line card ──────────────────────────────── */}
      <div className="calc-display-card" data-testid="calc-display-card">
        <div
          className="calc-display-text"
          data-testid="calc-display-text"
          role="status"
          aria-live="polite"
        >
          {state.display}
        </div>
      </div>

      {/* ── Error message line directly below display ─────────────── */}
      <div
        className="calc-message-line"
        data-testid="calc-message-line"
        role="alert"
        aria-live="polite"
      >
        {state.errorMessage || '\u00A0'}
      </div>

      {/* ── Keypad ────────────────────────────────────────────────── */}
      <div className="calc-keypad" role="group" aria-label="Teclado de calculadora">
        {keys.map((k) => {
          let className = 'calc-key';
          if (k.isOperator) className += ' calc-key--operator';
          if (k.isEquals) className += ' calc-key--equals';
          if (k.isSpan2) className += ' calc-key--span-2';
          if (k.isPending) className += ' calc-key--pending';

          return (
            <button
              key={k.key}
              type="button"
              className={className}
              aria-label={k.ariaLabel}
              data-testid={`calc-key-${k.key}`}
              onClick={() => onKeyPress(k.key)}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
