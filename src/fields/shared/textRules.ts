import type { TextValue } from '../../domain/response';
import type { Field } from '../../domain/template';
import { plural } from '../../ui/format';
import { nameOf, rangeIssue } from './helpers';

interface LengthLimits {
  minLength?: number;
  maxLength?: number;
}

/**
 * The first problem with a text answer. Shared by Short text and Long text, which differ only
 * in their control. Surrounding whitespace is not an answer, so "   " counts as empty.
 */
export function validateText(
  field: Pick<Field, 'label'>,
  limits: LengthLimits,
  value: TextValue | undefined,
  required: boolean,
): string | null {
  const text = value?.value.trim() ?? '';
  if (text === '') return required ? `Enter an answer for ${nameOf(field)}` : null;
  // Length counts code points, so an emoji counts as one character, not two UTF-16 units.
  const length = Array.from(text).length;
  if (limits.minLength !== undefined && length < limits.minLength) {
    return `${capitalise(nameOf(field))} must be at least ${plural(limits.minLength, 'character')}`;
  }
  if (limits.maxLength !== undefined && length > limits.maxLength) {
    return `${capitalise(nameOf(field))} must be ${plural(limits.maxLength, 'character')} or fewer`;
  }
  return null;
}

/** The limits as a hint under the label, so the respondent knows them before submitting. */
export function lengthHint(limits: LengthLimits): string | null {
  const { minLength: min, maxLength: max } = limits;
  if (min !== undefined && max !== undefined)
    return `Between ${min} and ${plural(max, 'character')}.`;
  if (min !== undefined) return `At least ${plural(min, 'character')}.`;
  if (max !== undefined) return `Up to ${plural(max, 'character')}.`;
  return null;
}

/** "this field must…" → "This field must…", for messages that start with the field's name. */
export const capitalise = (text: string): string =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Length limits that would reject every answer. Shared by Short text and Long text. */
export function lengthConfigIssues(limits: LengthLimits): string[] {
  return [
    ...rangeIssue(limits.minLength, limits.maxLength, 'length'),
    ...(limits.maxLength === 0 ? ['The maximum length must be at least 1.'] : []),
  ];
}
