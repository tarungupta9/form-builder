import type { FormTemplate } from '../../domain/template';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { formatDateTime } from '../../ui/format';

/** What Save found in storage that this tab did not expect (HLD §4.5). */
export type SaveConflict = { kind: 'changed'; theirs: FormTemplate } | { kind: 'deleted' };

interface SaveConflictDialogProps {
  conflict: SaveConflict | null;
  /** The Save button, which stays on the page, so focus always has somewhere to return. */
  fallbackFocusId: string;
  onCancel: () => void;
  /** Writes this tab's version anyway: replaces theirs, or re-creates a deleted template. */
  onOverwrite: () => void;
  onUseTheirs: (theirs: FormTemplate) => void;
}

/**
 * Last write wins, but never silently. When another tab saved the template after this one
 * opened it, the author chooses: keep editing (Cancel), take the other tab's version, or replace
 * it with theirs. When another tab deleted it, Save again re-creates it; its responses are gone.
 */
export function SaveConflictDialog({
  conflict,
  fallbackFocusId,
  onCancel,
  onOverwrite,
  onUseTheirs,
}: SaveConflictDialogProps) {
  // One dialog, always mounted, so it restores focus whichever case it showed.
  const deleted = conflict?.kind === 'deleted';
  const theirs = conflict?.kind === 'changed' ? conflict.theirs : undefined;
  return (
    <ConfirmDialog
      open={conflict !== null}
      title={
        deleted
          ? 'This template was deleted in another tab'
          : 'This template changed in another tab'
      }
      confirmLabel={deleted ? 'Save again' : 'Replace with my version'}
      confirmVariant={deleted ? 'primary' : 'danger'}
      alternative={
        theirs && {
          label: 'Use their version',
          onSelect: () => {
            onUseTheirs(theirs);
          },
        }
      }
      fallbackFocusId={fallbackFocusId}
      onCancel={onCancel}
      onConfirm={onOverwrite}
    >
      {deleted && <p>Save it again to keep your version. Its responses were deleted with it.</p>}
      {theirs && (
        <p>
          It was saved in another tab at{' '}
          <time dateTime={theirs.updatedAt}>{formatDateTime(theirs.updatedAt)}</time>, after you
          opened it. Saving now replaces those changes with yours. Using their version discards your
          unsaved changes.
        </p>
      )}
    </ConfirmDialog>
  );
}
