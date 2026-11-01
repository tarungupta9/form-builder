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

## 4. `aria-invalid` on radio buttons

- **Prompt:** Build single select's radio, dropdown and tile displays so that selection and required validation behave identically (an AGENTS.md invariant). The kickoff brief asked for the same `required` / `aria-invalid` markup on every control.
- **Verified before use:** The parameterised parity test (`src/fields/single-select/displayParity.test.tsx`) checks that the error text, the focus target and the stored value match across the three displays. `jsx-a11y` lint and a manual VoiceOver check confirmed how each display reports the error.
- **Plausible but incorrect, and changed:** Putting `aria-invalid` on each radio looks like the consistent choice. But ARIA defines no invalid state on a single `radio`, the `jsx-a11y/role-supports-aria-props` rule rejects it, and assistive tech reads the error from the group. **Change:** every control in all three displays carries native `required`. The radio and tile groups carry the error in the group's description, and the dropdown keeps `aria-invalid` with its own description. Parity is in the behaviour and the announced message, not in identical attributes.
