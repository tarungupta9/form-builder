# Form builder

Design form templates in Builder mode, fill them in, and export each response as a PDF. Everything runs in the browser and is stored in `localStorage`.

The app is built in verified slices ([implementation plan](docs/implementation-plan.md)). **Current version: v0.3** (in review): the templates list, the builder and Fill mode, with Short text fields. A form can be filled in and submitted; each template has a responses page listing its submitted responses, newest first, and each response downloads as a PDF, right after submit or later from the list. More field types arrive in v0.4.

## Run it locally

Requires Node 20 or later.

```sh
npm install
npm run dev        # http://localhost:5173
```

| Command                      | What it does                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run check`              | Type-check, lint and run every test                                                          |
| `npm test`                   | Run the tests once (`npm run test:watch` to keep watching)                                   |
| `npm run build`              | Production build into `dist/` (`npm run preview` serves it)                                  |
| `npm run check:seam -- v0.N` | List the source files changed since tag `v0.N`; fail if any is outside the field-plugin seam |

The build uses relative paths and a hash router, so `dist/` runs from any static host or sub-path.

## `localStorage` schema

One key per kind of entity, each holding a versioned envelope with items keyed by ID:

```
formBuilder:v1:templates  →  { schemaVersion: 1, items: { [templateId]: FormTemplate } }
formBuilder:v1:responses  →  { schemaVersion: 1, items: { [responseId]: FormResponse } }
```

A submitted response is self-contained: it stores a **snapshot** of the form it answered (title, description and the visible fields, in form order) next to the answers, so editing the template later never changes it ([ADR 0010](docs/decisions/0010-response-snapshot.md)):

```ts
{ status: 'submitted', id, templateId, createdAt, submittedAt,
  snapshot: { title, description, fields: Field[] },
  answers: { [fieldId]: { kind: 'text', value: 'Ada' } } }   // visible, non-empty answers only
```

Each answer is tagged with its kind, and on read it must belong to a field in its snapshot and fit that field's type. The `draft` shape that v0.10 writes is already in the schema, so stored data never needs migrating between slices.

- **Why one key per kind:** listing templates is one read, and saving a template never re-serialises other data. A key per entity would make listing a scan of every key; one key for everything would rewrite every response on each template save.
- **Why a version envelope:** old shapes can be upgraded on read (`storage/migrations.ts`). Data saved by a newer version is left untouched.
- **Why validate on read:** stored data is untrusted. It is parsed with zod before use, item by item. An item that fails is **set aside on its own**: the stored value is first copied to `formBuilder:quarantine:<key>:<timestamp>`, then the valid items load, and the screen says how many items were set aside and names the backup key ([ADR 0012](docs/decisions/0012-set-aside-unreadable-items.md)). A key that cannot be read at all is backed up the same way, explained on screen, and never written over. Nothing is ever silently wiped.
- **Failures are reported, never lost:** a full quota shows "Storage is full" and keeps the edits on screen; another tab's changes refresh every screen.
- **The stored shapes are final:** templates since v0.1, responses since v0.2. Each field is stored with its full condition logic, so later versions read data saved today.

Full reasoning: [ADR 0007](docs/decisions/0007-localstorage-schema.md).

## Key decisions

Every decision with real alternatives has an ADR in [`docs/decisions/`](docs/README.md#decision-log). Product decisions on gaps in the spec are the `D-n` entries in [the design](docs/high-level-design.md#2-gaps-in-the-spec-and-the-product-decisions-we-propose-for-them).

| Decision                                                                                                                                                                           | Summary                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Field types are plugins](docs/decisions/0008-field-types-as-plugins.md)                                                                                                           | Each type is one folder behind a typed contract, registered in two exhaustive registries. Adding a type is its folder, one `FieldTypeMap` entry and two registry lines.                                                                                                                                        |
| [Builder state](docs/decisions/0003-state-reducer-and-external-store.md)                                                                                                           | A pure reducer for the template being edited; `useSyncExternalStore` over the storage repositories for saved data.                                                                                                                                                                                             |
| [zod at the boundary](docs/decisions/0004-zod-at-the-storage-boundary.md)                                                                                                          | Every read from `localStorage` is validated; branded IDs are minted only after the string is checked.                                                                                                                                                                                                          |
| [Hash routing](docs/decisions/0002-hash-router.md)                                                                                                                                 | Every view has a URL that survives a refresh on any static host. Focus moves to the new page's heading after each navigation.                                                                                                                                                                                  |
| [Stack](docs/decisions/0001-vite-react-typescript-strict.md), [styling](docs/decisions/0005-css-modules-and-tokens.md), [tests](docs/decisions/0006-vitest-and-testing-library.md) | Vite, React 19, strict TypeScript; CSS Modules with design tokens; Vitest and Testing Library, tests named by user scenario.                                                                                                                                                                                   |
| [Template details in a dialog](docs/decisions/0009-template-details-in-a-dialog.md)                                                                                                | The builder's heading is the template's title, with an edit button that opens a native `<dialog>` for title and description. Cancel or Escape discards the draft; the config panel is only about fields.                                                                                                       |
| [Response snapshot](docs/decisions/0010-response-snapshot.md)                                                                                                                      | Each submitted response stores the visible fields it answered, so a re-downloaded PDF always matches what was submitted (D-10). The form is fixed when it opens, so an edit in another tab never shifts it under the respondent; if the template is deleted meanwhile, submit is refused and the answers kept. |
| Number answers keep what was typed                                                                                                                                                 | A Number answer is stored as `{ kind: 'number', input: '12.50' }`, the text as typed, not a parsed number, so "12a" can be reported as not a number and "1.505" as too many decimals instead of being silently changed (D-15, from v0.4).                                                                      |
| One generic collection per key                                                                                                                                                     | Storage is one `Collection` type (snapshot, put, remove, reset, subscribe) per `localStorage` key, not a repository per entity. Screens derive what they need (sorted lists, response counts) from the snapshot, so storage knows nothing about screens.                                                       |
| When answers are validated                                                                                                                                                         | On submit, as the spec says. After the first failed submit every change re-validates, so an error clears as soon as it is fixed. An error summary takes focus and each entry moves focus to its field. A hidden field is never validated.                                                                      |
| D-20                                                                                                                                                                               | A template with no fields can be saved, but _New response_ is disabled on its card, with the reason shown as text (a disabled button cannot take focus, so a tooltip would never be read).                                                                                                                     |
| D-34, D-35                                                                                                                                                                         | A template cannot be saved without a title, nor a field without a label.                                                                                                                                                                                                                                       |
| [PDF through the print dialog](docs/decisions/0011-pdf-through-the-print-dialog.md)                                                                                                | The response is rendered into an off-screen iframe with a print stylesheet and printed with the browser's own dialog ("Save as PDF"), since PDF libraries are banned. The same `ResponseDocument` view will show a submitted response on screen (v0.10), so the screen and the PDF cannot disagree.            |
| [Export vocabulary](docs/decisions/0011-pdf-through-the-print-dialog.md)                                                                                                           | Each field type's plugin turns its answer into one of a few presentation shapes (a section heading, or an answer whose value is empty, text or a list, with an optional note). The export view knows those shapes, never the field types, so new types need no change to it.                                   |
| What the PDF shows                                                                                                                                                                 | The title, the description when set, "Submitted" in the viewer's time zone with its name, the full response ID, then every field of the snapshot in form order; an empty answer reads "Not answered"; page numbers in the footer. The file name is `<title> – response <date> <time>`.                         |
| Where _Download PDF_ is                                                                                                                                                            | The spec's Fill-mode "Download PDF" is on the confirmation shown after submit, and each row of the responses list has _Re-download PDF_. Never before submit: only a submitted response has a submission timestamp (D-23).                                                                                     |
| [Unreadable items are set aside](docs/decisions/0012-set-aside-unreadable-items.md)                                                                                                | One invalid template or response is backed up and set aside on its own, and the rest load, instead of one bad item hiding the whole collection.                                                                                                                                                                |
| [Number is a text input](docs/decisions/0013-number-as-a-text-input.md)                                                                                                            | D-15: `type="text"` with `inputMode`, not `type="number"`, so the scroll wheel cannot change it and `1e3` is refused. Extra decimals are an error, never rounded; a limit with more decimals than the field allows blocks Save.                                                                                |
| D-16                                                                                                                                                                               | Dates are local `YYYY-MM-DD`. _Start with today's date_ uses the local day, never `toISOString()` (the UTC date, a day out around midnight). If today is outside the allowed dates the field starts empty. Equal earliest and latest dates allow one day.                                                      |
| D-18                                                                                                                                                                               | Section sizes XL to XS are `h2` to `h6` on the page and in the PDF; the form title is the only `h1`. The builder points out a header that skips a level, announced in a live region, but never blocks Save.                                                                                                    |
| D-19                                                                                                                                                                               | The card's field count includes section headers ("5 fields"), matching what the author sees on the canvas.                                                                                                                                                                                                     |
| Narrow on the field, not its logic                                                                                                                                                 | Shared code asks `takesAnswer(field)`, which narrows the whole field, so display-only types such as the section header join the union with no builder change ([ADR 0008](docs/decisions/0008-field-types-as-plugins.md)).                                                                                      |

How several conditions on one field combine (AND / OR) is decided in D-1 and is documented here when conditional logic ships in v0.6.

## Known trade-offs

- **The PDF goes through the print dialog.** It is not a one-click download: the user picks "Save as PDF" (or a printer) in the browser's dialog. The app cannot tell a saved PDF from a cancelled dialog, so it shows no success message, only an alert if the dialog cannot open at all ([ADR 0011](docs/decisions/0011-pdf-through-the-print-dialog.md)).
- **Page numbers depend on the browser.** They come from the CSS `@page` footer ("Page 1 of 2"), which Chromium-based browsers print. A browser that ignores page margin boxes prints no page numbers of its own accord; turning on its "Headers and footers" print option adds them. Margins and default headers also differ slightly between browsers.

## With more time

Collected as the slices progress; see the risks in the [implementation plan](docs/implementation-plan.md#7-risks).

- **A one-click PDF download.** Write the PDF bytes by hand (pages, text objects, cross-reference table, our own wrapping and pagination) and download them as a `Blob`. It removes the print dialog, at the cost of about 500 lines and, without font embedding, characters outside Latin-1 ([ADR 0011](docs/decisions/0011-pdf-through-the-print-dialog.md)).
- **A lasting notice for set-aside data.** The notice that items were set aside lasts for the tab's session. Listing the `formBuilder:quarantine:…` keys on start-up, with a way to restore or dismiss each, would keep it in view until handled.
- **Answers are lost if the respondent leaves mid-form.** Until drafts arrive (v0.10), a filled-in form lives only in memory, and leaving the page does not warn.
