# 0020. Keep one action on each template card and move the rest into a menu

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

Each card on the home page showed four buttons in a row: _New response_, _Open in builder_, _View responses_ and _Delete_. With several cards on screen that is a wall of controls. The four looked equally important, Delete sat beside the everyday actions, and the row wrapped on narrow cards. In review the owner asked for a three-dot button that holds the secondary actions.

The constraints carried over from earlier slices:

- Every action stays reachable by keyboard and screen reader, with a visible focus indicator (WCAG 2.2 AA).
- Each card's controls stay distinguishable to a screen reader that lists every button on the page, so names carry the template's title.
- Delete lives on the card only, never in the builder (D8-9). Its confirmation dialog returns focus to whatever opened it, and falls back to the neighbouring card's title once the card is gone (D-22).
- Navigation stays client-side through react-router's `Link`, so a link still opens in a new tab and reads as a link.

## Options considered

### A. Keep all four buttons visible

Pros: no extra click, nothing hidden, no new component. Cons: the noise the owner raised. All four carry the same visual weight, and the destructive action sits beside the common ones.

### B. One primary action, the others in an overflow menu (chosen)

_New response_ stays on the card as the one visible action, because filling a form in is what the home page is mostly for. A kebab button beside the title opens a menu with _Open in builder_, _View responses_, a separator, and _Delete_ in the danger colour. Pros: a calm card with a clear primary action, Delete kept apart behind a separator, and a familiar pattern. Cons: one extra click for the secondary actions, and a new component that has to get keyboard and focus handling right.

### C. Make the whole card a link

The card opens the template, and the other actions sit inside it or in a menu. Pros: a large target. Cons: which action the card should open is not obvious (fill or edit?). Controls nested inside a link are invalid HTML, and the usual workaround of a stretched link over the card means every label and count is read as part of the link name. Linking only the title text avoids both problems, and is what the card does (see Consequences).

### Menu semantics: a disclosure list or the ARIA menu button pattern

- **Disclosure:** a button with `aria-expanded` that shows a plain list of links and buttons, each its own Tab stop. Simpler, with no custom key handling. But the open list adds three Tab stops per card, and screen readers announce nothing that says it is a menu of commands.
- **ARIA menu button** (WAI-ARIA APG): `aria-haspopup="menu"` on the trigger and `role="menu"` / `menuitem` inside. The arrow keys, Home and End move between items, and Escape returns to the trigger. The open menu is one Tab stop, and screen readers say "menu, 3 items". The cost is owning that key handling, since a menu that announces itself as one must behave like one.

## Decision

B, built as the ARIA menu button pattern in a reusable `src/ui/ActionMenu.tsx`. The deciding reasons: one visible primary action makes the card's purpose obvious, and the menu pattern keeps the open menu to a single Tab stop with the behaviour screen-reader users expect from something announced as a menu.

`ActionMenu` takes its items as data, as a discriminated union of `link`, `action` (with an optional `danger` tone) and `separator`, rendered through an exhaustive switch. A caller cannot hand it arbitrary markup that breaks the roles. Item names are short ("Delete"), because the trigger names the menu: "More actions for Travel".

## Consequences

- Secondary actions take one more click or keypress. _New response_, the most common action, does not.
- **The title links to the builder.** The spec says "Click a template — opens it in Builder Mode (edit)", so the card's title text is a `Link` to the builder, inside the `<h2>`. Only the title is the link, so its accessible name is the title alone and no control is nested inside it, which keeps option C's large-target idea without its cost. The target is smaller than a whole card, but it is the text people click on. _Open in builder_ stays in the menu too, so the menu still lists every destination. The heading keeps its id and `tabIndex={-1}`, so focus after a delete still lands on the neighbour's heading, not its link. The link inherits the heading's colour and type so it reads as a title, underlines on hover, and shows the global focus outline. Page tests pin the click, the Enter key, and the link's name inside the level-2 heading.
- **Focus after Delete.** The menu unmounts its items as it closes. If the Delete item were still focused when the confirmation dialog opened, the dialog would record an element that is about to disappear, and Cancel would send focus to the neighbouring card instead. So choosing any item moves focus back to the trigger _before_ the item runs. Cancel then returns to that card's "More actions" button. Confirm removes the card, so the dialog falls back to the neighbour's title as before. A unit test pins the order (the trigger is focused when `onSelect` runs), and a page test pins where Cancel lands.
- Tab from inside the menu also focuses the trigger first, then lets the browser move on. Otherwise focus would be on an unmounting item when the default action runs. Clicking elsewhere closes the menu through focus leaving it. While the menu is open, a press on the trigger keeps focus where it is, so Safari, which does not focus buttons on click, does not close and reopen the menu.
- A new pattern in `src/ui`, ready for other overflow actions (a responses row, the builder header) without new key handling. Each caller's tests open the menu first, through `src/test/cardMenu.ts` on the home page.
- The menu is absolutely positioned under its trigger with a z-index below the sticky header. It is not portalled, so a container with `overflow: hidden` would clip it; no current caller has one. It has a real border, so its edge survives forced colours.
- With more time: typeahead (pressing a letter jumps to the matching item, which the APG lists as optional), flipping the menu upward when it would run off the bottom of the viewport, and the CSS anchor-positioning API once it is broadly supported.
