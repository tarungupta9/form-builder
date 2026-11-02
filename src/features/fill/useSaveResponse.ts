import { useCallback } from 'react';
import { assertNever } from '../../domain/assertNever';
import type { SubmittedResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { useRepositories } from '../../storage/StorageContext';
import { type Result, type StorageError, err } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';

export type SaveError =
  | StorageError
  /** The template was deleted, in another tab, while this response was being filled in. */
  | { kind: 'templateDeleted' }
  /** This response was already submitted, under the same ID, in another tab or window. */
  | { kind: 'alreadySubmitted' };

/**
 * Stores a submitted response, refusing two writes. The form keeps the template as it was when
 * it opened, so this checks the template still exists: a response to a deleted template would
 * be stored where nothing could ever list it. And a response already submitted under this ID,
 * in another tab with the same draft open, is never written over: a submitted response, and the
 * PDF re-downloaded from it, must not change (D-10). The draft autosave refuses the same write.
 */
export function useSaveResponse(): (response: SubmittedResponse) => Result<void, SaveError> {
  const { templates, responses } = useRepositories();
  return useCallback(
    (response) => {
      const current = templates.snapshot();
      if (current.ok && !current.value.has(response.templateId)) {
        return err({ kind: 'templateDeleted' });
      }
      const stored = responses.snapshot();
      if (stored.ok && stored.value.get(response.id)?.status === 'submitted') {
        return err({ kind: 'alreadySubmitted' });
      }
      return responses.put(response);
    },
    [templates, responses],
  );
}

export interface SaveErrorMessage {
  title: string;
  body: string;
  /** Where the respondent can go next, when somewhere can help. */
  link?: { to: string; label: string };
}

export function describeSaveError(
  error: SaveError,
  templateId: FormTemplate['id'],
): SaveErrorMessage {
  switch (error.kind) {
    case 'templateDeleted':
      return {
        title: 'This form was deleted',
        body: 'It was deleted in another tab or window, so this response cannot be saved. Your answers are still on screen.',
      };
    case 'alreadySubmitted':
      return {
        title: 'This response was already submitted',
        body: 'It was submitted in another tab or window, so these answers were not saved. Your answers are still on screen.',
        // The list, not the response's own URL: that is the address this form is already on,
        // and the page keeps what it opened (D-23), so following it would change nothing.
        link: { to: `/templates/${templateId}/responses`, label: 'View all responses' },
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
