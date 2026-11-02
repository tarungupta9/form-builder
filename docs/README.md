# Docs

- [`spec.md`](spec.md): the assignment, transcribed from the PDF.
- [`high-level-design.md`](high-level-design.md): data model, module interfaces and the gap decisions (`D-n`).
- [`implementation-plan.md`](implementation-plan.md): the build order as verified slices, with each slice's gate and demo script.
- [`ai-usage-log.md`](ai-usage-log.md): significant AI prompts, what was verified, and what was rejected.

## Decision log

Architecture decision records, in the order they were made. The template is [`decisions/0000-template.md`](decisions/0000-template.md).

| #                                                                    | Decision                                                                                  | Status                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [0001](decisions/0001-vite-react-typescript-strict.md)               | Build with Vite, React 19 and TypeScript in strict mode                                   | Accepted                                           |
| [0002](decisions/0002-hash-router.md)                                | Route with React Router's hash router                                                     | Accepted                                           |
| [0003](decisions/0003-state-reducer-and-external-store.md)           | Hold builder state in a reducer and stored data in an external store                      | Accepted                                           |
| [0004](decisions/0004-zod-at-the-storage-boundary.md)                | Validate everything read from storage with zod                                            | Accepted                                           |
| [0005](decisions/0005-css-modules-and-tokens.md)                     | Style with CSS Modules and design tokens                                                  | Accepted                                           |
| [0006](decisions/0006-vitest-and-testing-library.md)                 | Test with Vitest and Testing Library, by user scenario                                    | Accepted                                           |
| [0007](decisions/0007-localstorage-schema.md)                        | Store one versioned collection per entity kind in `localStorage`                          | Accepted (single-item failures superseded by 0012) |
| [0008](decisions/0008-field-types-as-plugins.md)                     | Make each field type a plugin behind one contract                                         | Accepted                                           |
| [0009](decisions/0009-template-details-in-a-dialog.md)               | Edit the template's title and description in a dialog from the heading                    | Accepted                                           |
| [0010](decisions/0010-response-snapshot.md)                          | Store a snapshot of the form with each submitted response                                 | Accepted (same-URL confirmation: see 0019)         |
| [0011](decisions/0011-pdf-through-the-print-dialog.md)               | Export PDFs through the browser's print dialog, from one shared response view             | Accepted                                           |
| [0012](decisions/0012-set-aside-unreadable-items.md)                 | Set aside unreadable stored items one by one, not the whole collection                    | Accepted                                           |
| [0013](decisions/0013-number-as-a-text-input.md)                     | Take Number answers in a text input, not `type="number"`                                  | Accepted                                           |
| [0014](decisions/0014-conditional-logic-semantics.md)                | Combine conditions per effect, fail closed on conflicts, and refuse loops while authoring | Accepted (D6-2 superseded by 0015)                 |
| [0015](decisions/0015-confirm-and-cascade-deleted-references.md)     | Confirm and cascade deleted references; warnings never block Save                         | Accepted                                           |
| [0016](decisions/0016-drag-and-drop-reordering.md)                   | Reorder with dnd-kit through a drag handle, and keep Move up / Move down                  | Accepted                                           |
| [0017](decisions/0017-route-code-splitting.md)                       | Split the code by route with `React.lazy`, and load the print view on export              | Accepted                                           |
| [0018](decisions/0018-derived-values-through-the-plugin-contract.md) | Plug derived values into the rules engine through an optional `derivation` member         | Accepted                                           |
| [0019](decisions/0019-drafts-and-resume.md)                          | Save a draft from the first input, and resume it against the current template             | Accepted                                           |
