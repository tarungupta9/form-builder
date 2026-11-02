import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  /** A question naming what is at stake: "Delete Travel?" */
  title: string;
  /** The consequence, in full sentences. */
  children: ReactNode;
  cancelLabel?: string;
  /** Names the whole consequence: "Delete template and 3 responses". */
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  /** A third choice between the two, such as "Use their version". */
  alternative?: { label: string; onSelect: () => void };
  /**
   * Where focus goes after the dialog closes if the button that opened it has gone, as when
   * confirming removes it. Worked out when the dialog opens, so this dialog is the only thing
   * that moves focus on close: a second focus request would race the modal's inert page.
   */
  fallbackFocusId: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before something that loses work. The safe choice comes first and takes focus when the
 * dialog opens, because the other button destroys something; Escape chooses it too. Focus then
 * returns to the button that opened the dialog, or to `fallbackFocusId` when that has gone.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmVariant = 'danger',
  alternative,
  fallbackFocusId,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} onClose={onCancel} fallbackFocusId={fallbackFocusId}>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        {alternative && <Button onClick={alternative.onSelect}>{alternative.label}</Button>}
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
