import { useCallback } from 'react';
import { assertNever } from '../../domain/assertNever';
import type { SubmittedResponse } from '../../domain/response';
import { useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, err } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';

export type SaveError =
  | StorageError
  /** The template was deleted, in another tab, while this response was being filled in. */
  | { kind: 'templateDeleted' };

/**
 * Stores a submitted response. The form keeps the template as it was when it opened, so this
 * checks the template still exists: a response to a deleted template would be stored where
 * nothing could ever list it.
 */
export function useSaveResponse(): (response: SubmittedResponse) => Result<void, SaveError> {
  const { templates, responses } = useRepositories();
  return useCallback(
    (response) => {
      const current = templates.snapshot();
      if (current.ok && !current.value.has(response.templateId)) {
        return err({ kind: 'templateDeleted' });
      }
      return responses.put(response);
    },
    [templates, responses],
  );
}

export function describeSaveError(error: SaveError): { title: string; body: string } {
  switch (error.kind) {
    case 'templateDeleted':
      return {
        title: 'This form was deleted',
        body: 'It was deleted in another tab or window, so this response cannot be saved. Your answers are still on screen.',
      };
    case 'unavailable':
    case 'quota':
    case 'corrupt':
    case 'newerVersion':
      return describeStorageError(error);
    default:
      return assertNever(error);
  }
}
