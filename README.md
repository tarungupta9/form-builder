# Form builder

Design form templates in Builder mode, fill them in, and export each response as a PDF. Everything runs in the browser and is stored in `localStorage`. **Version: v1.0.1**.

- **Builder:** the spec's nine field types (Short text, Long text, Number, Date, Single select as radio, dropdown or tiles, Multi select, Section header, File upload, Calculation), each with its own settings. Fields reorder by drag (mouse or keyboard) or with _Move up_ / _Move down_. The form can be previewed before saving, unsaved changes are protected, and a template can be deleted with its responses.
- **Conditions:** a field can be shown, hidden, required or made optional by conditions on other fields' answers, chains included. The builder refuses loops, warns about conditions that cannot change anything, and asks before removing a field or option that conditions use.
- **Fill:** visibility, required state and calculations update as the respondent types. A response in progress is saved as a draft from the first input and can be resumed or discarded; submitting validates every visible field.
- **Responses and PDF:** each template has a responses page; each submitted response opens read-only and downloads as a PDF with the form title, submission time and every visible field in form order. Files appear as name, size and type.

Every view has a URL and works after a full page refresh. Built in eleven verified slices ([implementation plan](docs/implementation-plan.md)), from the [design](docs/high-level-design.md) of the [assignment](docs/spec.md). The [AI usage log](docs/ai-usage-log.md) records how AI was used and where its output was rejected.

## Run it locally

Requires Node 20 or later.

```sh
npm install
npm run dev        # http://localhost:5173
```

| Command                      | What it does                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `npm test`                   | Run the tests once (`npm run test:watch` to keep watching)                                   |
| `npm run check`              | Type-check, lint and run every test                                                          |
| `npm run build`              | Type-check and build for production into `dist/`                                             |
| `npm run preview`            | Serve the production build from `dist/` (run `npm run build` first)                          |
| `npm run check:seam -- v0.N` | List the source files changed since tag `v0.N`; fail if any is outside the field-plugin seam |

The build uses relative paths and a hash router, so `dist/` runs from any static host or sub-path.

**Live demo:** <https://tarungupta9.github.io/form-builder/>. The [workflow](.github/workflows/deploy.yml) runs the format check, `npm run check` and the build on every push and pull request, and deploys `main` to GitHub Pages only when they pass.

## `localStorage` schema

One key per kind of entity, each holding a versioned envelope with items keyed by ID:

```
formBuilder:v1:templates  →  { schemaVersion: 1, items: { [templateId]: FormTemplate } }
formBuilder:v1:responses  →  { schemaVersion: 1, items: { [responseId]: FormResponse } }
```

A **template** stores its fields in form order, each with its type's settings and its full condition logic (`defaultVisible`, `defaultRequired`, and the four condition groups).

A **submitted response** is self-contained: it stores a **snapshot** of the form it answered (title, description and the visible fields, in form order) next to the answers, so editing the template later never changes it ([ADR 0010](docs/decisions/0010-response-snapshot.md)):

```ts
{ status: 'submitted', id, templateId, createdAt, submittedAt,
  snapshot: { title, description, fields: Field[] },
  answers: { [fieldId]: { kind: 'text', value: 'Ada' } } }   // visible, non-empty answers only
```

A **draft**, a response in progress, lives in the same key ([ADR 0019](docs/decisions/0019-drafts-and-resume.md)):

```ts
{ status: 'draft', id, templateId, createdAt, updatedAt,
  templateUpdatedAt,                                       // the template the values were saved against
  values: { [fieldId]: { kind: 'text', value: 'Ad' } } }   // raw input, hidden fields included
```

Submitting writes the `submitted` record over the draft under the same ID, in one write. Each answer is tagged with its kind, and on read it must belong to a field in its snapshot and fit that field's type.

Why this shape ([ADR 0007](docs/decisions/0007-localstorage-schema.md)):

- **One key per kind:** listing templates is one read, and saving a template never re-serialises responses. A key per entity would make listing a scan of every key; one key for everything would rewrite every response on each template save.
- **A version envelope:** old shapes can be upgraded on read (`storage/migrations.ts`); data saved by a newer version is left untouched. The shapes were fixed in v0.1, so no slice ever needed a migration.
- **Validated on read:** stored data is untrusted, so it is parsed with zod item by item ([ADR 0004](docs/decisions/0004-zod-at-the-storage-boundary.md)). An item that fails is **set aside on its own**: the stored value is first copied to `formBuilder:quarantine:<key>:<timestamp>`, the valid items load, and the screen says how many items were set aside and names the backup key ([ADR 0012](docs/decisions/0012-set-aside-unreadable-items.md)). Nothing is ever silently wiped.
- **Failures are reported, never lost:** a full quota shows "Storage is full" and keeps the edits on screen; another tab's changes refresh every screen, and saving over another tab's save asks first.

## Architecture

### Component structure

```
src/
  domain/     pure types and logic: templates, responses, IDs, and the rules engine (domain/rules)
  fields/     one folder per field type, behind the plugin contract (contract.ts, two registries)
  storage/    the localStorage collections, zod schemas, migrations, StorageContext
  features/   one folder per screen: templates-list, builder, fill, responses, export
  ui/         presentational building blocks: Button, Dialog, ActionMenu, Toast, FormField, Switch, LiveRegion
  app/        router, shell and page layout, Not found, focus and title on route change
```

- **Field types are plugins** ([ADR 0008](docs/decisions/0008-field-types-as-plugins.md)). Each type is a folder with a pure `definition` (defaults, validation, how a condition reads it, how it exports) and its React `Editor` and `Renderer`. The builder, Fill, the rules engine and the PDF never name a field type. Adding another type (the spec's "11th field type") is its folder, one `FieldTypeMap` entry and two registry lines; `npm run check:seam` proves it from the git diff, and was run at each type slice.
- **Logic lives outside components.** The rules engine is a pure function from a template and its values to each field's visibility, required state and derived value. The builder's draft is a pure reducer ([ADR 0003](docs/decisions/0003-state-reducer-and-external-store.md)); saved data is read through `useSyncExternalStore`. Hooks (`useFormRuntime`, `useDraftAutosave`, `useUnsavedChangesGuard`) connect them to presentational components.
- **One view for a submitted response.** Each plugin turns its answer into a small export vocabulary (a section heading, or an answer that is empty, text or a list, with an optional note). `ResponseDocument` renders that, both on screen for a read-only response and in the PDF, so the two cannot disagree ([ADR 0011](docs/decisions/0011-pdf-through-the-print-dialog.md)).

### Conditional logic: how conditions combine (AND / OR)

Each field has a **Show** group and a **Hide** group of conditions, and every field that takes an answer also has a **Mark as required** group and a **Mark as not required** group. **Each of the four groups has its own setting, _all_ (AND) or _any_ (OR), and new groups start on _all_.** Groups are flat: there is no `(A and B) or (C and D)`. So "show Nights when the type is Travel **or** Meals" is one Show group set to _any_, while the same field's required group can say "required when the amount is over 50 **and** the payment is Cash".

- A group with no conditions does nothing; when no group matches, the field's default applies ("When the form opens: Visible / Hidden", and the Required switch).
- **Hide beats show** when both groups match: when the rules disagree, the form collects less. **Require beats not-require**: when unsure, ask (D-2). The builder says so under the groups.
- A hidden field is never required and never validated, and its answer is not submitted or exported. It is kept while the form is open, so showing the field again restores it (D-9).
- A condition whose target has no answer never matches, even _does not equal_ or _contains none of_ (D-4).
- A hidden field counts as unanswered, so in a chain A → B → C, C falls back to its default when B hides (D-5). Chains resolve in one pass in dependency order, whatever the form order.
- A condition can read any field above or below, never itself; a field that already depends on this one is listed but disabled, so a loop cannot be authored (Q-4, D-6).
- Text compares trimmed and ignoring case; _is within range_ includes both ends (D-7, D-8).
- Calculations read Number fields only, never another calculation, and are computed in the same pass, so they update live too (D-14, [ADR 0018](docs/decisions/0018-derived-values-through-the-plugin-contract.md)).

Full reasoning, with the options weighed: [ADR 0014](docs/decisions/0014-conditional-logic-semantics.md) and [ADR 0015](docs/decisions/0015-confirm-and-cascade-deleted-references.md).

### Architecture decisions

Every decision with real alternatives has an ADR; the [decision log](docs/README.md#decision-log) lists them with their status.

| ADR                                                                       | Decision                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](docs/decisions/0001-vite-react-typescript-strict.md)               | Vite, React 19 and strict TypeScript, with no `any`.                                                                                                                                                                                                                                                                                                          |
| [0002](docs/decisions/0002-hash-router.md)                                | A hash router, so every view has a URL that survives a refresh on any static host. Focus moves to the new page's heading after each navigation.                                                                                                                                                                                                               |
| [0003](docs/decisions/0003-state-reducer-and-external-store.md)           | A pure reducer for the template being edited; `useSyncExternalStore` over the storage collections for saved data. No state library.                                                                                                                                                                                                                           |
| [0004](docs/decisions/0004-zod-at-the-storage-boundary.md)                | Every read from `localStorage` is validated with zod; branded IDs are minted only after the string is checked.                                                                                                                                                                                                                                                |
| [0005](docs/decisions/0005-css-modules-and-tokens.md)                     | CSS Modules with design tokens, and no UI library.                                                                                                                                                                                                                                                                                                            |
| [0006](docs/decisions/0006-vitest-and-testing-library.md)                 | Vitest and Testing Library, tests named by user scenario and querying by role and label; axe-core on every page in its key states.                                                                                                                                                                                                                            |
| [0007](docs/decisions/0007-localstorage-schema.md)                        | One versioned collection per entity kind (above).                                                                                                                                                                                                                                                                                                             |
| [0008](docs/decisions/0008-field-types-as-plugins.md)                     | Each field type is a plugin behind one typed contract. Shared code asks `takesAnswer(field)`, which narrows the whole field, so display-only types join with no builder change.                                                                                                                                                                               |
| [0009](docs/decisions/0009-template-details-in-a-dialog.md)               | The builder's heading is the template's title, with an edit button that opens a dialog for title and description; the config panel is only about fields.                                                                                                                                                                                                      |
| [0010](docs/decisions/0010-response-snapshot.md)                          | Each submitted response stores the visible fields it answered, so a re-downloaded PDF always matches what was submitted (D-10).                                                                                                                                                                                                                               |
| [0011](docs/decisions/0011-pdf-through-the-print-dialog.md)               | The PDF is the browser's print dialog ("Save as PDF") over an off-screen iframe with a print stylesheet, since PDF libraries are banned. One `ResponseDocument` view renders it and the read-only response.                                                                                                                                                   |
| [0012](docs/decisions/0012-set-aside-unreadable-items.md)                 | One unreadable stored item is backed up and set aside on its own, and the rest load.                                                                                                                                                                                                                                                                          |
| [0013](docs/decisions/0013-number-as-a-text-input.md)                     | Number is `type="text"` with `inputMode`, stored as typed, so "12a" and extra decimals are reported, never silently changed (D-15).                                                                                                                                                                                                                           |
| [0014](docs/decisions/0014-conditional-logic-semantics.md)                | How conditions combine, resolve conflicts and refuse loops (above).                                                                                                                                                                                                                                                                                           |
| [0015](docs/decisions/0015-confirm-and-cascade-deleted-references.md)     | Removing a field or option that conditions use asks first, naming the fields, then removes those conditions with it (D-12). Warnings are a separate channel and never block Save (D-3).                                                                                                                                                                       |
| [0016](docs/decisions/0016-drag-and-drop-reordering.md)                   | dnd-kit from a separate _Reorder_ handle (Space, arrows, Space), plus _Move up_ / _Move down_, the single-pointer alternative WCAG 2.5.7 requires. Both dispatch one `field/moved` action.                                                                                                                                                                    |
| [0017](docs/decisions/0017-route-code-splitting.md)                       | Routes are split with `React.lazy`: the home page loads with the app (451 kB, 142 kB gzip), dnd-kit only with the builder, the print view only on export. No chunk passes Vite's 500 kB warning.                                                                                                                                                              |
| [0018](docs/decisions/0018-derived-values-through-the-plugin-contract.md) | A calculation's plugin has an optional `derivation` member (sources, removing one, computing the value), which the rules engine runs in the same pass as visibility without naming the type.                                                                                                                                                                  |
| [0019](docs/decisions/0019-drafts-and-resume.md)                          | The first input saves a draft at its own URL; later changes save 400 ms after typing pauses, and at once on `pagehide`. A resumed draft reads against the current template. Submitting keeps the ID, and that URL then shows the record read-only. A second tab cannot submit over it: the first submit wins.                                                 |
| [0020](docs/decisions/0020-card-actions-in-a-menu.md)                     | Each template card shows one action, _New response_; _Open in builder_, _View responses_ and _Delete_ sit in a "More actions" menu built to the ARIA menu-button pattern. Choosing an item returns focus to the menu button first, so Cancel on Delete lands there. The card's title is itself a link to the builder, as the spec's "click a template" asks.  |
| [0021](docs/decisions/0021-builder-fits-the-viewport.md)                  | Every page shares one centred frame, capped at 1600 px. On screens at least 1001 × 600 px the builder fills the viewport's height and the palette, field list and settings each scroll on their own with a pinned title; canvas and settings share the width 3 : 2. A route `handle` marks the builder as a workspace page; smaller screens keep page scroll. |
| [0022](docs/decisions/0022-toast-for-success-feedback.md)                 | Save and Delete confirm with a 4-second toast that pauses on hover. It is `aria-hidden`: the one live region speaks the same message, so nothing is announced twice. Errors stay inline alerts.                                                                                                                                                               |

### Product decisions on gaps in the spec

The spec leaves these open; each is a `D-n` entry in [the design](docs/high-level-design.md#2-gaps-in-the-spec-and-the-product-decisions-we-propose-for-them), with its reasoning.

| Decision                       | Summary                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| When answers are validated     | On submit, as the spec says. After a failed submit every change re-validates, so an error clears as soon as it is fixed. An error summary takes focus and each entry moves focus to its field.                                 |
| Announcing changes in Fill     | One polite announcement once a change has settled (400 ms), naming one or two fields ("Nights and Approval reason shown") and counting three or more, including required changes. Typing never floods a screen reader.         |
| Single select, three looks     | Radio, dropdown and tiles share one value and one validation rule: tiles are native radios, the dropdown a native `<select>` that never preselects. A parameterised test pins the same behaviour for all three.                |
| Choice answers (D-11)          | An answer stores the option's ID, never its label, so renaming or reordering options keeps every answer, while a past response keeps the label it was answered with.                                                           |
| Dates (D-16)                   | Local `YYYY-MM-DD`. _Start with today's date_ uses the local day, never `toISOString()`, which is a day out around midnight.                                                                                                   |
| Section headers (D-18, D-19)   | Sizes XL to XS are `h2` to `h6` on the page and in the PDF; the form title is the only `h1`. They count as fields on the card, matching the canvas.                                                                            |
| Calculations (D-14)            | Sum, average, minimum or maximum, rounded to the set decimals. Empty and hidden sources are left out; with none filled the result is empty ("—"), never `0`. A calculation with no sources blocks Save.                        |
| File types (D-17)              | Allowed types are typed freely and saved normalised. Each file is checked when chosen, not only through `accept`, and again on submit. Only name, size, type and last-modified are stored.                                     |
| Unsaved changes (D-21)         | Leaving the builder with unsaved edits asks first, with _Stay_ focused; closing the tab gets the browser's prompt. Unsaved means different in content from the last save.                                                      |
| Deleting a template (D-22)     | The confirmation states the response count, in the text and on the button ("Delete template and 3 responses"). Responses go first, so a failure never leaves responses nothing links to.                                       |
| Drafts (D-23)                  | Listed under _In progress_ with _Resume_ and _Discard_. A pre-filled date is not input, so opening a form and leaving saves nothing.                                                                                           |
| Empty templates (D-20, D-36)   | Can be saved, but _New response_ on the card and _Preview_ in the builder are disabled, each with the reason shown as text. Problems that block Save never disable _Preview_.                                                  |
| Titles and labels (D-34, D-35) | A template cannot be saved without a title, nor a field without a label. Each Save issue focuses the control that fixes it.                                                                                                    |
| PDF after submit (D-23)        | _Download PDF_ appears once a response is submitted, not while it is a draft: the PDF carries a submission timestamp, and a submitted response never changes, so every download of it matches.                                 |
| What the PDF shows             | Title, description, "Submitted" in the viewer's time zone with its name, the response ID, then every field of the snapshot in form order; "Not answered" for an empty answer; files as `hotel.pdf · 2.4 MB · PDF` with a note. |

## Known trade-offs

- **The PDF goes through the print dialog.** It is not a one-click download: the user picks "Save as PDF" in the browser's dialog. The app cannot tell a saved PDF from a cancelled dialog, so it shows no success message ([ADR 0011](docs/decisions/0011-pdf-through-the-print-dialog.md)).
- **Page numbers depend on the browser.** They come from the CSS `@page` footer, which Chromium-based browsers print. Elsewhere, the browser's own "Headers and footers" option adds them; margins also differ slightly between browsers.
- **Builder edits are not recovered after a crash.** Leaving with unsaved edits asks first, but a crash or a killed tab loses them (D-33 was cut; see below).
- **Condition groups are flat.** `(A and B) or (C and D)` cannot be expressed in one effect; the stored shape could take nested groups later without a migration ([ADR 0014](docs/decisions/0014-conditional-logic-semantics.md)).
- **Last write wins across tabs, but never silently.** The builder asks before saving over another tab's save. Two tabs on one draft do not warn while typing (below), but once one tab submits, the other's Submit is refused, so a submitted response never changes (D-10).
- **Very large calculation results.** A result of 10²¹ or more prints in exponent notation, which the app does not read as a number, so the calculation shows "—". Number fields have no built-in magnitude cap; an author can set a maximum.
- **Editing the address by hand skips the unsaved-changes prompt.** In-app links, Back and reload all ask first, but a hash typed into the address bar makes a history entry React Router did not create, so its blocker cannot stop it (D-21).

## With more time

- **Builder crash recovery (D-33).** Mirror unsaved builder edits to a recovery key and offer _Restore_ or _Discard_ on reopening; designed in the HLD, cut at v1.0 as the plan's designated cut.
- **A Playwright smoke test.** One build-fill-submit-export run in real Chromium and WebKit, to cover what jsdom cannot: layout, the print dialog, real drag and real typing into native date inputs, where a scripted pre-submission pass found a bug jsdom could not see. Cut at v1.0; those checks were run as scripted browser passes but are not in the repo.
- **A one-click PDF download.** Write the PDF bytes by hand and download them as a `Blob`: about 500 lines and, without font embedding, Latin-1 only ([ADR 0011](docs/decisions/0011-pdf-through-the-print-dialog.md)).
- **Nested condition groups**, once the builder UI and its accessibility are designed ([ADR 0014](docs/decisions/0014-conditional-logic-semantics.md)).
- **A dependency graph per axis.** Required conditions count toward loop refusal like visibility ones, so "A shows on B" with "B is required on A" is refused although it is well defined ([ADR 0015](docs/decisions/0015-confirm-and-cascade-deleted-references.md)).
- **Undo after removing a field or option.** The confirmation is the only safety net today; undo needs a history stack in the builder's reducer.
- **One tab stop per canvas field.** Each field has five (Reorder, select, Move up, Move down, Remove); roving focus would make a long form quicker to tab through ([ADR 0016](docs/decisions/0016-drag-and-drop-reordering.md)).
- **A lasting notice for set-aside data.** The notice lasts for the tab's session; listing the `formBuilder:quarantine:…` keys with restore or dismiss would keep it in view until handled.
- **Focus when the focused field hides.** Typing cannot hide the field being typed in, but autofill could; focus should move to the next visible field.
- **Make forgetting the derivations a compile error.** The engine's `derivations` parameter defaults to none to keep the pure rule tests short ([ADR 0018](docs/decisions/0018-derived-values-through-the-plugin-contract.md)).
- **Two tabs on one draft.** The last autosave wins; a `storage`-event check, like the builder's save conflict, would warn instead ([ADR 0019](docs/decisions/0019-drafts-and-resume.md)).
- **Drafts under their own key**, so autosave does not rewrite submitted responses on every pause in typing.
- **A cleaner name for the all / any select.** Its label wraps the select, so screen readers include the options in its name ("Show this field when all any of these match"); an explicit `aria-labelledby` would fix it.
