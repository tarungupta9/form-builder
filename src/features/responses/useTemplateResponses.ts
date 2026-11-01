import { useMemo } from 'react';
import type { TemplateId } from '../../domain/ids';
import type { FormResponse, SubmittedResponse } from '../../domain/response';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, ok } from '../../storage/result';

const isSubmittedTo =
  (templateId: TemplateId) =>
  (response: FormResponse): response is SubmittedResponse =>
    response.status === 'submitted' && response.templateId === templateId;

/**
 * Newest first. Timestamps are UTC ISO strings, so comparing them as text orders them by time;
 * the ID breaks a tie, so two responses submitted in the same millisecond never swap places.
 */
const newestFirst = (a: SubmittedResponse, b: SubmittedResponse): number =>
  b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id);

/** One template's submitted responses, newest first, kept in sync with storage and other tabs. */
export function useTemplateResponses(
  templateId: TemplateId | null,
): Result<SubmittedResponse[], StorageError> {
  const { responses } = useRepositories();
  const snapshot = useCollection(responses);
  return useMemo(() => {
    if (!snapshot.ok) return snapshot;
    if (!templateId) return ok([]);
    return ok([...snapshot.value.values()].filter(isSubmittedTo(templateId)).sort(newestFirst));
  }, [snapshot, templateId]);
}
