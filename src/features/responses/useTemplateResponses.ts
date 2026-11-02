import { useMemo } from 'react';
import type { TemplateId } from '../../domain/ids';
import type { DraftResponse, SubmittedResponse } from '../../domain/response';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, ok } from '../../storage/result';

export interface TemplateResponseLists {
  /** Drafts, most recently edited first (D-23). */
  inProgress: DraftResponse[];
  /** Newest first. */
  submitted: SubmittedResponse[];
}

/**
 * Timestamps are UTC ISO strings, so comparing them as text orders them by time; the ID breaks
 * a tie, so two responses stamped in the same millisecond never swap places.
 */
const latestFirst = (a: string, b: string, idA: string, idB: string): number =>
  b.localeCompare(a) || idA.localeCompare(idB);

/** One template's drafts and submitted responses, kept in sync with storage and other tabs. */
export function useTemplateResponses(
  templateId: TemplateId | null,
): Result<TemplateResponseLists, StorageError> {
  const { responses } = useRepositories();
  const snapshot = useCollection(responses);
  return useMemo(() => {
    if (!snapshot.ok) return snapshot;
    const lists: TemplateResponseLists = { inProgress: [], submitted: [] };
    if (!templateId) return ok(lists);
    for (const response of snapshot.value.values()) {
      if (response.templateId !== templateId) continue;
      if (response.status === 'draft') lists.inProgress.push(response);
      else lists.submitted.push(response);
    }
    lists.inProgress.sort((a, b) => latestFirst(a.updatedAt, b.updatedAt, a.id, b.id));
    lists.submitted.sort((a, b) => latestFirst(a.submittedAt, b.submittedAt, a.id, b.id));
    return ok(lists);
  }, [snapshot, templateId]);
}
