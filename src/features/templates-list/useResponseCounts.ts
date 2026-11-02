import { useMemo } from 'react';
import type { TemplateId } from '../../domain/ids';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, ok } from '../../storage/result';

export interface ResponseCounts {
  /** What the spec calls responses. */
  submitted: number;
  /** Drafts, counted apart (D-23). */
  inProgress: number;
}

export const NO_RESPONSES: ResponseCounts = { submitted: 0, inProgress: 0 };

/** Each template's submitted and in-progress responses, kept in sync with storage and other tabs. */
export function useResponseCounts(): Result<ReadonlyMap<TemplateId, ResponseCounts>, StorageError> {
  const { responses } = useRepositories();
  const snapshot = useCollection(responses);
  return useMemo(() => {
    if (!snapshot.ok) return snapshot;
    const counts = new Map<TemplateId, ResponseCounts>();
    for (const response of snapshot.value.values()) {
      const counted = counts.get(response.templateId) ?? { ...NO_RESPONSES };
      if (response.status === 'submitted') counted.submitted += 1;
      else counted.inProgress += 1;
      counts.set(response.templateId, counted);
    }
    return ok(counts);
  }, [snapshot]);
}
