# Docs

- [`spec.md`](spec.md): the assignment, transcribed from the PDF.
- [`high-level-design.md`](high-level-design.md): data model, module interfaces and the gap decisions (`D-n`).
- [`implementation-plan.md`](implementation-plan.md): the build order as verified slices, with each slice's gate and demo script.
- [`ai-usage-log.md`](ai-usage-log.md): significant AI prompts, what was verified, and what was rejected.

## Decision log

Architecture decision records, in the order they were made. The template is [`decisions/0000-template.md`](decisions/0000-template.md).

| #                                                          | Decision                                                               | Status   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| [0001](decisions/0001-vite-react-typescript-strict.md)     | Build with Vite, React 19 and TypeScript in strict mode                | Accepted |
| [0002](decisions/0002-hash-router.md)                      | Route with React Router's hash router                                  | Accepted |
| [0003](decisions/0003-state-reducer-and-external-store.md) | Hold builder state in a reducer and stored data in an external store   | Accepted |
| [0004](decisions/0004-zod-at-the-storage-boundary.md)      | Validate everything read from storage with zod                         | Accepted |
| [0005](decisions/0005-css-modules-and-tokens.md)           | Style with CSS Modules and design tokens                               | Accepted |
| [0006](decisions/0006-vitest-and-testing-library.md)       | Test with Vitest and Testing Library, by user scenario                 | Accepted |
| [0007](decisions/0007-localstorage-schema.md)              | Store one versioned collection per entity kind in `localStorage`       | Accepted |
| [0008](decisions/0008-field-types-as-plugins.md)           | Make each field type a plugin behind one contract                      | Accepted |
| [0009](decisions/0009-template-details-in-a-dialog.md)     | Edit the template's title and description in a dialog from the heading | Accepted |
| [0010](decisions/0010-response-snapshot.md)                | Store a snapshot of the form with each submitted response              | Accepted |
