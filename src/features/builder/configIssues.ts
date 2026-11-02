/**
 * Everything that blocks Save, worked out from the template alone. The shared rules (a form
 * title, a label on every field, finished conditions) live here; each field type adds its own
 * through `validateConfig`, so this module never needs to know which types exist.
 */
import type { FieldId } from '../../domain/ids';
import { type DependencyGraph, buildDependencyGraph } from '../../domain/rules/graph';
import type { FormTemplate } from '../../domain/template';
import { definitionOf, fieldDerivations } from '../../fields/registry';
import { CONFIG_IDS } from './configIds';
import { conditionIssues } from './conditions/conditionIssues';

/** D-32: long enough for a paragraph of context, short enough to fit on a card. */
export const DESCRIPTION_MAX_LENGTH = 500;

/** Exported so the settings that own these problems can show them beside the right control. */
export const TITLE_MISSING = 'Give the form a title.';
export const LABEL_MISSING = 'Give this field a label.';

/** One problem with a field, and the control that fixes it, for the issue summary's link. */
export interface ConfigIssue {
  message: string;
  /** `null` when the problem has no single control; the link then opens the field's settings. */
  controlId: string | null;
}

export interface ConfigIssues {
  /** Problems with the title and description. */
  form: string[];
  /** Problems per field, for fields that have any. */
  fields: ReadonlyMap<FieldId, ConfigIssue[]>;
  count: number;
}

export const DESCRIPTION_TOO_LONG = `Keep the description to ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;

/** The template's own details, as the details dialog edits them. */
export interface TemplateDetails {
  title: string;
  description: string;
}

/**
 * Problems with the title and description, one slot per control. The details dialog checks a
 * draft with this before applying it, and Save checks the template with it, so the two agree.
 */
export function detailsIssues({ title, description }: TemplateDetails) {
  return {
    // D-34: the title heads the card, the Fill page and the PDF.
    title: title.trim() === '' ? TITLE_MISSING : null,
    description: description.length > DESCRIPTION_MAX_LENGTH ? DESCRIPTION_TOO_LONG : null,
  };
}

/** `graph` is the template's dependency graph, passed in when the caller already has it. */
export function configIssues(
  template: FormTemplate,
  graph: DependencyGraph = buildDependencyGraph(template.fields, fieldDerivations),
): ConfigIssues {
  const details = detailsIssues(template);
  const form = [details.title, details.description].filter((issue) => issue !== null);

  const context = { fields: template.fields };
  const fields = new Map<FieldId, ConfigIssue[]>();
  for (const field of template.fields) {
    const issues: ConfigIssue[] = [
      // D-35: respondents, screen readers and the PDF all need the field's words.
      ...(field.label.trim() === ''
        ? [{ message: LABEL_MISSING, controlId: CONFIG_IDS.fieldLabel }]
        : []),
      ...definitionOf(field)
        .validateConfig(field, context)
        .map((message) => ({ message, controlId: null })),
      ...conditionIssues(field, template.fields, graph).map(({ message, controlId }) => ({
        message,
        controlId,
      })),
    ];
    if (issues.length > 0) fields.set(field.id, issues);
  }

  const count = form.length + [...fields.values()].reduce((sum, list) => sum + list.length, 0);
  return { form, fields, count };
}
