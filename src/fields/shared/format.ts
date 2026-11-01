/**
 * How Number and Date answers read to people: in the hint, the error message and the export.
 * Both use the browser's locale, the same as the submission timestamp (`ui/format.ts`).
 */
import type { IsoDate } from '../../domain/ids';
import type { Decimals } from '../../domain/template';

/** A number with exactly `decimals` places, grouped for the user's locale ("1,234.50"). */
export function formatNumber(value: number, decimals: Decimals): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** "$" + "18.40", "12" + " kg": a word-like suffix gets a space, a symbol ("%") does not. */
export function withAdornments(text: string, prefix: string, suffix: string): string {
  const spacer = /^\p{L}/u.test(suffix) ? ' ' : '';
  return `${prefix}${text}${suffix ? spacer + suffix : ''}`;
}

/**
 * A local calendar date as a long date in the user's locale ("1 November 2026"). Built from
 * its parts, not `new Date('2026-11-01')`, which parses as UTC midnight and shows the previous
 * day anywhere west of UTC (D-16).
 */
export function formatIsoDate(isoDate: IsoDate): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
    new Date(year, month - 1, day),
  );
}
