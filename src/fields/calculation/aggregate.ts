import { assertNever } from '../../domain/assertNever';
import type { Aggregation, Decimals } from '../../domain/template';

/**
 * Combines the filled-in source values. Empty sources are ignored, so Average divides by the
 * number of filled sources; with no filled sources the result is empty, never 0 (D-14).
 */
export function aggregate(
  values: readonly number[],
  aggregation: Aggregation,
  decimals: Decimals,
): number | null {
  if (values.length === 0) return null;
  const raw = combine(values, aggregation);
  return roundTo(raw, decimals);
}

function combine(values: readonly number[], aggregation: Aggregation): number {
  switch (aggregation) {
    case 'sum':
      return values.reduce((total, value) => total + value, 0);
    case 'average':
      return values.reduce((total, value) => total + value, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return assertNever(aggregation);
  }
}

/**
 * Half away from zero, with a nudge so binary floating point does not round 1.005 down to 1.00.
 * `-0` is normalised to `0` so a result never prints as "-0".
 */
export function roundTo(value: number, decimals: Decimals): number {
  const factor = 10 ** decimals;
  const rounded =
    (Math.sign(value) * Math.round(Math.abs(value) * factor * (1 + Number.EPSILON))) / factor;
  return rounded === 0 ? 0 : rounded;
}
