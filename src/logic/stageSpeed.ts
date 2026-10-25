/**
 * Stage speed input: parsing and validation.
 * Accepts both decimal comma (Argentine) and decimal point.
 * No UI code here — pure functions only.
 */

export type ParseErrorReason = 'empty' | 'invalid' | 'zero' | 'negative' | 'too-high';

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: ParseErrorReason };

/** Maximum allowed stage speed (km/h) — matches the dial maximum. */
export const STAGE_SPEED_MAX = 120;

/**
 * Parses a user-typed string into a number.
 * Accepts decimal comma (49,8) or decimal point (49.8).
 * Trims surrounding whitespace.
 * Returns a ParseResult; does not throw.
 */
export function parseStageSpeed(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: 'empty' };
  }

  // Normalise: replace comma with dot so Number() can parse it.
  const normalised = trimmed.replace(',', '.');

  const value = Number(normalised);

  if (Number.isNaN(value) || normalised === '') {
    return { ok: false, error: 'invalid' };
  }

  return validateStageSpeed(value);
}

/**
 * Validates an already-numeric speed value.
 */
export function validateStageSpeed(value: number): ParseResult {
  if (value < 0) {
    return { ok: false, error: 'negative' };
  }
  if (value === 0) {
    return { ok: false, error: 'zero' };
  }
  if (value > STAGE_SPEED_MAX) {
    return { ok: false, error: 'too-high' };
  }
  return { ok: true, value };
}

/** Spanish error messages for each error reason. */
export const STAGE_SPEED_ERROR_MESSAGES: Record<ParseErrorReason, string> = {
  empty: 'Ingresá la velocidad media de la etapa.',
  invalid: 'El valor ingresado no es un número válido.',
  zero: 'La velocidad debe ser mayor que cero.',
  negative: 'La velocidad debe ser mayor que cero.',
  'too-high': `La velocidad no puede superar los ${STAGE_SPEED_MAX} km/h.`,
};
