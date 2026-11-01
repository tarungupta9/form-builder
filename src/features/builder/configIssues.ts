/**
 * Everything that blocks Save, worked out from the template alone. The shared rules (a form
 * title, a label on every field) live here; each field type adds its own through
 * `validateConfig`, so this module never needs to know which types exist.
 */
import type { FieldId } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { definitionOf } from '../../fields/registry';

/** D-32: long enough for a paragraph of context, short enough to fit on a card. */
export const DESCRIPTION_MAX_LENGTH = 500;

/** Exported so the settings that own these problems can show them beside the right control. */
export const TITLE_MISSING = 'Give the form a title.';
export const LABEL_MISSING = 'Give this field a label.';

export interface ConfigIssues {
  /** Problems with the title and description. */
  form: string[];
  /** Problems per field, for fields that have any. */
  fields: ReadonlyMap<FieldId, string[]>;
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

export function configIssues(template: FormTemplate): ConfigIssues {
  const details = detailsIssues(template);
  const form = [details.title, details.description].filter((issue) => issue !== null);

  const context = { fields: template.fields };
  const fields = new Map<FieldId, string[]>();
  for (const field of template.fields) {
    const issues = [
      // D-35: respondents, screen readers and the PDF all need the field's words.
      ...(field.label.trim() === '' ? [LABEL_MISSING] : []),
      ...definitionOf(field).validateConfig(field, context),
    ];
    if (issues.length > 0) fields.set(field.id, issues);
  }

  const count = form.length + [...fields.values()].reduce((sum, list) => sum + list.length, 0);
  return { form, fields, count };
}
