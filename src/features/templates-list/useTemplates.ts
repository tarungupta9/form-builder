import { useMemo } from 'react';
import type { FormTemplate } from '../../domain/template';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, ok } from '../../storage/result';

/** Every saved template, most recently edited first, kept in sync with storage and other tabs. */
export function useTemplates(): Result<FormTemplate[], StorageError> {
  const { templates } = useRepositories();
  const snapshot = useCollection(templates);
  return useMemo(
    () =>
      snapshot.ok
        ? ok([...snapshot.value.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
        : snapshot,
    [snapshot],
  );
}
