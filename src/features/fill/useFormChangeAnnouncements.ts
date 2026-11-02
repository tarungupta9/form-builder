import { useEffect, useRef } from 'react';
import type { ResponseValues } from '../../domain/response';
import type { Field } from '../../domain/template';
import { useAnnounce } from '../../ui/LiveRegion';
import { type FormState, describeRequiredChange } from './requiredAnnouncement';
import { describeVisibilityChange } from './visibilityAnnouncement';

/** How long the visible and required fields must stay put before the change is spoken. */
export const SETTLE_MS = 400;

/** One message for everything that changed: "Nights shown. Receipt number is now required." */
function describeChange(
  fields: readonly Field[],
  before: FormState,
  after: FormState,
  values: ResponseValues,
): string | null {
  const parts = [
    describeVisibilityChange(fields, before.visible, after.visible, values),
    describeRequiredChange(fields, before, after),
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** The members of a set in form order, so equal sets give equal keys. */
const keyOf = (fields: readonly Field[], set: FormState['visible']): string =>
  fields
    .filter((field) => set.has(field.id))
    .map((field) => field.id)
    .join(' ');

/**
 * Announces fields appearing, disappearing, becoming required and becoming optional, once per
 * settled change (D7-8). It compares against what was last announced, not against the previous
 * keystroke, so typing "4", backspace, "5" across a "> 3" boundary is spoken once or not at
 * all, never "shown. hidden. shown". Nothing is said about the form as it opens.
 *
 * The wait restarts only when the set of visible or required fields changes. Typing that
 * changes neither (most keystrokes) leaves a pending announcement alone, so it is never
 * postponed for as long as the respondent keeps typing.
 */
export function useFormChangeAnnouncements(
  fields: readonly Field[],
  state: FormState,
  values: ResponseValues,
): void {
  const announce = useAnnounce();
  const announced = useRef(state);
  // Read when the announcement is spoken, so it says whether a hidden field still holds input.
  const latestValues = useRef(values);
  useEffect(() => {
    latestValues.current = values;
  }, [values]);

  // Evaluation hands over new Sets on every change; their members, in form order, are what count.
  const stateKey = `${keyOf(fields, state.visible)}|${keyOf(fields, state.required)}`;
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);

  useEffect(() => {
    const after = current.current;
    if (describeChange(fields, announced.current, after, {}) === null) return;
    // Every change of either set restarts the wait (the cleanup clears the last timer).
    const timer = setTimeout(() => {
      const message = describeChange(fields, announced.current, after, latestValues.current);
      announced.current = after;
      if (message) announce(message);
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [fields, stateKey, announce]);
}
