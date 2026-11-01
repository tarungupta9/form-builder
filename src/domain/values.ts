import { assertNever } from './assertNever';
import type { FieldValue } from './response';

export type ParsedDecimal =
  { status: 'empty' } | { status: 'invalid' } | { status: 'ok'; value: number; decimals: number };

// Digits with an optional fraction and sign. No exponents, thousands separators or `Infinity`,
// which `Number()` would otherwise accept.
const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)$/;

/** Parses what the user typed into a Number field. Whitespace around the number is ignored. */
export function parseDecimal(input: string): ParsedDecimal {
  const text = input.trim();
  if (text === '') return { status: 'empty' };
  if (!DECIMAL.test(text)) return { status: 'invalid' };
  const fraction = text.split('.')[1] ?? '';
  return { status: 'ok', value: Number(text), decimals: fraction.length };
}

/** The number a Number value holds, or `null` when it is empty or not a number. */
export function numberOf(value: FieldValue | undefined): number | null {
  if (value?.kind !== 'number') return null;
  const parsed = parseDecimal(value.input);
  return parsed.status === 'ok' ? parsed.value : null;
}

/**
 * Whether a value counts as "no answer". Conditions on an empty target are inactive (D-4), and
 * a required field with an empty value fails validation.
 */
export function isEmptyValue(value: FieldValue | undefined): boolean {
  if (value === undefined) return true;
  switch (value.kind) {
    case 'text':
      return value.value.trim() === '';
    case 'number':
      return value.input.trim() === '';
    case 'date':
    case 'choice':
      return value.value === null;
    case 'multi':
    case 'files':
      return value.value.length === 0;
    default:
      return assertNever(value);
  }
}
