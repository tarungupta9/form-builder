import { memo, useCallback } from 'react';
import type { FieldId } from '../../domain/ids';
import type { FieldValue } from '../../domain/response';
import type { Field } from '../../domain/template';
import type { TemplateContext } from '../../fields/contract';
import { definitionOf } from '../../fields/registry';
import { uiOf } from '../../fields/ui-registry';

/** The ID each field's control carries, so the error summary can move focus to it. */
export const controlIdOf = (fieldId: FieldId): string => `answer-${fieldId}`;

interface FillFieldProps {
  field: Field;
  /** The answer as the engine resolved it: what was typed, or a derived field's result. */
  value: FieldValue | undefined;
  /** The whole form; stable for the life of the form, so it never defeats the memo. */
  context: TemplateContext;
  required: boolean;
  error: string | null;
  /** Must be stable (it is, from `useFormRuntime`), or every field re-renders on each keystroke. */
  setValue: (fieldId: FieldId, value: FieldValue) => void;
}

/**
 * One visible field in Fill mode, drawn by its plugin. Memoised: its props are the field, its
 * own answer, the form and two primitives, so a keystroke re-renders the field being typed in and any
 * field whose required state or error changed, not the whole form (HLD §8). The plugin's
 * `readValue` runs in here, so a new object it returns never defeats the memo.
 */
export const FillField = memo(function FillField({
  field,
  value,
  context,
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
      context={context}
      required={required}
      error={error}
      controlId={controlIdOf(field.id)}
      onChange={onChange}
    />
  );
});
