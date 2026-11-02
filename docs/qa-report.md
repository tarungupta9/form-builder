# Pre-submission QA report

- **Date:** 2026-11-02
- **Build under test:** `master` at `95a3917` (clean working tree)
- **Method:** static review of the domain, plugins, Fill, storage and export code; the full automated suite; and scripted end-to-end flows in headless Chrome (Playwright) against the dev server, run from a scratch directory so nothing in the repo changed.

## 1. Automated gates

| Gate                                                                                                                                        | Result                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                         | Pass                                                                                                        |
| `npm run lint`                                                                                                                              | Pass                                                                                                        |
| `npm test`                                                                                                                                  | Pass: 75 files, 732 tests                                                                                   |
| `npm run build`                                                                                                                             | Pass                                                                                                        |
| `prettier --check .`                                                                                                                        | Pass for tracked files. The 17 warnings are all in the untracked, git-excluded `visual-regression/` folder. |
| Plugin seam (`git diff fa9e287 5beda3f`, the slice that added File upload and Calculation)                                                  | Pass: no file outside the plugin folders, registries, `FieldTypeMap` and test fixtures changed.             |
| axe-core (WCAG 2.0/2.1/2.2 A and AA) on Home, Builder with a condition open, Preview, Fill with errors, Responses, and a submitted response | 0 violations on all six                                                                                     |
| 320 px viewport: Home, Builder, Fill, Responses                                                                                             | No horizontal overflow                                                                                      |

## 2. Findings

### F-1 (High): typing a date with the keyboard erases it (Chrome)

- **Where:** all four date inputs: `DateRenderer` (Fill), `DateEditor` earliest and latest dates, and the date value in a condition (`PredicateValueInput`).
- **Repro:** focus a date input and type the date (for example `03152026`). The field is empty afterwards. Choosing a date with the mouse picker, or Playwright's `fill`, works.
- **Cause:** while the year is typed, Chrome emits intermediate values such as `0002-03-15`. `parseIsoDate` builds `new Date(year, …)`, which maps years 0 to 99 to 1900 to 1999, so it rejects `0002` and returns `null`. The controlled input then re-renders with `value=""`, and React clears what the user typed. Observed input events: `['0002-12-03']`, then empty.
- **Why it matters:** keyboard entry is the main way to fill a date field and a WCAG 2.1.1 concern. jsdom sets the whole value at once, so the unit tests cannot catch it.
- **Fix (verified):** in `parseIsoDate`, construct with `const date = new Date(2000, 0, 1); date.setFullYear(year, month - 1, day);`. With this change, served through request interception, typing produced `0002 → 0020 → 0202 → 2026` and the value was kept. `formatIsoDate` uses the same constructor, so it needs the same change, or it would display year 2 as 1902. Add a unit test that `parseIsoDate('0002-03-15')` is accepted.

### F-2 (Medium): the template card title does not open the builder

- **Spec:** Templates list, "Click a template — opens it in Builder Mode (edit)."
- **Current:** the title is a plain `<h2>`. The builder is reached through "More actions" and then "Open in builder" (ADR 0020).
- **Suggested fix:** make the title text a link to `/templates/:id/edit`. A link inside the heading avoids the nested-controls problem ADR 0020 raised against making the whole card a link. Add one line to ADR 0020's consequences.

### F-3 (Medium): a stale tab can overwrite an already-submitted response

- **Repro:** open the same draft in tabs A and B. Submit in A, then submit in B. The stored response now holds B's answers and B's submission time. Observed: the stored name changed from "Tab test" to "Tab test changed again".
- **Cause:** `useDraftAutosave` refuses to write over a submitted response, but `useSaveResponse` does not check.
- **Impact:** breaks D-10's promise that a re-downloaded PDF reproduces what was submitted.
- **Suggested fix:** in `useSaveResponse`, return an error such as `{ kind: 'alreadySubmitted' }` when the stored response with that ID is already submitted, and add a message for it in `describeSaveError`. Pin it with a test.

### F-4 (Low): a calculation of 1e21 or more shows "Nothing to calculate yet"

- **Cause:** `derive` stores `result.toFixed(decimals)`, which returns exponent notation (`"1e+21"`) from 1e21 upwards, and `parseDecimal` rejects exponents.
- **Options:** cap Number inputs at a sane magnitude, or render the result without exponent notation. Either way, document it.

### F-5 (Low): the unsaved-changes guard is bypassed by editing the URL hash by hand

- In-app links, the browser's Back button and reload all prompt (verified). A hash typed into the address bar creates a history entry React Router did not make, so `useBlocker` cannot stop the navigation. React Router logs a warning, and unsaved edits are lost without a prompt.
- This is a known React Router limitation. Mention it in the README's known trade-offs next to D-21 rather than fixing it.

### F-6 (Low, accessibility polish): the all/any select's accessible name includes its options

- The select is announced as "Show this field when all any of these match", because its `<label>` wraps both the sentence and the select.
- **Suggested fix:** give the select an explicit name, for example `aria-label="Show this field when"` or an `aria-labelledby` pointing at the leading text.

## Resolution (same day)

| Finding  | Status     | Evidence                                                                                                                                                                                                                                                                      |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1      | **Fixed**  | `parseIsoDate` and `formatIsoDate` use `setFullYear`. Five new tests, each seen red without the fix. Keyboard entry re-verified in Chrome on the Fill date, the builder's earliest date and a condition's date value.                                                         |
| F-2      | **Fixed**  | The card title is a link to the builder inside its `<h2>`; _Open in builder_ stays in the menu; ADR 0020 updated. Three new tests. Click and Enter re-verified in Chrome, with a visible focus outline.                                                                       |
| F-3      | **Fixed**  | `useSaveResponse` refuses a submit over a stored submitted response (`alreadySubmitted`), keeps the answers on screen, and links to the responses list. D-23 and ADR 0019 updated. Two new tests. Re-verified in Chrome: tab A's submission is unchanged after tab B submits. |
| F-4, F-5 | Documented | README, Known trade-offs.                                                                                                                                                                                                                                                     |
| F-6      | Documented | README, With more time.                                                                                                                                                                                                                                                       |

After the merge: `npm run check` and `npm run build` pass, and the test suite (76 files, 742 tests) passed three runs in a row.

## 3. Scenarios checked in the browser

Pass unless marked otherwise. Unit and component tests already cover most of these too; the browser runs confirm them end to end.

**Rules engine (spec §9 invariants)**

- A field that is hidden by default and required is neither shown nor listed in the error summary on submit.
- Chain A → B → C: B appears when A equals "YES " (trimmed and case-insensitive, D-7), and C appears when B is Dog. Hiding A collapses B and C together; showing A again restores both values (D-9).
- Conditional required: `P1 > 100` makes Notes required, and the comparison is strict (100 does not trigger it). A not-required condition makes Reason optional, and clearing it makes Reason required again.
- Hidden fields' answers, and the fields themselves, are absent from the stored submission and its snapshot.
- Self-reference: a field never appears in its own condition target picker.
- Cycles: a direct cycle (Answer ← Pick) and a transitive one (Day ← Answer ← Pick) are offered but disabled, labelled "(depends on this field)".
- Calculation and File fields are not offered as condition targets.

**Field types**

- Single select: radio, dropdown and tiles produce the same required message; each selection clears its error.
- Multi select: below the minimum and above the maximum each show the expected message.
- Number rejects `1e3`, `1,000` and `1.234` (2 decimal places allowed), and accepts `-.5` and ` 7`.
- Short text: minimum and maximum length are enforced, and the prefix and suffix appear in the PDF (`https://acme.com`).
- File upload: a wrong type is refused at once with a reason; the file limit is enforced and the picker is disabled at the limit; the PDF lists name, size and type with a note that contents are not included.
- Date: pre-fill uses today's local date, and a pre-filled date alone writes no draft. Keyboard entry fails (**F-1**).
- Calculation: Sum and Average update live; Average divides by filled sources only; a hidden source is left out; with no sources filled it shows "—". A sum of 1e21 or more fails (**F-4**).

**Builder**

- Every type can be added by click, and the new field lands after the selected one.
- Palette drag-and-drop with the mouse, and canvas reordering with the dnd-kit keyboard sensor (Space, arrow key, Space) and with the Move buttons (focus moves to a sensible control).
- Save is blocked by a missing title, an unlabelled field, a calculation with no sources, duplicate or blank option labels, and an incomplete condition. The details dialog refuses a whitespace-only title.
- Removing a field that others use opens a dialog listing what depends on it; confirming cascades to conditions and calculation sources.
- Save persists across reload. Saving in two tabs raises the conflict dialog (Cancel, Use their version, Replace with my version).
- The unsaved-changes guard prompts on in-app links, Back and reload (**F-5** is the exception).
- Preview opens in a modal, writes nothing to storage on submit, closes with Escape and returns focus to the Preview button.

**Fill, drafts and responses**

- The first input saves a draft and swaps the URL, keeping focus and the value. Refresh resumes it. Typing then leaving at once still saves the last change.
- A template edited after a draft was started shows a "form has changed" notice, and an answer pointing at a removed option is cleared.
- Submitting turns the draft URL into a read-only record. The responses page lists the submission time and a Re-download PDF button. A stale tab cannot overwrite the submission with a draft, but can by submitting (**F-3**).
- PDF print frame: form title, description, submission time, response ID, and every visible field in form order. Hidden fields are absent; headings are h1 for the title and h3 for a Large section (D-18).
- Home card: field count, response count, "in progress" count, and last edited date. A template with no fields has New response disabled, with its reason linked by `aria-describedby`, and its respond URL shows a no-fields notice.
- Deleting a template asks for confirmation with the response count, removes its drafts and responses, and moves focus to the neighbouring card's title. The old draft URL then shows Not found.

**Storage resilience and routing**

- A corrupt (non-JSON) key shows an error panel and keeps a quarantine backup.
- A single invalid item is set aside while the others load.
- A newer schema version is refused and never overwritten.
- Unknown paths, malformed IDs, and unknown template or response IDs all render Not found.

## 4. Confidence against the spec

| Spec area                     | Confidence           | Notes                                                                                                        |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Field types 1–3, 5–8, 10      | High                 | Every config option is exercised; F-4 is a far edge.                                                         |
| Field type 4, Date            | High (after F-1 fix) | Keyboard entry re-verified in Chrome.                                                                        |
| Conditional logic (§9)        | High                 | Every stated rule is verified in the browser and pinned by tests; chains, cycles and real-time updates work. |
| Builder mode                  | High                 | Panels, drag-and-drop with a keyboard equivalent, Save and Preview all work.                                 |
| Templates list                | High (after F-2 fix) | Clicking the template title opens the builder.                                                               |
| Fill mode and submission      | High (after F-3 fix) | A stale tab can no longer submit over a submitted response.                                                  |
| Filled instances and PDF      | High                 | Reads like a real document; hidden fields are excluded; file metadata is shown.                              |
| Persistence and refresh       | High                 | Every view has a URL; corrupt and newer data are handled.                                                    |
| Type safety and extensibility | High                 | Strict TypeScript and lint pass, and the seam check is clean for the File upload and Calculation slice.      |
| Accessibility                 | High                 | axe is clean on six screens; the F-1 keyboard blocker is fixed.                                              |

**Overall:** the core is in good shape. F-1 to F-3 are fixed and re-verified, and F-4 to F-6 are documented in the README.
