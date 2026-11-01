# 0009. Edit the template's title and description in a dialog from the heading

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The builder first edited the title and description in the config panel, shown whenever no field was selected (D-32 as first written). In review of v0.1 the author asked for the heading to carry the template's name with an edit button beside it that opens a form for the name and description. Two problems with the panel approach came out of that. The page heading said "New template" or "Edit template" rather than which template was open. And the form's own settings appeared only after deselecting every field, which there was no obvious way to do once a field was selected.

## Options considered

### A. Keep the form settings in the config panel

Pros: no new component; every edit happens in one place. Cons: the details are hidden while any field is selected, and the heading cannot name the template.

### B. Edit the title in place in the heading

Pros: direct, like a document title. Cons: a heading that turns into a text box is unfamiliar to screen-reader users. The description, a multi-line field with a length limit and a counter, does not fit inline. And there is no clear moment to validate a blank title.

### C. A modal dialog opened from an edit button beside the heading

Pros: the heading always names the template. Title and description are edited together on a draft, so Cancel or Escape undoes cleanly and _Done_ validates both at once. A native `<dialog>` with `showModal()` gives the focus trap, the inert page behind it, and Escape for free. HLD §7 already planned a native dialog for Preview, so this adds the shared `ui/Dialog` a slice early rather than a new pattern. Cons: one more click than editing in place, and a modal hides the fields while it is open.

## Decision

C. The heading shows the title ("Untitled template" until there is one), followed by a pencil button named "Edit title and description". It opens `TemplateDetailsDialog`, which edits a draft. _Done_ applies the title and description in one reducer action (`details/changed`), and only when `detailsIssues` finds nothing wrong. Applying is not saving: the page's _Save_ still writes to storage, and still blocks when the title is blank. The config panel is now only about the selected field; with none selected it says so.

## Consequences

- One rule set: `detailsIssues` is used both by the dialog's _Done_ and by Save's `configIssues`, so they cannot disagree. A blank title can still reach Save on a new template whose dialog was never opened. The issue summary's "Title and description" link opens the dialog with the problem already shown.
- `Dialog` returns focus to the element that opened it, and falls back to the edit button when that element has gone, for example a summary link that disappears once its issue is fixed. It does this itself instead of relying on the browser, which does nothing when the opener has been removed.
- jsdom has no `showModal()`, so `src/test/setup.ts` stubs it with the behaviour the app depends on (the `open` attribute, focus on the first control, Escape, the `close` event). The stub does not make the page behind inert, so that part is checked by hand in a browser.
- The tab title stays "New template" / "Edit <title>", so browser history still says which mode a page was in.
- With more time: the fields could be shown read-only behind the dialog, and the dialog could ask before discarding a changed draft on Escape.
