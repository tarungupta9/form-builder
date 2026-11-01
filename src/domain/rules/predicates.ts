import { assertNever } from '../assertNever';
import type { FieldValue } from '../response';
import type { Predicate } from '../template';
import { isEmptyValue, numberOf } from '../values';

/** Trimmed and case-insensitive, so "Yes" matches "yes " (D-7). */
const normaliseText = (text: string): string => text.trim().toLocaleLowerCase();

/**
 * Whether the builder has filled in everything the predicate needs. An incomplete predicate
 * never holds; the builder reports it as a config issue that blocks Save.
 */
function isPredicateComplete(predicate: Predicate): boolean {
  switch (predicate.kind) {
    case 'text':
      return predicate.value.trim() !== '';
    case 'number':
      if (predicate.op === 'between') {
        const { min, max } = predicate.value;
        return min !== null && max !== null && min <= max;
      }
      return predicate.value !== null;
    case 'choice':
    case 'date':
      return predicate.value !== null;
    case 'multi':
      return predicate.value.length > 0;
    default:
      return assertNever(predicate);
  }
}

/**
 * Whether `predicate` holds for a target's effective value.
 *
 * An empty target makes the condition inactive for every operator, including "does not equal"
 * and "contains none of" (D-4): the spec applies the default state when the target has no value.
 * A value of the wrong kind (a stale draft against a changed template) never matches.
 */
export function predicateHolds(predicate: Predicate, value: FieldValue | undefined): boolean {
  if (value === undefined || isEmptyValue(value) || !isPredicateComplete(predicate)) return false;

  switch (predicate.kind) {
    case 'text': {
      if (value.kind !== 'text') return false;
      const actual = normaliseText(value.value);
      const expected = normaliseText(predicate.value);
      switch (predicate.op) {
        case 'equals':
          return actual === expected;
        case 'notEquals':
          return actual !== expected;
        case 'contains':
          return actual.includes(expected);
        default:
          return assertNever(predicate);
      }
    }
    case 'number': {
      const actual = numberOf(value);
      if (actual === null) return false;
      if (predicate.op === 'between') {
        // Inclusive at both ends (D-8). Completeness was checked above.
        const { min, max } = predicate.value;
        return min !== null && max !== null && actual >= min && actual <= max;
      }
      const expected = predicate.value;
      if (expected === null) return false;
      switch (predicate.op) {
        case 'equals':
          return actual === expected;
        case 'gt':
          return actual > expected;
        case 'lt':
          return actual < expected;
        default:
          return assertNever(predicate);
      }
    }
    case 'choice': {
      if (value.kind !== 'choice') return false;
      switch (predicate.op) {
        case 'equals':
          return value.value === predicate.value;
        case 'notEquals':
          return value.value !== predicate.value;
        default:
          return assertNever(predicate);
      }
    }
    case 'multi': {
      if (value.kind !== 'multi') return false;
      const selected = new Set(value.value);
      switch (predicate.op) {
        case 'containsAny':
          return predicate.value.some((id) => selected.has(id));
        case 'containsAll':
          return predicate.value.every((id) => selected.has(id));
        case 'containsNone':
          return !predicate.value.some((id) => selected.has(id));
        default:
          return assertNever(predicate);
      }
    }
    case 'date': {
      if (value.kind !== 'date' || value.value === null || predicate.value === null) return false;
      // `YYYY-MM-DD` strings order the same way the dates do (D-16).
      switch (predicate.op) {
        case 'equals':
          return value.value === predicate.value;
        case 'before':
          return value.value < predicate.value;
        case 'after':
          return value.value > predicate.value;
        default:
          return assertNever(predicate);
      }
    }
    default:
      return assertNever(predicate);
  }
}
