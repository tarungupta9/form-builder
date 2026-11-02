import { useEffect, useRef } from 'react';
import type { FieldId } from '../../../domain/ids';
import { useAnnounce } from '../../../ui/LiveRegion';
import { type ConditionWarning, newWarnings } from './conditionWarnings';

/**
 * Speaks a warning once, when the author's own edit makes it appear. Warnings already there
 * when a field is selected are on screen and in the groups' descriptions, so switching fields
 * says nothing; a warning that goes and comes back is spoken again.
 */
export function useWarningAnnouncements(
  fieldId: FieldId,
  warnings: readonly ConditionWarning[],
): void {
  const announce = useAnnounce();
  const last = useRef({ fieldId, warnings });

  useEffect(() => {
    const before = last.current;
    last.current = { fieldId, warnings };
    if (before.fieldId !== fieldId) return;
    for (const warning of newWarnings(before.warnings, warnings)) {
      announce(`Note: ${warning.message}`);
    }
  }, [fieldId, warnings, announce]);
}
