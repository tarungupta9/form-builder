import type { Dependant } from '../../domain/rules/references';
import type { Field } from '../../domain/template';
import { RemovalDialog } from '../../ui/RemovalDialog';
import { fieldName } from './Canvas';

/** A field others read, waiting for the author to confirm its removal. */
export interface PendingRemoval {
  field: Field;
  dependants: readonly Dependant[];
  /** The neighbour's canvas item, or the canvas heading, worked out when the dialog opened. */
  focusAfter: string;
  open: boolean;
}

interface RemoveFieldDialogProps {
  removal: PendingRemoval | null;
  onCancel: () => void;
  onConfirm: (removal: PendingRemoval) => void;
}

/**
 * Confirms removing a field that other fields' conditions read, naming each of them (D-12).
 * Kept mounted after it closes, so the dialog still knows where focus goes on confirm.
 */
export function RemoveFieldDialog({ removal, onCancel, onConfirm }: RemoveFieldDialogProps) {
  const name = removal ? fieldName(removal.field) : '';
  return (
    <RemovalDialog
      open={removal?.open ?? false}
      title={`Remove ${name}?`}
      lead={`Other fields have conditions on ${name}. Removing it also removes those conditions:`}
      dependants={removal?.dependants ?? []}
      confirmLabel="Remove field and conditions"
      fallbackFocusId={removal?.focusAfter ?? 'canvas-title'}
      onCancel={onCancel}
      onConfirm={() => {
        if (removal) onConfirm(removal);
      }}
    />
  );
}
