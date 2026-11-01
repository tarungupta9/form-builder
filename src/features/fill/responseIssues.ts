import type { FieldId } from '../../domain/ids';
import type { FormEvaluation } from '../../domain/rules/evaluate';
import type { Field } from '../../domain/template';
import { definitionOf } from '../../fields/registry';

/** The first problem with each field's answer, in form order. */
export type ResponseIssues = ReadonlyMap<FieldId, string>;

/**
 * Checks every answer the respondent can see. A hidden field is skipped entirely, so it is
 * never validated as required, whatever its settings (a rule the spec states outright).
 *
 * This lives in Fill rather than `domain/` because it asks each field's plugin, and the domain
 * layer sits below the plugins.
 */
export function responseIssues(
  fields: readonly Field[],
  evaluation: FormEvaluation,
): ResponseIssues {
  const issues = new Map<FieldId, string>();
  for (const field of fields) {
    if (!evaluation.visible.has(field.id)) continue;
    const definition = definitionOf(field);
    const value = definition.readValue(field, evaluation.effective[field.id]);
    const issue = definition.validateValue(field, value, evaluation.required.has(field.id));
    if (issue !== null) issues.set(field.id, issue);
  }
  return issues;
}
