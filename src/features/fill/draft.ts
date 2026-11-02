import type { IsoDateTime, ResponseId } from '../../domain/ids';
import type { DraftResponse, ResponseValues } from '../../domain/response';
import type { Field, FormTemplate } from '../../domain/template';
import { definitionOf } from '../../fields/registry';

/**
 * A draft's stored values, read against the template as it is now (D-23). A value whose field
 * was deleted, or that its field no longer accepts (a deleted option, a changed type), is
 * dropped, so it counts as empty: the respondent sees a blank answer rather than one the form
 * can no longer show. Each plugin's `readValue` decides what still fits, so this needs no
 * knowledge of field types.
 *
 * Values of fields that are hidden right now are kept: a hidden field keeps what was typed
 * into it, so showing it again restores the answer (D-9).
 */
export function restoreValues(fields: readonly Field[], stored: ResponseValues): ResponseValues {
  const restored: ResponseValues = {};
  for (const field of fields) {
    const value = definitionOf(field).readValue(field, stored[field.id]);
    if (value !== undefined) restored[field.id] = value;
  }
  return restored;
}

/** The template changed after the draft was last saved against it, so the notice is shown. */
export const templateChangedSince = (draft: DraftResponse, template: FormTemplate): boolean =>
  draft.templateUpdatedAt !== template.updatedAt;

interface DraftMeta {
  id: ResponseId;
  /** When the respondent opened the form; a submitted response keeps it as its `createdAt`. */
  startedAt: IsoDateTime;
  savedAt: IsoDateTime;
}

/**
 * The draft as stored. `templateUpdatedAt` is the template the values were last edited
 * against, so a draft saved after the respondent has seen the change notice stops showing it.
 */
export function toDraft(
  template: FormTemplate,
  values: ResponseValues,
  meta: DraftMeta,
): DraftResponse {
  return {
    status: 'draft',
    id: meta.id,
    templateId: template.id,
    values,
    templateUpdatedAt: template.updatedAt,
    createdAt: meta.startedAt,
    updatedAt: meta.savedAt,
  };
}
