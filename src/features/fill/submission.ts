import type { IsoDateTime, ResponseId } from '../../domain/ids';
import type { ResponseValues, SubmittedResponse } from '../../domain/response';
import type { FormEvaluation } from '../../domain/rules/evaluate';
import type { FormTemplate } from '../../domain/template';
import { isEmptyValue } from '../../domain/values';
import { definitionOf } from '../../fields/registry';

interface SubmissionMeta {
  id: ResponseId;
  /** When the respondent opened the form. */
  startedAt: IsoDateTime;
  submittedAt: IsoDateTime;
}

/**
 * The record that is stored and later exported. It holds what the respondent saw and nothing
 * else: the snapshot keeps only the visible fields, in form order, so editing the template
 * later never changes a past response (D-10), and the answers come from the effective values,
 * so a hidden field's value is never submitted (D-9). Empty answers are left out; the export
 * shows those fields as not answered.
 */
export function toSubmittedResponse(
  template: FormTemplate,
  evaluation: FormEvaluation,
  meta: SubmissionMeta,
): SubmittedResponse {
  const fields = template.fields.filter((field) => evaluation.visible.has(field.id));
  const answers: ResponseValues = {};
  for (const field of fields) {
    const value = definitionOf(field).readValue(field, evaluation.effective[field.id]);
    if (value !== undefined && !isEmptyValue(value)) answers[field.id] = value;
  }
  return {
    status: 'submitted',
    id: meta.id,
    templateId: template.id,
    createdAt: meta.startedAt,
    submittedAt: meta.submittedAt,
    snapshot: { title: template.title, description: template.description, fields },
    answers,
  };
}
