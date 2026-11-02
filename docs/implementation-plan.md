# Implementation Plan — Verified Slices

- **Status:** Agreed. v0.1–v0.8 signed off; v0.9 and v0.10 are next, built in parallel (see the [tracker](#6-progress-tracker)).
- **Date:** 2026-11-01
- **Replaces:** the layer-by-layer delivery plan in [high-level-design.md §10](high-level-design.md#10-delivery-plan).

This plan builds the design in [`high-level-design.md`](high-level-design.md) as a sequence of thin **end-to-end slices**. Each slice is a version of the app that runs in the browser and cuts through every layer it needs: storage, domain, field plugins and screens. Each one ends at a **verification gate**. The next slice starts only after the owner signs off on the current one.

---

## 1. Why slices

The first pass built the system layer by layer. The domain types, the rules engine, storage, all nine field plugins and the UI primitives exist: about 5,000 lines, with 62 passing domain and storage tests. But there is no app entry point, so none of it can be seen working, and the field plugins have no tests. Building by layer means you can only check a layer by reading it and running its unit tests. You find out whether the layers fit together at the end, which is when mistakes cost the most.

A slice proves that the layers fit, and the person who owns the assessment can check it by using it. The order follows what the reviewer weighs:

1. the core loop first: build, fill, submit and export;
2. then more field types, one family at a time, each through builder, fill and PDF;
3. then the rules engine, which is the most heavily graded part;
4. then drafts, polish and the submission docs.

---

## 2. Ground rules

1. **One slice at a time, gated.** Work on slice _N + 1_ starts only after slice _N_ is signed off. Findings from a gate are fixed inside that slice, not carried forward.
2. **The existing code is a parts bin.** It was moved out of the repo, unchanged, to `../parts-bin/src` (beside this checkout), because the type checker and linter read everything in `src/`. A slice copies in only the files it needs: it reviews each one, trims it to what the slice uses, adds the missing tests and commits it with the slice. The handover lists every adopted file so the review can tell new code from pre-existing code. The parts bin is deleted at v1.0.
3. **The stored data shape is final from slice 1.** Templates are saved with their full `FieldLogic` (empty condition groups) and responses with their snapshot from the start. Later slices only add union members; they never change a stored shape. So no migrations are needed between slices, and test data created while verifying v0.2 still loads in v0.10.
4. **The field union grows one type at a time.** v0.1 starts `FieldTypeMap` with `text` only. A slice that adds a type adds its folder, one line in each registry and one map entry. **That diff is the evidence for the extensibility claim** ([HLD §1.2](high-level-design.md#12-non-functional)). `npm run check:seam -- <previous tag>` lists it and fails on any file outside the seam; v0.4, v0.5 and the field-type half of v0.9 run it at their gate. If a type slice has to edit shared Builder, Fill or export code, the gate fails and the seam is fixed in that slice.
5. **Trimming the union exposes seam leaks, and that is the point.** Known today: the card's field count compares against `'section'` (`domain/template.ts`); fixed in v0.1 by counting every field (D-19). The rules engine (`domain/rules/evaluate.ts`) and the storage invariants (`storage/schemas.ts`) special-case `'calculation'` and `'number'`. Each leak becomes a compile error in the slice that adopts the file (v0.1 or v0.2). It is fixed there, and if the fix changes the plugin contract it is recorded as a decision.
6. **Docs ship with the decision.** ADRs, README sections and AI usage log entries are written in the slice that makes the decision, while the alternatives are fresh ([AGENTS.md](../AGENTS.md#decision-records)).

---

## 3. The slice loop

### What the agent does

1. **Kickoff.** Restate the slice's scope, list the parts-bin files it will adopt, and raise any gap the slice hits that [HLD §2](high-level-design.md#2-gaps-in-the-spec-and-the-product-decisions-we-propose-for-them) does not cover. If there is an open decision, wait for the owner's call before building.
2. **Tests first** for the slice's use cases (listed per slice below), then the code.
3. **Self-check:** run the gate checklist below.
4. **Handover:** say what is new, list the adopted files, the decisions made and any known gaps, and give the demo script.
5. **Stop.** Do not start the next slice.

### What the owner does

1. Run the demo script against `npm run dev`.
2. Review the diff.
3. Sign off, or send findings back. Findings are fixed in the same slice and the gate is re-run.

**On sign-off:** commit the slice to the branch, tag it `v0.N`, and update the [tracker](#6-progress-tracker). Any signed-off version can be revisited with `git checkout v0.N`.

### Gate checklist (every slice)

- [ ] `npm run check` (types, lint, tests) and `npm run build` pass.
- [ ] Every use case listed for the slice has a test that goes red when the behaviour breaks.
- [ ] The demo script passes in the browser, including after a full page refresh. Where it can, it is also a flow test in `src/test/flows/`; VoiceOver and print checks stay manual.
- [ ] New UI works by keyboard alone with a visible focus indicator, and has been checked once with VoiceOver.
- [ ] Every data-driven view in the slice handles its empty, not-found and error states.
- [ ] No debug logging, no commented-out code, and no adopted file the slice does not use.
- [ ] Every major decision has an ADR and an index line in [`docs/README.md`](README.md), and the README reflects the change.
- [ ] The handover lists the adopted parts-bin files.

---

## 4. Slice overview

| Version | Slice                                                                                 | After it, a user can…                                                                             | Decisions recorded                                              |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| v0.1    | [Skeleton: list and builder](#v01--skeleton-list-and-builder)                         | create a template of short-text fields, save it, refresh, and find it on the home page            | D-24–D-27, D-29, D-31, storage schema, plugin architecture, Q-5 |
| v0.2    | [Fill and submit](#v02--fill-and-submit)                                              | fill in a template, see required errors, submit, and see the response count                       | D-10, D-20                                                      |
| v0.3    | [Responses and PDF](#v03--responses-and-pdf)                                          | list submitted responses and download or re-download each one as a PDF                            | D-30 (Q-2)                                                      |
| v0.4    | [Long text, number, date, section header](#v04--long-text-number-date-section-header) | use every non-choice input type, plus headings                                                    | D-15, D-16, D-18, D-19                                          |
| v0.5    | [Choice fields](#v05--choice-fields)                                                  | use single select (radio, dropdown, tiles) and multi select                                       | D-11                                                            |
| v0.6    | [Conditional visibility](#v06--conditional-visibility)                                | show and hide fields with _all_/_any_ conditions, chains included, live as they type              | D-1, D-2, D-4–D-9, Q-4                                          |
| v0.7    | [Conditional required and safe editing](#v07--conditional-required-and-safe-editing)  | make fields required by condition, see conflict warnings, delete a referenced field safely        | D-2, D-3, D-12                                                  |
| v0.8    | [Builder workflow](#v08--builder-workflow)                                            | reorder by drag, keyboard or buttons, preview, be warned about unsaved changes, delete a template | D-21, D-22, D-28                                                |
| v0.9    | [Calculation and file upload](#v09--calculation-and-file-upload)                      | see live totals and averages, and attach files that export as metadata                            | D-14, D-17, calculation seam                                    |
| v0.10   | [Drafts and resume](#v010--drafts-and-resume)                                         | leave a form halfway, resume it from _In progress_, or discard it                                 | D-23                                                            |
| v1.0    | [Polish and submission](#v10--polish-and-submission)                                  | recover unsaved builder work; the submission docs are complete                                    | D-33                                                            |

v0.1 is the largest slice, because the shell, storage and builder all land together. If it runs long, split it into storage plus the list (v0.1a) and the builder (v0.1b), each with its own gate.

---

## 5. Slices

Each slice lists its goal, what is in and out of scope, what it adopts from the parts bin, the use cases its tests must cover, the demo script the owner runs, and the docs it ships.

### v0.1 — Skeleton: list and builder

**Goal.** The app runs. A user creates a template of Short text fields, saves it, refreshes the page and finds it on the home page.

**In scope**

- `main.tsx`, the router (`/`, `/templates/new`, `/templates/:templateId/edit`, `*`), `AppShell`, a route error boundary, Not found, and focus and title updates on route change.
- Storage: the collection, repositories, zod schemas, the v1 envelope, `StorageContext` over `useSyncExternalStore`, and cache invalidation on the `storage` event. Corrupt data is quarantined and shown as an error state; a quota error on save is shown and the edits are kept.
- Templates list: empty state, cards (title, description clamped to two lines, field count, last modified), _New template_ and _Open in builder_.
- Builder: the heading shows the template's title ("Untitled template" until it has one) with an edit button that opens a dialog for the title and description (ADR 0009); a palette with Short text; a canvas where fields can be added by click, selected and removed; and the config panel with the text editor (label, placeholder, min and max length, prefix and suffix, Required toggle). Config issues block _Save_. The first save replaces `/new` with the edit URL. Adding a field and saving are announced through the live region.
- `FieldTypeMap` contains only `text`, and both registries have one entry.

**Not yet:** other field types (v0.4, v0.5), conditions (v0.6, v0.7), reordering, preview, the unsaved-changes guard and template deletion (v0.8).

**Adopts:** `domain/` (ids, template, response, schemas, values, assertNever), `storage/`, `fields/` (contract, both registries, `text/` and the shared helpers it uses), `ui/` (Button, FormField, Setting, Switch, LiveRegion, Dialog, icons), `styles/`, `test/` (setup, fixtures trimmed to text).

**Use cases to test**

- creates a template, saves it, and lists it after a reload
- shows the empty state when there are no templates
- shows an error naming the backup key when stored templates are corrupt, and does not overwrite them
- keeps the builder's edits and shows "Storage is full" when saving hits the quota
- blocks Save and shows the issue when a text field's min length exceeds its max length
- adds a field after the selected one and selects it (builder reducer)
- rejects a stored template whose field has a condition on itself (schema)
- an unknown URL shows Not found

**Demo script**

1. `npm install && npm run dev`, then open the app. Expect the empty state: "Create your first template".
2. _New template_. The heading reads "Untitled template". Press the pencil button beside it and enter the title "Expense claim" and a description; press Escape once to check the draft is discarded and focus returns to the pencil, then enter them again and press _Done_. The heading and description update. Add two Short text fields by clicking. Then Tab to the palette and press Enter to add the third: it is added, focus moves to it, and VoiceOver announces it.
3. Select the second field. Label it "Employee name", turn Required on, and set the max length to 40. Set the min length to 50: Save is blocked and the issue is shown. Fix it.
4. Save. The URL changes from `…/new` to `…/<id>/edit`. Refresh: everything is still there.
5. Go home. The card shows the title, the description, "3 fields" and the last-modified date.
6. In DevTools, set `formBuilder:v1:templates` to `{bad` and refresh. An error state names a backup key, and a `formBuilder:quarantine:*` key holds the raw value. Clean up.
7. Open a made-up URL: Not found.

**Docs:** ADRs for the build stack (D-24), routing (D-25), the state approach (D-26), zod at the storage boundary (D-27), CSS Modules and tokens (D-29), the test stack (D-31), the `localStorage` schema (HLD §4.5) and the field plugin architecture (HLD §5.1). This resolves Q-5 (library set). The README gets how to run the app, the storage schema and the start of the decisions table.

### v0.2 — Fill and submit

**Goal.** A user fills in a template and submits it. Required fields are enforced, and the submitted record is what the user saw.

**In scope**

- `/templates/:templateId/respond`, with a draft held in memory only. Nothing is persisted before submit; persisted drafts arrive in v0.10.
- The fill page: title, description, and renderers resolved through the UI registry. `useFormRuntime` runs over `evaluateForm`, adopted now so the visibility and required wiring is final. With no conditions authored yet, it yields each field's defaults.
- Validation on submit. After the first failed submit, fields re-validate as they change. An error summary takes focus, and each error links to its field.
- Submit builds a `SubmittedResponse` with the snapshot (D-10) and the answers of visible fields only, then shows a confirmation.
- Cards show the response count. _New response_ is disabled, with the reason, for a template with no fields (D-20).

**Adopts:** `domain/rules/` (graph, predicates, evaluate, trimmed to what Fill uses, with the calculation branch removed per [ground rule 5](#2-ground-rules); v0.9 designs the seam for derived values), `domain/values.ts`, `fields/text/TextRenderer`, `fields/shared/Adorned` and `Answer.module.css`, the answer rules in `fields/shared/textRules.ts`, and the response schema and collection from `storage/`. The plugin contract gains `Renderer`, `readValue`, `initialValue` and `validateValue`.

**Use cases to test**

- blocks submit and focuses the error summary when a required field is empty
- moves focus to the field when its error link is followed
- clears an error as soon as the field is fixed after a failed submit
- submits, stores a snapshot of the template, and the card shows "1 response"
- disables _New response_ with a reason for a template with no fields
- shows Not found for a template that does not exist
- does not validate a hidden required field (engine level, using a fixture with a hide condition)
- leaves a hidden field's value out of the submitted record (fixture)

The last two pin reviewer invariants before the condition editor exists. v0.6 pins them again through the UI.

**Demo script**

1. Open "Expense claim" → _New response_. Submit empty. The error summary takes focus and VoiceOver reads it.
2. Follow an error link: focus lands on the field. Type a value: the error clears.
3. Submit: a confirmation appears. Home shows "1 response".
4. Rename a field in the builder and save. In DevTools, the earlier response still carries the old label in its snapshot.
5. Create a template with no fields: _New response_ is disabled, and the reason is shown.

**Docs:** an ADR for the response snapshot (D-10). README rows for D-20 and for when validation runs.

### v0.3 — Responses and PDF

**Goal.** A user sees a template's submitted responses and downloads each one as a PDF that reads like a real export.

**In scope**

- `/templates/:templateId/responses`, showing the submitted responses newest first, with empty and not-found states.
- _Download PDF_ after submit, and _Re-download PDF_ on each row.
- `toExportModel` (pure), designed to render on screen as well as in print (v0.10 shows submitted responses with it), `ResponseDocument` (the one view, on screen and in print; named `PrintDocument` before v0.3), and `printDocument` (a hidden iframe, the print stylesheet, page numbers in the footer, the file name from `document.title`). The button shows a busy state while the PDF is prepared.
- `toExport` for the text plugin.

**Use cases to test**

- the export has the title, description and submission timestamp, and its answers are in form order
- an unanswered optional field reads "Not answered"
- re-downloading uses the snapshot after the template has changed
- the responses list shows the empty state, then rows newest first
- the print document has no axe violations

**Demo script**

1. Submit two responses, one with an optional field left empty. Open _Responses_: two rows, newest first, with timestamps.
2. _Download PDF_ → Save as PDF. The header shows the title, the description, "Submitted …" and the response ID. The answers are in form order, the empty one reads "Not answered", and the footer has page numbers.
3. Rename a field and save. Re-download the older response: it shows the old label.
4. Repeat step 2 in Safari, because print output differs between browsers.

**Docs:** an ADR for the PDF technique (D-30), which resolves Q-2. The README records the print-dialog step as a known trade-off.

### v0.4 — Long text, number, date, section header

**Goal.** Four more types, each working through builder, fill, validation and PDF. The diff shows only plugin folders and registry lines.

**In scope**

- **Long text:** rows and min/max length. The PDF keeps line breaks.
- **Number:** min/max, prefix and suffix in the field and in the PDF. Extra decimals are a validation error, not silently rounded (D-15). The scroll wheel does not change the value, and `1e3` is rejected.
- **Date:** _Pre-fill today_ uses the local date (D-16). Min and max dates. The PDF uses a long locale format.
- **Section header:** XL–XS map to `h2`–`h6` (D-18), with a hint when a header skips a level. Section headers count as fields on the card (D-19). They appear as sections in the PDF.

**Gate addition:** `npm run check:seam -- v0.3` passes: the diff touches only `fields/<type>/`, the two registries, `FieldTypeMap`, the test fixtures, the slice's flow test and the shared field helpers. Anything else is a seam leak, and it is fixed before sign-off. Its output goes in the handover as the extensibility evidence.

**Use cases to test:** for each plugin, `validateConfig`, `validateValue` at its boundaries, and `toExport`. Each renderer is found by role and label. Plus:

- pre-fill uses the local date just after midnight (fake timers and a fixed time zone)
- the field count includes section headers

**Demo script:** add one of each type. Fill invalid values (too many decimals, a date out of range), then valid ones. Submit, and check each in the PDF. Check the card's field count.

**Docs:** README decision rows for D-15, D-16, D-18 and D-19. Write an ADR only where a real alternative was weighed, such as text input versus `type="number"`.

### v0.5 — Choice fields

**Goal.** Single select in its three displays, and multi select. The single-select invariant holds.

**In scope**

- An options editor (add, rename, remove). Answers store stable `OptionId`s (D-11).
- Single select as radio, dropdown or tiles. Tiles are native radios styled as cards.
- Multi select with min and max selections. The PDF shows the answer as a list.

**Use cases to test**

- selection and required validation behave identically in radio, dropdown and tiles (one parameterised test)
- renaming an option keeps existing answers
- multi select enforces min and max selections

**Demo script**

1. Build the same field three times, once per display. By keyboard alone, answer each one: arrow keys in the radio group and the tiles, the native select for the dropdown.
2. Submit with all three empty: the error text and the focus target are the same for each.
3. Submit, rename an option, then re-download: the old response keeps the old label.

**Docs:** a README row for D-11. An ADR for "tiles are native radios" if the reasoning goes beyond accessibility parity.

### v0.6 — Conditional visibility

**Goal.** Fields show and hide by condition, chains included, live as the user types. This is the most heavily graded slice.

**In scope**

- The condition editor: a _show_ group and a _hide_ group per field, each read as a sentence: "Show this field when [all ▾] of these match". The target picker offers any field except the field itself (Q-4). Targets that would create a cycle are disabled, and the reason is shown. Types that cannot be targets are not offered. The operator and value inputs follow the target's predicate kind.
- Live re-evaluation in Fill. Preview (v0.8) reuses the same form, so it gets this for free. One batched announcement per change ("2 fields shown").
- Hidden values are kept in the draft but stripped from the submitted record and the PDF (D-9).
- Performance work from HLD §8: the graph is memoised per template, and renderers are `React.memo`'d with stable callbacks.

**Use cases to test** (the reviewer's invariants, through the UI where possible)

- a hidden required field is never validated
- a hidden field's value is absent from the submitted record and the PDF
- a field cannot hold a condition on itself, in the picker and in the schema
- a chain A → B → C resolves, and C falls back to its default when B is hidden
- visibility updates as the user types
- an empty target leaves the condition inactive, including for _does not equal_ and _contains none of_ (D-4)
- text comparison is trimmed and case-insensitive (D-7), and _between_ is inclusive (D-8)
- _any_ and _all_ resolve independently on different groups of the same field
- hide beats show when both groups are active (D-2)
- the builder refuses a condition that would create a cycle (D-6)

**Demo script**

1. Build: _Expense type_ (single select) → _Nights_ (number), shown when the type is Travel **or** Meals (_any_) → _Approval reason_, shown when Nights > 3. That makes a chain.
2. Fill: choose Travel and _Nights_ appears. Type 4 and _Approval reason_ appears. VoiceOver announces each change.
3. Change the type: both fields hide. Change it back: the typed values return.
4. Submit with the fields hidden. The PDF and the stored record contain neither.
5. In the builder, try to make _Expense type_ depend on _Approval reason_: that target is disabled, and the reason is shown.

**Docs:** an ADR for the conditional-logic semantics (D-1, D-2, D-4–D-9, Q-4). The README states the AND / OR rule, which the spec explicitly requires.

### v0.7 — Conditional required and safe editing

**Goal.** Required state can depend on other answers, and editing a form never leaves a broken reference.

**In scope**

- _Require_ and _not-require_ groups on input fields; require beats not-require (D-2).
- Builder warnings for opposing effects (D-2) and no-op groups (D-3).
- Deleting a field that others reference: a confirmation lists the dependants, then their conditions are removed (D-12).
- **Gap to decide at kickoff:** deleting an _option_ that a condition compares against. D-12 covers fields only.

**Use cases to test**

- a field becomes required when its require condition holds, and the error appears on submit
- require beats not-require
- a hidden field is never required, even when its require condition holds
- deleting a referenced field lists its dependants and removes their conditions
- the builder warns about opposing groups and no-op groups

**Demo script:** add "Receipt number is required when Amount > 50" and submit with 60 and with 40. Delete _Amount_: the dialog names _Receipt number_, and its condition is gone afterwards.

**Docs:** extend the conditional-logic ADR or add a new one. README rows for D-3 and D-12, and the option-deletion decision.

### v0.8 — Builder workflow

**Goal.** The builder supports real authoring: reordering, preview, protection against lost work, and template deletion.

**In scope**

- Reordering with `@dnd-kit/sortable`, using the keyboard sensor and spoken announcements, plus _Move up_ / _Move down_ buttons on every canvas item. Fields can also be dragged from the palette into the canvas.
- _Preview_ in a native `<dialog>`, which renders the unsaved template and persists nothing.
- The unsaved-changes guard, for in-app navigation and for closing the tab (D-21). A warning on save when another tab saved in the meantime.
- Deleting a template, with a confirmation stating how many responses go with it (D-22).

**Use cases to test**

- moving a field keeps the selection (reducer)
- _Move up_ is disabled on the first field
- the preview shows unsaved edits, and submitting in the preview stores nothing
- leaving with unsaved changes asks for confirmation
- deleting a template removes its responses, and the confirmation states the count
- saving after another tab saved shows a warning

**Demo script:** reorder by keyboard alone (Space, then the arrow keys, then Space) and listen for the announcements. Reorder by mouse, then with the buttons. Open the preview and close it with Escape: focus returns to the trigger. Close the tab with unsaved edits: the browser asks to confirm. Delete a template that has responses.

**Docs:** an ADR for drag and drop (D-28). README rows for D-21 and D-22. Confirm dnd-kit works with React 19 at kickoff.

### v0.9 — Calculation and file upload

**Goal.** The last two field types, including the plugin seam for derived values.

**In scope**

- **Calculation:** sources are Number fields only, never another calculation; the picker offers nothing else. Sum, average, min and max, with configured decimals. The result is a read-only `<output>` that names its sources. It shows "—" when every source is empty, excludes hidden sources and updates live (D-14). A calculation left with no sources blocks Save (D-12).
- **The calculation seam:** decide how a derived value plugs into the engine without the engine naming the type, and record it.
- **File upload:** allowed types are normalised and checked on change, not only through `accept` (D-17). Max files. Files are stored and exported as metadata only, as `name · 2.4 MB · PDF` plus the footnote. File fields cannot be condition targets.

**Use cases to test**

- the average divides by the filled sources only, and the result is empty when every source is empty
- the result updates as the user types
- a hidden source is excluded
- a calculation with no sources blocks Save
- a file of a disallowed type is rejected even when the picker filter is bypassed
- the PDF lists files as metadata, with the footnote
- neither type appears in the condition target picker

**Demo script:** _Hotel_ + _Meals_ + _Taxi_ → a _Total_ (sum) and an _Average_. Type values and watch both update. Hide _Taxi_ by condition and watch both drop it. Attach a disallowed file and an allowed one, then submit and check the PDF.

**Docs:** an ADR for the calculation seam. README rows for D-14 and D-17.

### v0.10 — Drafts and resume

**Goal.** No input is lost to a refresh or an interruption, and abandoned clicks leave nothing behind (D-23).

**In scope:** a draft is created on the first input; a pre-filled date does not count. The URL is replaced with the draft's URL. Autosave is debounced and flushed on `pagehide` and `visibilitychange`. The responses page gets an _In progress_ section with _Resume_ and _Discard_ (with confirmation). Cards read "12 responses · 2 in progress". A resumed draft is evaluated against the current template, with a notice when the template has changed. A submitted response's URL opens read-only, shown from the export model (v0.3), not from read-only renderers. Template deletion counts drafts.

**Use cases to test:** the D-23 feature flows in [HLD §9](high-level-design.md#9-testing-strategy). Plus:

- refreshing mid-form keeps the values
- a draft whose option was deleted treats that answer as empty and shows the notice

**Demo script:** start a response, type, and refresh: the values are still there. _New response_ then leave without typing: no draft appears. Resume from _In progress_. Delete an option the draft used, then resume: the notice appears and that answer is empty. Discard a draft.

**Docs:** an ADR for drafts (D-23).

### v1.0 — Polish and submission

**Goal.** The submission is complete.

**In scope**

- Builder crash recovery (D-33), if time allows.
- `axe-core` (through `src/test/axe.ts`) on every page in its key states. A full keyboard and VoiceOver audit against [HLD §7](high-level-design.md#7-accessibility-plan-wcag-22-aa): contrast, 24×24 px targets, focus never hidden, reduced motion.
- The README complete: run steps, storage schema, decisions, and "with more time".
- The AI usage log with at least five well-described entries.
- Unadopted parts-bin files deleted.
- Optionally, one Playwright smoke test.

**Demo script:** the full flow on a production build (`npm run build && npm run preview`), by keyboard alone, in Chrome and Safari.

---

## 6. Progress tracker

Update this table at each sign-off.

**Reordered during v0.2 (owner's call):** the builder workflow slice moved from v0.6 to after the two rules-engine slices, which become v0.6 and v0.7. Conditional logic is the most heavily graded part of the assessment, so it should land while there is the most time left; reordering, preview and the unsaved-changes guard are workflow comfort that a reviewer weighs less. The versions were renumbered rather than keeping the old numbers out of order, because each one is a git tag and tags should read in the order they were made. Preview now arrives after conditions, so the visibility slice is demonstrated in Fill mode only.

| Version | Slice                                   | Status      | Signed off | Notes                                                                                                                                                                                                                                                                                                                 |
| ------- | --------------------------------------- | ----------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1    | Skeleton: list and builder              | Signed off  | 2026-11-01 | Adds D-34, D-35; revises D-19, D-32 (ADR 0009)                                                                                                                                                                                                                                                                        |
| v0.2    | Fill and submit                         | Signed off  | 2026-11-01 | Adds ADR 0010; reorders v0.6–v0.8 (see above)                                                                                                                                                                                                                                                                         |
| v0.3    | Responses and PDF                       | Signed off  | 2026-11-01 | ADR 0011 (D-30, resolves Q-2) and ADR 0012 (per-item quarantine, supersedes part of 0007). Also lands the pre-v0.4 seam fixes L1–L3, L5 and O-2. Owner exception to ground rule 1: v0.4 and v0.5 are built in parallel worktrees off `v0.3`; v0.4 merges first, then v0.5 is rebased and re-runs `check:seam -- v0.4` |
| v0.4    | Long text, number, date, section header | Signed off  | 2026-11-01 | ADR 0013 (D-15). Seam fix first: `takesAnswer` narrows the field for the config panel's Required switch (ADR 0008)                                                                                                                                                                                                    |
| v0.5    | Choice fields                           | Signed off  | 2026-11-01 | No ADR (tiles-as-radios stays in HLD §7). Adds the option reorder the spec requires. Built in parallel with v0.4 off `v0.3`, rebased onto v0.4; `check:seam -- v0.4` passes                                                                                                                                           |
| v0.6    | Conditional visibility                  | Signed off  | 2026-11-02 | ADR 0014 (D-1, D-2, D-4–D-9, Q-4, D6-2, D6-13). First commit fixes the flaky suite. Contract gains `conditionTarget` (D6-1); config issues carry a control ID (D6-12)                                                                                                                                                 |
| v0.7    | Conditional required and safe editing   | Signed off  | 2026-11-02 | ADR 0015 (D-12, option deletion, warnings channel); amends ADR 0014 (require axis, D-3 corrected, D6-2 superseded). First commit drives the flow tests' timers with a fake clock                                                                                                                                      |
| v0.8    | Builder workflow                        | Signed off  | 2026-11-02 | ADR 0016 (D-28, D8-1 to D8-3) and ADR 0017 (route code-splitting, pulled in from v1.0 by the owner). First commit makes `renderApp` async. README rows for D-21, D-22 and the cross-tab warning                                                                                                                       |
| v0.9    | Calculation and file upload             | In review   | —          | ADR 0018 (calculation seam). First commit is the seam alone, so `check:seam` against it lists only the field-type half                                                                                                                                                                                                |
| v0.10   | Drafts and resume                       | In review   | —          | ADR 0019 (D-23). Submitted responses keep the draft’s ID; their URL opens read-only via `ResponseDocument`                                                                                                                                                                                                            |
| v1.0    | Polish and submission                   | Not started | —          |                                                                                                                                                                                                                                                                                                                       |

---

## 7. Risks

| Risk                                                                        | Mitigation                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Adopted parts-bin code turns out to be wrong in ways its unit tests miss.   | Each slice reviews what it adopts and tests it through the UI. A file is never adopted without being read. |
| Trimming the union breaks adopted code in many places at once (v0.1, v0.2). | This is expected, and it is how the seam leaks surface. Budget time for it in v0.1 and v0.2.               |
| Print output differs between browsers.                                      | The v0.3 demo checks Chrome and Safari. Known differences go in the README.                                |
| Late slices are squeezed for time.                                          | The order puts graded behaviour first. D-33 and the Playwright smoke test are the designated cuts.         |
