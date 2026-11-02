import { useEffect, useRef } from 'react';
import type { FieldId } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import type { Field } from '../../domain/template';
import { useAnnounce } from '../../ui/LiveRegion';
import { describeVisibilityChange } from './visibilityAnnouncement';

/** How long the visible fields must stay put before the change is spoken. */
export const SETTLE_MS = 400;

/**
 * Announces fields appearing and disappearing, once per settled change. It compares against
 * what was last announced, not against the previous keystroke, so typing "4", backspace, "5"
 * across a "> 3" boundary is spoken once or not at all, never "shown. hidden. shown". Nothing
 * is said for the fields the form opens with.
 *
 * The wait restarts only when the set of visible fields changes. Typing that changes no
 * field's visibility (most keystrokes) leaves a pending announcement alone, so it is never
 * postponed for as long as the respondent keeps typing.
 */
export function useVisibilityAnnouncements(
  fields: readonly Field[],
  visible: ReadonlySet<FieldId>,
  values: ResponseValues,
): void {
  const announce = useAnnounce();
  const announced = useRef(visible);
  // Read when the announcement is spoken, so it says whether a hidden field still holds input.
  const latestValues = useRef(values);
  useEffect(() => {
    latestValues.current = values;
  }, [values]);

  // Evaluation hands over a new Set on every change; its members, in form order, are what count.
  const visibleKey = fields
    .filter((field) => visible.has(field.id))
    .map((field) => field.id)
    .join(' ');
  const current = useRef(visible);
  useEffect(() => {
    current.current = visible;
  }, [visible]);

  useEffect(() => {
    const after = current.current;
    if (describeVisibilityChange(fields, announced.current, after, {}) === null) return;
    // Every change of the visible set restarts the wait (the cleanup clears the last timer).
    const timer = setTimeout(() => {
      const message = describeVisibilityChange(
        fields,
        announced.current,
        after,
        latestValues.current,
      );
      announced.current = after;
      if (message) announce(message);
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [fields, visibleKey, announce]);
}
