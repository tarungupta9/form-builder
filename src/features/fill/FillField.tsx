import { memo, useCallback } from 'react';
import type { FieldId } from '../../domain/ids';
import type { FieldValue } from '../../domain/response';
import type { Field } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { uiOf } from '../../fields/ui-registry';

/** The ID each field's control carries, so the error summary can move focus to it. */
export const controlIdOf = (fieldId: FieldId): string => `answer-${fieldId}`;

interface FillFieldProps {
  field: Field;
  /** The raw answer, hidden fields' kept values included (D-9). */
  value: FieldValue | undefined;
  required: boolean;
  error: string | null;
  /** Must be stable (it is, from `useFormRuntime`), or every field re-renders on each keystroke. */
  setValue: (fieldId: FieldId, value: FieldValue) => void;
}

/**
 * One visible field in Fill mode, drawn by its plugin. Memoised: its props are the field, its
 * own raw answer and two primitives, so a keystroke re-renders the field being typed in and any
 * field whose required state or error changed, not the whole form (HLD §8). The plugin's
 * `readValue` runs in here, so a new object it returns never defeats the memo.
 */
export const FillField = memo(function FillField({
  field,
  value,
  required,
  error,
  setValue,
}: FillFieldProps) {
  const { Renderer } = uiOf(field);
  const onChange = useCallback(
    (next: FieldValue) => {
      setValue(field.id, next);
    },
    [setValue, field.id],
  );
  return (
    <Renderer
      field={field}
      value={definitionOf(field).readValue(field, value)}
      required={required}
      error={error}
      controlId={controlIdOf(field.id)}
      onChange={onChange}
    />
  );
});
