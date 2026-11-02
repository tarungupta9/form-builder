# 0022. Confirm successes with a visual-only toast, spoken through the one live region

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

Saving a template and deleting one gave sighted users almost no feedback. A save called `announce('Template saved')`, which only a screen reader hears, and updated the small "Last saved" line beside the title. A delete announced the same way and removed the card. A sighted author who pressed Save could not tell whether anything had happened without reading the timestamp.

The constraints:

- **One live region.** The app speaks every change through a single polite region (`LiveRegion.tsx`) that batches messages over 250 ms. ADR 0016 keeps dnd-kit's own region for drags only, so no event is spoken by two regions. Existing tests assert on the region's text after a save and a delete, and they must keep passing.
- **WCAG 2.2 AA.** Anything that disappears on a timer must not hold something the user needs (2.2.1 Timing Adjustable), must not steal focus, and must not cover content the user has to reach (2.4.11 Focus Not Obscured).
- **Saving a new template navigates** from `/templates/new` to `/templates/:id/edit` with `replace`. Feedback created by the save must outlive that navigation.
- **Errors already have a pattern.** A failed save or delete shows an inline `FailureAlert` (`role="alert"`) next to where the user acted, and stays until it is resolved.

## Options considered

### A status line next to Save only

Make "Last saved" more prominent, or add "Saved" text beside the button. It stays put, so it is a lasting record, and it needs no timer. But it lives in the builder header only: the templates page has no equivalent spot for "Deleted Travel", and a change of a few characters in a line the user is not looking at is what we have today.

### Change the Save button's state ("Saved ✓")

Swap the button label for a moment after a save. Sits exactly where the user's eye is. But it changes the accessible name of a focused control, which screen readers may or may not re-read, it fights the button's disabled and pending states, and it does not apply to delete, where the button lives in a dialog that has just closed.

### A toast (chosen)

A short message at the bottom centre of the viewport, the same component for every success. It is visible wherever the user is looking on the page, it works for both save and delete, and mounted above the router it survives the redirect after a first save. The cost is a timer and a fixed overlay to get right.

### Both a toast and a button state

Most noticeable, but two signals for one event is noise, and the button-state problems above remain.

## Decision

**A toast, for successes only, as a visual mirror of the live region.** `ToastProvider` (in `App`, inside `LiveRegionProvider` and around `RouterProvider`) gives `useNotify()`, whose `notify(message)` calls the existing `announce(message)` and shows the same text as a toast. Builder's save and the templates page's delete call `notify` where they called `announce`; every other announcement is unchanged.

The deciding reason is that it gives sighted users the same confirmation screen-reader users already had, from one call, without adding a second voice.

Details:

- **Visual only.** The toast is `aria-hidden="true"` and is not a live region itself, so screen readers hear each message once, through the app's region, batched like every other message. A toast with its own `role="status"` would be read twice.
- **No controls.** It has no close button or action, so it never takes focus and needs no focus management. That is also what makes the timeout acceptable under 2.2.1: the toast repeats information that stays on the page ("Last saved" updates, the card is gone from the list), so nothing is lost when it leaves.
- **Timing.** One toast at a time; a new `notify` replaces the current one and restarts its timer. It leaves after `TOAST_DURATION_MS` (4000 ms). While the pointer is over it, the timer stops; when the pointer leaves, a full 4000 ms starts again rather than the remainder, so the reader always gets a fresh window and the logic needs no clock arithmetic.
- **Successes only.** Errors stay inline alerts. An error needs to stay until it is dealt with, usually holds a recovery action, and belongs next to what failed; a toast that disappears would fail all three.
- **Placement and style.** Fixed at the bottom centre with 16px gutters and a 480px maximum width, above the sticky header (`z-index` 20 against the header's 5). White on `--color-text` (about 16:1), with a check icon. Its border is transparent and becomes visible in forced colours. The short entrance animation is off under `prefers-reduced-motion: reduce`, and the toast is hidden when printing.

## Consequences

- Any future success message is one `notify` call, and stays consistent in wording, voice and look. A developer must still choose `announce` for changes that are not confirmations (field added, field moved), or the screen would fill with toasts while editing.
- A component calling `useNotify` outside `ToastProvider` throws, as `useAnnounce` does, so a missing provider fails the first test that renders it.
- The toast can briefly cover the bottom 60px or so of the page. It cannot hide the focused control for long (it leaves on its own and takes no focus), but on a short phone screen a user tabbing to the last control may see it under the toast for up to four seconds.
- A modal `<dialog>` is in the top layer, so a toast raised while one is open sits beneath it. Today no success fires with a dialog open (the delete dialog closes first).
- With more time: pause the timer while the window is hidden, and consider pausing on keyboard focus within the page's header, so a keyboard user who saves and then reads is given the same grace as a pointer user.
