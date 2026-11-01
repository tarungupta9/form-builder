# Form builder

Design form templates in Builder mode, fill them in, and export each response as a PDF. Everything runs in the browser and is stored in `localStorage`.

The app is built in verified slices ([implementation plan](docs/implementation-plan.md)). **Current version: v0.2**: the templates list, the builder and Fill mode, with Short text fields. A form can be filled in and submitted, and each card counts its responses. The responses list and PDF export arrive in v0.3.

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
- **Why validate on read:** stored data is untrusted. It is parsed with zod before use. Data that fails is copied to `formBuilder:quarantine:…` and explained on screen, never silently overwritten or wiped.
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

How several conditions on one field combine (AND / OR) is decided in D-1 and is documented here when conditional logic ships in v0.6.

## With more time

Collected as the slices progress; see the risks in the [implementation plan](docs/implementation-plan.md#7-risks).

- **Answers are lost if the respondent leaves mid-form.** Until drafts arrive (v0.10), a filled-in form lives only in memory, and leaving the page does not warn.
