import { useCallback, useMemo, useState } from 'react';
import { type FieldId, newResponseId, toIsoDate, toIsoDateTime } from '../../domain/ids';
import type { FieldValue, ResponseValues, SubmittedResponse } from '../../domain/response';
import { evaluateForm } from '../../domain/rules/evaluate';
import { buildDependencyGraph } from '../../domain/rules/graph';
import type { Field, FormTemplate } from '../../domain/template';
import { definitionOf, fieldDerivations } from '../../fields/registry';
import { type ResponseIssues, responseIssues } from './responseIssues';
import { toSubmittedResponse } from './submission';

export type SubmitOutcome =
  { ok: true; response: SubmittedResponse } | { ok: false; issues: ResponseIssues };

const NO_ISSUES: ResponseIssues = new Map();

function initialValues(fields: readonly Field[], now: Date): ResponseValues {
  const values: ResponseValues = {};
  for (const field of fields) {
    const value = definitionOf(field).initialValue(field, toIsoDate(now));
    if (value !== undefined) values[field.id] = value;
  }
  return values;
}

/**
 * One respondent filling in one template, held in memory until submit. The rules engine runs
 * on every change, so visibility and required state are always current.
 *
 * Validation runs on submit, as the spec says. After the first failed submit, every change
 * re-validates, so an error clears as soon as the respondent fixes it.
 */
export function useFormRuntime(template: FormTemplate) {
  const [start] = useState(() => {
    const now = new Date();
    return { at: toIsoDateTime(now), values: initialValues(template.fields, now) };
  });
  const [values, setValues] = useState<ResponseValues>(start.values);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const graph = useMemo(
    () => buildDependencyGraph(template.fields, fieldDerivations),
    [template.fields],
  );
  const evaluation = useMemo(
    () => evaluateForm(template.fields, values, fieldDerivations, graph),
    [template.fields, values, graph],
  );
  const currentIssues = useMemo(
    () => responseIssues(template.fields, evaluation),
    [template.fields, evaluation],
  );

  const setValue = useCallback((fieldId: FieldId, value: FieldValue) => {
    setValues((previous) => ({ ...previous, [fieldId]: value }));
  }, []);

  const submit = useCallback((): SubmitOutcome => {
    setSubmitAttempted(true);
    if (currentIssues.size > 0) return { ok: false, issues: currentIssues };
    return {
      ok: true,
      response: toSubmittedResponse(template, evaluation, {
        id: newResponseId(),
        startedAt: start.at,
        submittedAt: toIsoDateTime(new Date()),
      }),
    };
  }, [currentIssues, evaluation, start.at, template]);

  return {
    values,
    evaluation,
    /** Empty until the first submit attempt. */
    issues: submitAttempted ? currentIssues : NO_ISSUES,
    setValue,
    submit,
  };
}
