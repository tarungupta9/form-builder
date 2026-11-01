# Form builder

Design form templates in Builder mode, fill them in, and export each response as a PDF. Everything runs in the browser and is stored in `localStorage`.

The app is built in verified slices ([implementation plan](docs/implementation-plan.md)). **Current version: v0.1**: the templates list and the builder, with Short text fields. Filling in, responses and PDF export arrive in the next slices.

## Run it locally

Requires Node 20 or later.

```sh
npm install
npm run dev        # http://localhost:5173
```

| Command         | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `npm run check` | Type-check, lint and run every test                         |
| `npm test`      | Run the tests once (`npm run test:watch` to keep watching)  |
| `npm run build` | Production build into `dist/` (`npm run preview` serves it) |

The build uses relative paths and a hash router, so `dist/` runs from any static host or sub-path.

## `localStorage` schema

One key per kind of entity, each holding a versioned envelope with items keyed by ID:

```
formBuilder:v1:templates  →  { schemaVersion: 1, items: { [templateId]: FormTemplate } }
```

Responses get their own key, `formBuilder:v1:responses`, in v0.2.

- **Why one key per kind:** listing templates is one read, and saving a template never re-serialises other data. A key per entity would make listing a scan of every key; one key for everything would rewrite every response on each template save.
- **Why a version envelope:** old shapes can be upgraded on read (`storage/migrations.ts`). Data saved by a newer version is left untouched.
- **Why validate on read:** stored data is untrusted. It is parsed with zod before use. Data that fails is copied to `formBuilder:quarantine:…` and explained on screen, never silently overwritten or wiped.
- **Failures are reported, never lost:** a full quota shows "Storage is full" and keeps the edits on screen; another tab's changes refresh every screen.
- **The template shape is final from v0.1:** each field is stored with its full condition logic, so later versions read data saved today.

Full reasoning: [ADR 0007](docs/decisions/0007-localstorage-schema.md).

## Key decisions

Every decision with real alternatives has an ADR in [`docs/decisions/`](docs/README.md#decision-log). Product decisions on gaps in the spec are the `D-n` entries in [the design](docs/high-level-design.md#2-gaps-in-the-spec-and-the-product-decisions-we-propose-for-them).

| Decision                                                                                                                                                                           | Summary                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Field types are plugins](docs/decisions/0008-field-types-as-plugins.md)                                                                                                           | Each type is one folder behind a typed contract, registered in two exhaustive registries. Adding a type is its folder, one `FieldTypeMap` entry and two registry lines.                                  |
| [Builder state](docs/decisions/0003-state-reducer-and-external-store.md)                                                                                                           | A pure reducer for the template being edited; `useSyncExternalStore` over the storage repositories for saved data.                                                                                       |
| [zod at the boundary](docs/decisions/0004-zod-at-the-storage-boundary.md)                                                                                                          | Every read from `localStorage` is validated; branded IDs are minted only after the string is checked.                                                                                                    |
| [Hash routing](docs/decisions/0002-hash-router.md)                                                                                                                                 | Every view has a URL that survives a refresh on any static host. Focus moves to the new page's heading after each navigation.                                                                            |
| [Stack](docs/decisions/0001-vite-react-typescript-strict.md), [styling](docs/decisions/0005-css-modules-and-tokens.md), [tests](docs/decisions/0006-vitest-and-testing-library.md) | Vite, React 19, strict TypeScript; CSS Modules with design tokens; Vitest and Testing Library, tests named by user scenario.                                                                             |
| [Template details in a dialog](docs/decisions/0009-template-details-in-a-dialog.md)                                                                                                | The builder's heading is the template's title, with an edit button that opens a native `<dialog>` for title and description. Cancel or Escape discards the draft; the config panel is only about fields. |
| D-34, D-35                                                                                                                                                                         | A template cannot be saved without a title, nor a field without a label.                                                                                                                                 |

How several conditions on one field combine (AND / OR) is decided in D-1 and is documented here when conditional logic ships in v0.7.

## With more time

Collected as the slices progress; see the risks in the [implementation plan](docs/implementation-plan.md#7-risks).
