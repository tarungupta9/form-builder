import { type SyntheticEvent, useMemo, useState } from 'react';
import type { SubmittedResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import type { Result } from '../../storage/result';
import { Button } from '../../ui/Button';
import { ErrorSummary, FailureAlert } from '../../ui/ErrorSummary';
import { plural } from '../../ui/format';
import { useFocusRequest } from '../../ui/useFocusRequest';
import styles from './Fill.module.css';
import { FillField, controlIdOf } from './FillField';
import { type SaveError, describeSaveError } from './useSaveResponse';
import { useFormRuntime } from './useFormRuntime';
import { useFormChangeAnnouncements } from './useFormChangeAnnouncements';

const SUMMARY_ID = 'response-error-summary';

interface FillFormProps {
  template: FormTemplate;
  /** Stores the response. The form stays as it is, answers included, when this fails. */
  onSubmit: (response: SubmittedResponse) => Result<void, SaveError>;
}

/**
 * Fill mode: every visible field, drawn by its plugin, and Submit. Which fields show and which
 * are required come from `useFormRuntime`, re-evaluated on every change, so fields appear and
 * disappear as the respondent types; this component wires that to the screen and says so.
 */
export function FillForm({ template, onSubmit }: FillFormProps) {
  const { values, evaluation, issues, setValue, submit } = useFormRuntime(template);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const focusLater = useFocusRequest();
  const visibleFields = template.fields.filter((field) => evaluation.visible.has(field.id));
  const context = useMemo(() => ({ fields: template.fields }), [template.fields]);
  useFormChangeAnnouncements(template.fields, evaluation, values);

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
        {visibleFields.map((field) => (
          <FillField
            key={field.id}
            field={field}
            // Only visible fields are drawn, and for those the effective value is the raw answer
            // itself (the same object, so the memo holds) or a derived field's result.
            value={evaluation.effective[field.id]}
            context={context}
            required={evaluation.required.has(field.id)}
            error={issues.get(field.id) ?? null}
            setValue={setValue}
          />
        ))}
      </div>

      <div className={styles.submitRow}>
        <Button type="submit" variant="primary" size="lg">
          Submit response
        </Button>
      </div>
    </form>
  );
}
