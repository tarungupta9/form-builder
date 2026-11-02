import type { FormTemplate } from '../../domain/template';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { plural } from '../../ui/format';
import type { ResponseCounts } from './useResponseCounts';

/** A template waiting for the author to confirm its deletion. */
export interface PendingDeletion {
  template: FormTemplate;
  /** Submitted and in-progress responses, counted when the dialog opened. */
  responseCounts: ResponseCounts;
  /** The neighbouring card's title, or the empty state's heading, worked out when it opened. */
  focusAfter: string;
  open: boolean;
}

interface DeleteTemplateDialogProps {
  deletion: PendingDeletion | null;
  onCancel: () => void;
  onConfirm: (deletion: PendingDeletion) => void;
}

/**
 * Confirms deleting a template and says how many responses go with it (D-22), drafts included
 * (D-23), in the body and on the button itself. Rendered by the page, not the card, and kept mounted after it closes:
 * the card is gone by then, and the dialog still has to move focus to its neighbour.
 */
export function DeleteTemplateDialog({ deletion, onCancel, onConfirm }: DeleteTemplateDialogProps) {
  const { submitted, inProgress } = deletion?.responseCounts ?? { submitted: 0, inProgress: 0 };
  const count = submitted + inProgress;
  return (
    <ConfirmDialog
      open={deletion?.open ?? false}
      title={`Delete ${deletion?.template.title ?? 'template'}?`}
      confirmLabel={
        count > 0 ? `Delete template and ${plural(count, 'response')}` : 'Delete template'
      }
      fallbackFocusId={deletion?.focusAfter ?? 'empty-title'}
      onCancel={onCancel}
      onConfirm={() => {
        if (deletion) onConfirm(deletion);
      }}
    >
      <p>
        {count > 0
          ? `${describeWhatGoes(submitted, inProgress)} will be deleted too. This can’t be undone.`
          : 'It has no responses. This can’t be undone.'}
      </p>
    </ConfirmDialog>
  );
}

/** "Its 3 responses", "Its 3 responses and 2 in progress", "Its 2 responses in progress". */
function describeWhatGoes(submitted: number, inProgress: number): string {
  if (inProgress === 0) return `Its ${plural(submitted, 'response')}`;
  if (submitted === 0) return `Its ${plural(inProgress, 'response')} in progress`;
  return `Its ${plural(submitted, 'response')} and ${inProgress} in progress`;
}
