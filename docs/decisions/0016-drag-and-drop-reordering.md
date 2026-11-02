# 0016. Reorder with dnd-kit through a drag handle, and keep Move up / Move down

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

The spec asks for drag-and-drop reordering in the builder and for fields to be draggable from the palette into the canvas. The reviewer weighs accessibility (WCAG 2.2 AA), so reordering must work by keyboard alone, be heard by a screen reader, and meet **2.5.7 Dragging Movements**: anything done by dragging must also be possible with a single pointer and no drag. Keyboard dragging does not satisfy 2.5.7, because it is not a pointer.

D-28 (HLD §3.1) chose `@dnd-kit/sortable` over native HTML5 drag and drop, which has no keyboard support and no announcements. Four questions were left for v0.8:

1. **What starts a drag on a canvas item** (D8-1). dnd-kit's keyboard sensor starts on Space _and_ Enter. Each canvas item is already a button that selects the field.
2. **Which live region speaks the drag** (D8-2). dnd-kit renders its own assertive region and replaces its text on each event. The app's polite region batches messages over 250 ms and joins them.
3. **How the palette drags** (D8-3). Palette buttons add a field on click, Enter or Space, after the selection (HLD §7).
4. **Whether to keep the Move buttons** next to the drag handle, which gives each item five tab stops.

dnd-kit 6 declares `react >=16.8` and is tested upstream against React 16 to 18; the app runs React 19. A spike checked it before building on it: types under the repo's strict settings, `<StrictMode>`, keyboard drag in jsdom and, for this slice, keyboard, mouse and palette drags in a real browser (dev and production builds).

## Options considered

### What starts a canvas drag

- **A: the select button is the activator.** No extra control, but Enter would start a drag instead of selecting, and dnd-kit's `aria-pressed` while dragging would collide with the select button's own `aria-pressed`.
- **B: a separate _Reorder_ handle** (`<button>`, named "Reorder Amount") beside the select button. One more tab stop, but each control does one thing.

### Which region speaks the drag

- **A: route everything through the app's region** (return `undefined` from dnd-kit's announcements and call `announce` instead). One region, but its batching would join every arrow-key step ("over 2. over 3. over 4") instead of replacing it.
- **B: dnd-kit's region speaks the drag lifecycle; the app's speaks everything else** (Move buttons, palette clicks, saves). No event is spoken by both.

### How the palette drags

- **A: pointer and keyboard.** A keyboard drag from the palette would take over Enter and Space, which are the keyboard way to add a field.
- **B: pointer only.** A `CanvasKeyboardSensor` (a `KeyboardSensor` subclass) refuses to start from a palette source, so the keys keep clicking. Keyboard users add with Enter and then move the field with the handle or the buttons.

### The Move buttons

- **A: drop them**, leaving keyboard drag as the only non-mouse path. Fewer tab stops, but it fails 2.5.7: a single-pointer user (switch, head pointer, some touch users) has no way to reorder without dragging.
- **B: keep _Move up_ and _Move down_ on every item**, beside the handle and _Remove_.

### If dnd-kit had failed the spike

Ship the Move buttons plus native HTML5 drag for the mouse only, and record it as a deviation from D-28. Not needed: the spike passed.

## Decision

**B, B, B and B.** dnd-kit stays (D-28), driven through a separate _Reorder_ handle; dnd-kit's region speaks drags and the app's region everything else; the palette drags by pointer only; and every canvas item keeps _Move up_ and _Move down_.

The deciding reason for the buttons is 2.5.7: they are the single-pointer alternative to dragging, which keyboard drag alone does not give. The owner considered removing them and kept them for that reason.

**One action, two inputs.** The handle and the buttons do not have separate implementations. A drop is turned into an action by a pure function, `resolveDrop(active, over, fields)`, and both a drop and a button press dispatch the same reducer action, `{ type: 'field/moved', fieldId, toIndex }`. The rules of a move (clamped index, a move to the same place changes nothing, the selection stays with its field, conditions untouched) live once, in `builderReducer`, and are tested once. A palette drop dispatches `field/added` with an `at` index, the same action a palette click sends without one.

Details:

- **Focus.** After a keyboard drop dnd-kit returns focus to the handle. After a Move button, React moves the item's DOM node, which blurs the button, so the builder puts focus back on it; at either end that button is now disabled (native `disabled`, out of the tab order), so focus goes to the field's other Move button.
- **Wording.** dnd-kit's region says "Picked up Amount, position 2 of 5.", "Amount is over position 3 of 5.", "Amount dropped at position 3 of 5." and "Reorder cancelled. Amount is back at position 2." It speaks only a change of position, since dnd-kit reports the item as over its own place just after pick-up. The app's region says "Amount moved to position 1 of 5." for a button. The handle is described by instructions that also name the Move buttons.
- **Overlay.** A `DragOverlay` chip follows the pointer for a palette drag only. While an overlay is mounted, dnd-kit measures collisions from it, so a canvas item is dragged in place with no overlay.
- **Keyboard scrolling.** When the next position is off-centre, dnd-kit's keyboard sensor scrolls the page first. It uses an instant scroll (`scrollBehavior: 'auto'`), so the next arrow key always moves the field with no animation to wait out.
- **Preview is free of drafts.** Preview (v0.8) reuses `FillForm`, which persists nothing; only Fill's route stores through `onSubmit`. v0.10 must put draft autosave in `ResponseSession` or the route, never in `FillForm` or `useFormRuntime`, or Preview would start writing drafts. v0.10 re-tests that Preview stores nothing.

## Consequences

- Each canvas item has five tab stops: handle, select, Move up, Move down, Remove. The order is logical, but a long form is many Tab presses. Revisit with more time: one tab stop per item with roving focus inside it.
- dnd-kit's type declarations use the global `JSX` namespace that `@types/react` 19 dropped; `skipLibCheck` (already on) hides this. The runtime uses no API React 19 removed.
- jsdom has no layout, so tests give list items a box with `stubListLayout()` (`src/test/layout.ts`) and drive real keyboard drags. Mouse and palette drags are checked by hand in a browser at each gate.
- There is no gap preview while dragging from the palette, and no keyboard drag from it; Enter adds after the selection, then the handle or the buttons move it.
- dnd-kit loads only with the builder ([ADR 0017](0017-route-code-splitting.md)).
