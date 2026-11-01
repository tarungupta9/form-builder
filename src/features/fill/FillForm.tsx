import { type SyntheticEvent, useState } from 'react';
import type { FieldId } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { uiOf } from '../../fields/ui-registry';
import type { Result } from '../../storage/result';
import { Button } from '../../ui/Button';
import { ErrorSummary, FailureAlert } from '../../ui/ErrorSummary';
import { plural } from '../../ui/format';
import { useFocusRequest } from '../../ui/useFocusRequest';
import styles from './Fill.module.css';
import { type SaveError, describeSaveError } from './useSaveResponse';
import { useFormRuntime } from './useFormRuntime';

/** The ID each field's control carries, so the error summary can move focus to it. */
export const controlIdOf = (fieldId: FieldId): string => `answer-${fieldId}`;

const SUMMARY_ID = 'response-error-summary';

interface FillFormProps {
  template: FormTemplate;
  /** Stores the response. The form stays as it is, answers included, when this fails. */
  onSubmit: (response: SubmittedResponse) => Result<void, SaveError>;
}

/**
 * Fill mode: every visible field, drawn by its plugin, and Submit. Which fields show and which
 * are required come from `useFormRuntime`; this component only wires them to the screen.
 */
export function FillForm({ template, onSubmit }: FillFormProps) {
  const { values, evaluation, issues, setValue, submit } = useFormRuntime(template);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const focusLater = useFocusRequest();
  const visibleFields = template.fields.filter((field) => evaluation.visible.has(field.id));

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    const outcome = submit();
    if (!outcome.ok) {
      // The summary appears in this render, so it is focused once it is on the page.
      focusLater(SUMMARY_ID);
      return;
    }
    const saved = onSubmit(outcome.response);
    if (!saved.ok) setSaveError(saved.error);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.form}>
      {saveError && <FailureAlert {...describeSaveError(saveError)} />}
      {issues.size > 0 && (
        <ErrorSummary
          id={SUMMARY_ID}
          title={`Fix ${plural(issues.size, 'problem')} before submitting`}
          items={[...issues].map(([fieldId, issue]) => ({
            key: fieldId,
            label: issue,
            onSelect: () => {
              document.getElementById(controlIdOf(fieldId))?.focus();
            },
          }))}
        />
      )}

      <div className={styles.fields}>
        {visibleFields.map((field) => {
          const { Renderer } = uiOf(field);
          return (
            <Renderer
              key={field.id}
              field={field}
              value={definitionOf(field).readValue(field, values[field.id])}
              required={evaluation.required.has(field.id)}
              error={issues.get(field.id) ?? null}
              controlId={controlIdOf(field.id)}
              onChange={(value) => {
                setValue(field.id, value);
              }}
            />
          );
        })}
      </div>

      <div className={styles.submitRow}>
        <Button type="submit" variant="primary" size="lg">
          Submit response
        </Button>
      </div>
    </form>
  );
}
