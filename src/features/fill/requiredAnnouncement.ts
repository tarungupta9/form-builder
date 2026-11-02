import type { FieldId } from '../../domain/ids';
import type { Field } from '../../domain/template';
import { describeFields } from './visibilityAnnouncement';

/** The parts of an evaluation a respondent can notice change. */
export interface FormState {
  visible: ReadonlySet<FieldId>;
  required: ReadonlySet<FieldId>;
}

/**
 * What a screen reader hears when fields that stay on screen become required or optional, or
 * `null` when none did: "Receipt number is now required." A field that appeared or hid in the
 * same change is left out; the visibility message names it, and its label says "Required".
 */
export function describeRequiredChange(
  fields: readonly Field[],
  before: FormState,
  after: FormState,
): string | null {
  const stayed = fields.filter(
    (field) => before.visible.has(field.id) && after.visible.has(field.id),
  );
  const nowRequired = stayed.filter(
    (field) => after.required.has(field.id) && !before.required.has(field.id),
  );
  const noLonger = stayed.filter(
    (field) => before.required.has(field.id) && !after.required.has(field.id),
  );
  const verb = (changed: readonly Field[]) => (changed.length === 1 ? 'is' : 'are');
  const parts = [
    nowRequired.length > 0
      ? `${describeFields(nowRequired)} ${verb(nowRequired)} now required.`
      : null,
    noLonger.length > 0
      ? `${describeFields(noLonger)} ${verb(noLonger)} no longer required.`
      : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' ') : null;
}
