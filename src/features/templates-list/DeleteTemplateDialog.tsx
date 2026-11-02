import type { FormTemplate } from '../../domain/template';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { plural } from '../../ui/format';

/** A template waiting for the author to confirm its deletion. */
export interface PendingDeletion {
  template: FormTemplate;
  /** Submitted responses, counted when the dialog opened. Drafts are worded from v0.10. */
  responseCount: number;
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
 * Confirms deleting a template and says how many responses go with it (D-22), in the body and
 * on the button itself. Rendered by the page, not the card, and kept mounted after it closes:
 * the card is gone by then, and the dialog still has to move focus to its neighbour.
 */
export function DeleteTemplateDialog({ deletion, onCancel, onConfirm }: DeleteTemplateDialogProps) {
  const count = deletion?.responseCount ?? 0;
  const responses = plural(count, 'response');
  return (
    <ConfirmDialog
      open={deletion?.open ?? false}
      title={`Delete ${deletion?.template.title ?? 'template'}?`}
      confirmLabel={count > 0 ? `Delete template and ${responses}` : 'Delete template'}
      fallbackFocusId={deletion?.focusAfter ?? 'empty-title'}
      onCancel={onCancel}
      onConfirm={() => {
        if (deletion) onConfirm(deletion);
      }}
    >
      <p>
        {count > 0
          ? `Its ${responses} will be deleted too. This can’t be undone.`
          : 'It has no responses. This can’t be undone.'}
      </p>
    </ConfirmDialog>
  );
}
