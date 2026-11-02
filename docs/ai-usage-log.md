# AI usage log

The significant prompts sent to an AI tool (Claude Code), what was checked before the output was used, and what was rejected or changed and why. Entries are in the order they happened.

---

## 1. Drafting the high-level design from the spec

- **Prompt:** Turn `docs/spec.md` into a high-level design: data model, module interfaces, and a proposed decision for each gap in the spec.
- **Verified before use:** I reviewed every `D-n` decision against the spec text, and left inline review comments on the ones I disagreed with or did not understand.
- **Plausible but incorrect, and changed (D-23):** To meet the "works after a full refresh" requirement, the AI saved each in-progress response as a draft with its own URL, but listed and counted only submitted responses. It reads as careful: no input is lost on refresh. But nothing in the app linked to a draft, so once the user left the page the only way back was the exact URL. In practice the work was still lost, and the draft stayed in `localStorage` forever. My use case was a user who starts a form, gets interrupted, and resumes later. **Change:** drafts are listed under "In progress" with _Resume_ and _Discard_, and the card shows the in-progress count next to the spec's submitted count. A draft is saved only on the first input, so clicking _New Response_ and leaving creates no empty drafts.

## 2. Explaining the AND / OR decision for multiple conditions

- **Prompt:** Explain D-1 (a per-field `match: 'all' | 'any'` setting), and evaluate whether a field should support multiple condition groups.
- **Verified before use:** I checked the explanation against concrete expense-form examples, working out by hand which ones each model can and cannot express.
- **Changed:** Working through the examples showed a gap in the original D-1: one `match` per field is shared by the show, hide, require and not-require effects. A field that needs "show if type = Travel **or** Meals" and "require if amount > 50 **and** payment = Cash" cannot be configured. **Change:** each effect has its own condition group with its own `match`. Nested groups (`(A and B) or (C and D)`) were evaluated and deferred: the engine cost is small, but the builder UI, its accessibility and the tests are not. The data shape can take nesting later without breaking stored data.

## 3. Live preview in the builder

- **Prompt:** Evaluate showing a preview while the user builds the form, instead of only through the _Preview_ modal.
- **Rejected:** The AI proposed drawing every canvas item with its real field renderer, plus an inline Edit | Preview toggle in place of the modal. The spec allows an inline preview, but this would change the canvas's accessibility model (inputs cannot sit inside a selectable button, so the preview would need `inert` and a separate select control) and its rendering cost. It adds scope without serving any evaluation criterion. **Decision:** keep the original design: compact canvas summaries and _Preview_ in a modal, as the spec describes.

## 4. Showing a submitted response read-only

- **Prompt:** Plan how a submitted response opens on screen once drafts and submitted responses share a URL (D-23), so the respondent sees what they sent.
- **Verified before use:** I compared the proposal with the export path from v0.3, where each plugin's `toExport` already turns an answer into what the PDF shows, rendered by one `ResponseDocument` view.
- **Rejected:** The AI proposed a `readOnly` prop on every field renderer, so the fill form could be reused with its inputs locked. It looks like the least new code, but it changes every plugin's renderer, and the screen and the PDF would then be two renderings of the same answer that could drift apart. **Decision:** a submitted response renders through `ResponseDocument`, the same view the PDF prints, and `RendererProps` gets no `readOnly`. The screen and the PDF cannot disagree, and a new field type needs nothing extra to be shown read-only ([ADR 0011](decisions/0011-pdf-through-the-print-dialog.md), [ADR 0019](decisions/0019-drafts-and-resume.md)).

## 5. A seam leak in the Required switch

- **Prompt:** Add Section header (v0.4), the first field type that takes no answer, through the plugin contract only.
- **Verified before use:** Adding the type to the field union made shared Builder code fail to compile, which is what the plugin check exists to catch: a new type should only need its folder, one `FieldTypeMap` entry and two registry lines.
- **Plausible but incorrect, and changed:** The config panel's Required switch, as the AI wrote it, narrowed `field.logic` to the logic of a field that takes an answer, then wrote back `{ ...field, logic: { ...logic, defaultRequired } }`. It reads correctly and type-checked, but only because Short text was the sole type: `field` itself was never narrowed, so the spread produced a field whose type and logic could disagree. Section header exposed it. **Change:** a `takesAnswer(field)` guard in shared domain code narrows the whole field, and the panel narrows on it. It went in as its own commit (`de35591`) before the v0.4 slice, so the slice's diff stays clean evidence that a type is added without touching shared code ([ADR 0008](decisions/0008-field-types-as-plugins.md)).

## 6. `aria-invalid` on radio buttons

- **Prompt:** Build single select's radio, dropdown and tile displays so that selection and required validation behave identically (an AGENTS.md invariant). The kickoff brief asked for the same `required` / `aria-invalid` markup on every control.
- **Verified before use:** The parameterised parity test (`src/fields/single-select/displayParity.test.tsx`) checks that the error text, the focus target and the stored value match across the three displays. `jsx-a11y` lint and a manual VoiceOver check confirmed how each display reports the error.
- **Plausible but incorrect, and changed:** Putting `aria-invalid` on each radio looks like the consistent choice. But ARIA defines no invalid state on a single `radio`, the `jsx-a11y/role-supports-aria-props` rule rejects it, and assistive tech reads the error from the group. **Change:** every control in all three displays carries native `required`. The radio and tile groups carry the error in the group's description, and the dropdown keeps `aria-invalid` with its own description. Parity is in the behaviour and the announced message, not in identical attributes.

## 7. Keeping Move up / Move down next to drag

- **Prompt:** Evaluate dropping the _Move up_ / _Move down_ buttons on canvas items now that dnd-kit reordering works by mouse and by keyboard (my proposal: they looked like a duplicate of drag).
- **Verified before use:** I checked the AI's answer against the text of WCAG 2.2 success criterion 2.5.7 (Dragging Movements).
- **Rejected (my own proposal):** 2.5.7 requires a **single-pointer** alternative to any dragging movement. Keyboard dragging does not satisfy it: it serves keyboard users, not someone who can tap or click but cannot hold and move a pointer. **Decision:** the buttons stay, and both inputs dispatch the same `field/moved` action, so a move has one implementation with two inputs ([ADR 0016](decisions/0016-drag-and-drop-reordering.md)).

## 8. A flaky test and a slow suite: finding the cause, not raising the limit

- **Prompt:** Make the full test suite pass reliably (a gate requirement: 10 consecutive full `npx vitest run` passes).
- **Verified before use:** Each fix was checked with repeated full-suite runs, and the cause was confirmed in the code, not inferred from the symptom.
- **Root-caused (v0.6):** A storage test built a "wrong key" by replacing the last character of a random UUID with `0`. About one UUID in 16 already ends in `0`, so the two keys were the same and the test failed at random. It now uses a fresh ID (`5dc0629`).
- **Plausible but incorrect, and rejected (v0.8):** After dnd-kit was added, flow tests began timing out, and an AI agent raised the per-test timeout from 5 s to 15 s. The suite then passed, so it looked fixed. But the slowness was real and would be felt in the app: every canvas item, each with its sortable hook, re-rendered on every keystroke in the config panel. **Change:** the canvas items are memoised with stable props (`c011332`), a test counts item renders and fails if typing re-renders other items, and the 15 s timeout was removed. One flow test keeps a 10 s limit, with a comment saying why: it once ran out of 5 s on a heavily loaded machine.

## 9. A pre-submission QA pass: a date bug the unit tests could not see

- **Prompt:** Before submitting, examine code quality, run the flows and edge cases in a real browser, and report what was checked and how confident we are against the spec. Then fix the three bugs it found, each by a parallel agent. The full report is in [`qa-report.md`](qa-report.md).
- **Verified before use:** Each finding was reproduced in headless Chrome before it was reported. The F-1 fix was proven in the browser before any code changed, by serving a patched module through request interception. After the three agents' changes were merged, the full gate ran three times, and the original browser reproductions were re-run against the merged code.
- **Plausible but incorrect, and changed (F-1):** `parseIsoDate` checked that a `YYYY-MM-DD` string names a real day by building `new Date(year, month - 1, day)` and comparing its parts. It reads as careful, it rejects `2026-02-30`, and every unit test passed. But that constructor reads years 0–99 as 1900–1999. While a year is typed, Chrome's date input emits `0002-…`, `0020-…`, `0202-…`, so the check returned `null`, the controlled input re-rendered empty, and typing a date by keyboard was impossible in all four date inputs. jsdom sets a date input's whole value at once, so no test could see it. **Change:** the date is built with `setFullYear`, which takes the year literally, in both `parseIsoDate` and `formatIsoDate`, and tests now replay Chrome's typing sequence.
- **Also found and fixed:** a template's title did not open the builder, although the spec says clicking a template does (F-2; [ADR 0020](decisions/0020-card-actions-in-a-menu.md)). And a stale tab could submit over a response already submitted in another tab (F-3; [ADR 0019](decisions/0019-drafts-and-resume.md)).
- **Rejected along the way:** an agent's brief asked the F-3 alert to link to the submitted response's own URL. The agent found that this is the address the tab is already on, and the page keeps what it opened, so the link would do nothing. It linked to the responses list instead, with a comment saying why.
