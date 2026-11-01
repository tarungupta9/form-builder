import type { FieldValue } from '../../domain/response';
import type { Field } from '../../domain/template';

/** How answer messages refer to a field: its label, or a neutral phrase while it has none. */
export const nameOf = (field: Pick<Field, 'label'>): string => field.label.trim() || 'this field';

/** Narrows a stored value to one kind; a value of any other kind reads as no answer. */
export function valueOfKind<K extends FieldValue['kind']>(
  value: FieldValue | undefined,
  kind: K,
): Extract<FieldValue, { kind: K }> | undefined {
  // TypeScript cannot narrow a union by a generic discriminant; the check makes the cast safe.
  return value?.kind === kind ? (value as Extract<FieldValue, { kind: K }>) : undefined;
}

/** Min / max pairs that would make every answer invalid. */
export function rangeIssue(
  min: number | undefined,
  max: number | undefined,
  what: string,
): string[] {
  return min !== undefined && max !== undefined && min > max
    ? [`The minimum ${what} is more than the maximum.`]
    : [];
}
