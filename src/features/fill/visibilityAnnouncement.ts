import type { FieldId } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import type { Field } from '../../domain/template';
import { isEmptyValue } from '../../domain/values';
import { plural } from '../../ui/format';

const nameOf = (field: Field): string => field.label.trim() || 'Untitled field';

/** One or two fields by name, so the respondent knows which; from three, a count (D6-9). */
export function describeFields(fields: readonly Field[]): string {
  const [first, second] = fields;
  if (!first) return '';
  if (fields.length === 1) return nameOf(first);
  if (fields.length === 2 && second) return `${nameOf(first)} and ${nameOf(second)}`;
  return plural(fields.length, 'field');
}

/**
 * What a screen reader hears when the visible fields change, or `null` when nothing changed:
 * "Nights shown.", "Nights shown, Approval reason hidden." When a field that held an answer
 * hides, it also says the answer has left the submission (D-9, D6-8); showing the field again
 * brings the answer back, which needs no extra words.
 */
export function describeVisibilityChange(
  fields: readonly Field[],
  before: ReadonlySet<FieldId>,
  after: ReadonlySet<FieldId>,
  values: ResponseValues,
): string | null {
  const shown = fields.filter((field) => after.has(field.id) && !before.has(field.id));
  const hidden = fields.filter((field) => before.has(field.id) && !after.has(field.id));
  if (shown.length === 0 && hidden.length === 0) return null;

  const parts = [
    shown.length > 0 ? `${describeFields(shown)} shown` : null,
    hidden.length > 0 ? `${describeFields(hidden)} hidden` : null,
  ].filter((part) => part !== null);
  const sentence = `${parts.join(', ')}.`;

  const withAnswers = hidden.filter((field) => !isEmptyValue(values[field.id]));
  if (withAnswers.length === 0) return sentence;
  return hidden.length === 1
    ? `${sentence} Its answer won’t be submitted.`
    : `${sentence} Answers in hidden fields won’t be submitted.`;
}
