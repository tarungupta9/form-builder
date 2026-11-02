import { type Dependant, sourceCount } from '../../domain/rules/references';
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
  // Calculation sources are references too (ADR 0018); the words only change when one is involved.
  const usesSources = sourceCount(removal?.dependants ?? []) > 0;
  return (
    <RemovalDialog
      open={removal?.open ?? false}
      title={`Remove ${name}?`}
      lead={
        usesSources
          ? `Other fields use ${name}. Removing it also removes those references:`
          : `Other fields have conditions on ${name}. Removing it also removes those conditions:`
      }
      dependants={removal?.dependants ?? []}
      confirmLabel={usesSources ? 'Remove field and references' : 'Remove field and conditions'}
      fallbackFocusId={removal?.focusAfter ?? 'canvas-title'}
      onCancel={onCancel}
      onConfirm={() => {
        if (removal) onConfirm(removal);
      }}
    />
  );
}
