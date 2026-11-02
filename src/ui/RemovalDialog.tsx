import type { Dependant } from '../domain/rules/references';
import { conditionCount, describeReads } from '../domain/rules/references';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './Dialog.module.css';
import { displayLabel } from './FormField';
import { plural } from './format';

interface RemovalDialogProps {
  open: boolean;
  /** "Remove Amount?" */
  title: string;
  /** What the dependants refer to, ending with a colon before the list. */
  lead: string;
  dependants: readonly Dependant[];
  /** Names the whole consequence: "Remove field and conditions". */
  confirmLabel: string;
  /** Where focus goes after confirming, since the opener is removed with what it removed. */
  fallbackFocusId: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before removing something other fields' conditions refer to, and names each of those
 * fields, so nothing the author wrote disappears without being listed first (D-12). The
 * shell, with Cancel first and focus handling, is `ConfirmDialog`.
 */
export function RemovalDialog({
  open,
  title,
  lead,
  dependants,
  confirmLabel,
  fallbackFocusId,
  onCancel,
  onConfirm,
}: RemovalDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      fallbackFocusId={fallbackFocusId}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>{lead}</p>
      <ul className={styles.list}>
        {dependants.map(({ field, reads }) => (
          <li key={field.id}>
            {displayLabel(field.label)}: {describeReads(reads)}
          </li>
        ))}
      </ul>
      <p>Their other conditions stay.</p>
    </ConfirmDialog>
  );
}

/**
 * What was removed along with the thing, for the announcement: "1 condition on Receipt
 * number", "3 conditions on Receipt number and Notes"; from three fields, a count.
 */
export function removedConditions(dependants: readonly Dependant[]): string {
  const names = dependants.map(({ field }) => displayLabel(field.label));
  const where = names.length <= 2 ? names.join(' and ') : plural(names.length, 'field');
  return `${plural(conditionCount(dependants), 'condition')} on ${where}`;
}
