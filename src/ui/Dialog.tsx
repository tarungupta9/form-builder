import { type ReactNode, useEffect, useId, useRef } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  /** Called when the dialog closes itself (Escape); the caller sets `open` to false. */
  onClose: () => void;
  /** Where focus goes on close if the element that opened the dialog has left the page. */
  fallbackFocusId: string;
  /** `wide` fits a whole form, as Preview shows. */
  size?: 'default' | 'wide';
  children: ReactNode;
}

/**
 * A modal built on the native `<dialog>` and `showModal()`, which give the focus trap, the inert
 * page behind it and Escape to close. The content mounts only while open, so a form inside starts
 * from fresh state each time. Focus goes back to whatever opened the dialog; this is done here
 * rather than left to the browser, so it also works when that element is gone by then.
 */
export function Dialog({
  open,
  title,
  onClose,
  fallbackFocusId,
  size = 'default',
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (dialog.open) return;
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      return;
    }
    // Escape has already closed the native dialog by the time `open` turns false; Cancel and
    // Done have not. Either way, focus is restored once, and only after this dialog was opened.
    if (dialog.open) dialog.close();
    if (!opener.current) return;
    const target = opener.current.isConnected
      ? opener.current
      : document.getElementById(fallbackFocusId);
    opener.current = null;
    target?.focus();
  }, [open, fallbackFocusId]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[styles.dialog, size === 'wide' && styles.wide].filter(Boolean).join(' ')}
      onClose={onClose}
    >
      {open && (
        <>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
