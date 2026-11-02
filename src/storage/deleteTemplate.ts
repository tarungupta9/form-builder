/**
 * Deleting a template takes its responses with it (D-22): a response nothing links to could
 * never be seen, exported or removed again. This is a storage rule, so no screen can delete a
 * template and forget the cascade.
 */
import type { ResponseId, TemplateId } from '../domain/ids';
import type { FormResponse } from '../domain/response';
import type { Repositories } from './repositories';
import type { Result, StorageError } from './result';

export interface TemplateResponses {
  ids: ResponseId[];
  submitted: number;
  /** Drafts (D-23). */
  inProgress: number;
}

/** Every response of one template, whatever its status, and how many of each kind. */
export function responsesOf(
  responses: ReadonlyMap<ResponseId, FormResponse>,
  templateId: TemplateId,
): TemplateResponses {
  const found: TemplateResponses = { ids: [], submitted: 0, inProgress: 0 };
  for (const response of responses.values()) {
    if (response.templateId !== templateId) continue;
    found.ids.push(response.id);
    if (response.status === 'submitted') found.submitted += 1;
    else found.inProgress += 1;
  }
  return found;
}

/**
 * Removes the template's responses, then the template. The two keys cannot be written in one
 * step, so the order is chosen for the failure: if the second write fails, what is left is a
 * template with no responses, which the author can see and delete again; never responses whose
 * template is gone. Responses are matched by template ID at the moment of deletion, so one
 * added in another tab after the confirmation was shown is removed too.
 *
 * `remove` refuses to write over a key it cannot read, so unreadable responses block the
 * deletion rather than being wiped by it.
 */
export function deleteTemplate(
  repositories: Repositories,
  templateId: TemplateId,
): Result<void, StorageError> {
  const responses = repositories.responses.snapshot();
  if (!responses.ok) return responses;
  const removed = repositories.responses.remove(responsesOf(responses.value, templateId).ids);
  if (!removed.ok) return removed;
  return repositories.templates.remove([templateId]);
}
