import { useMemo } from 'react';
import type { TemplateId } from '../../domain/ids';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, ok } from '../../storage/result';

/** How many submitted responses each template has, kept in sync with storage and other tabs. */
export function useResponseCounts(): Result<ReadonlyMap<TemplateId, number>, StorageError> {
  const { responses } = useRepositories();
  const snapshot = useCollection(responses);
  return useMemo(() => {
    if (!snapshot.ok) return snapshot;
    const counts = new Map<TemplateId, number>();
    for (const response of snapshot.value.values()) {
      // Drafts (v0.10) are in progress, not responses yet; the spec counts submitted ones.
      if (response.status !== 'submitted') continue;
      counts.set(response.templateId, (counts.get(response.templateId) ?? 0) + 1);
    }
    return ok(counts);
  }, [snapshot]);
}
