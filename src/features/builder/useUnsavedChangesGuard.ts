import { useEffect } from 'react';
import { type Blocker, useBlocker } from 'react-router';
import type { TemplateId } from '../../domain/ids';

/**
 * Stops the author losing unsaved edits (D-21), in the two ways they can leave:
 *
 * - **In the app**, including browser Back: the router holds the navigation and the returned
 *   blocker is `blocked` until the author chooses to stay or to leave, in the builder's own dialog.
 * - **Closing or reloading the tab**: nothing but the browser's own prompt can run then.
 *   The listener is attached only while there is something to lose, because a `beforeunload`
 *   listener keeps some browsers from caching the page for Back and Forward.
 *
 * The router reads the blocker function from an effect, so straight after a save it still holds
 * the one from before, when the edits were unsaved. Saving a new template replaces `/new` with
 * the template's own URL in the same handler, and that move must never ask; so a navigation to
 * this template's edit URL is never blocked.
 */
export function useUnsavedChangesGuard(isDirty: boolean, templateId: TemplateId): Blocker {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname !== `/templates/${templateId}/edit`,
  );

  useEffect(() => {
    if (!isDirty) return;
    // `preventDefault` alone asks the browser to confirm; the message it shows is its own.
    const confirmLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', confirmLeaving);
    return () => {
      window.removeEventListener('beforeunload', confirmLeaving);
    };
  }, [isDirty]);

  return blocker;
}
