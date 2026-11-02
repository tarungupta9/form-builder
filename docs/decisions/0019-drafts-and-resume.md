# 0019. Save a draft from the first input, and resume it against the current template

- **Status:** Accepted (pending owner confirmation of the choices marked below)
- **Date:** 2026-11-02

## Context

D-23 settles _that_ drafts exist: no input may be lost to a refresh or a closed tab, abandoned clicks must leave nothing behind, and drafts are listed under **In progress** so they can be resumed or discarded. It leaves the mechanics open, and several of them are choices a reviewer would ask about:

- when a draft is first written, and when it is written again;
- what a resumed draft shows when the template has changed since;
- whether a submitted draft keeps its ID;
- what a submitted response's own URL shows, given the owner's rule that it is drawn from the export model (`ResponseDocument`), never from input renderers made read-only;
- where the autosave lives, given ADR 0016's rule that Preview, which shares `FillForm`, must stay draft-free.

The stored `DraftResponse` shape has been fixed since v0.1 (ground rule 3), so none of this may change it.

## Options considered

### When to write: on open, on first input, or on every keystroke

- **On open.** Simple, but every click on _New response_ leaves a draft, which D-23 rules out.
- **Every keystroke.** Nothing is ever lost, but it re-serialises the whole responses key on each key press, and every subscribed screen re-renders.
- **First input at once, then debounced (chosen).** The first change writes the draft straight away, so it exists and the URL can name it. Later changes wait for about 400 ms of quiet (HLD §8). Whatever is still waiting is written on `pagehide`, on `visibilitychange` to hidden, and when the form unmounts inside the app. Initial values are not input, so a date pre-filled with today does not create a draft.

### Where the autosave lives

- **In `useFormRuntime` or `FillForm`.** Closest to the values, but Preview renders the same form and would start writing drafts.
- **In Fill's session (chosen).** `FillForm` gains `onValuesChange`, which reports the raw answers after each change the respondent makes and never for initial values. `ResponseSession` hands that to `useDraftAutosave`. Preview passes nothing, so it cannot write. A test types in Preview, waits out the delay and fires `pagehide`, and checks storage is byte-for-byte unchanged.

### One route component or two

Replacing `/templates/:id/respond` with `/templates/:id/responses/:responseId` on the first input must not remount the form under the cursor. Two different lazy page components would remount it. **One `FillPage` serves both routes**, so React keeps the session. It latches what it opened: a new response is tied to the history entry it was opened from (`location.key`), and a stored one to its ID. So the URL swap keeps the session, and _Fill in another response_ (a new visit to `/respond`) starts a new one. The swap carries `KEEP_FOCUS`, so the app shell leaves focus in the field.

### What a resumed draft is evaluated against

- **The template as it was when the draft started.** A draft would then need its own snapshot, which the fixed shape does not have, and the respondent would submit against a form that no longer exists.
- **The current template (chosen, D-23).** Each stored value is read through its field's plugin `readValue`. A value whose field is gone, or that its field no longer accepts (a deleted option, a changed type), is dropped, so it counts as empty. Multi-select keeps the options that still exist. No shared code learns about field types. When `templateUpdatedAt` differs from the template's `updatedAt`, a notice heads the form: "This form has changed since you started".

### Draft to submitted: same ID or a new one

- **New ID.** The draft must then be removed in a second write. If that write fails, a submitted response and its own draft both exist.
- **Same ID (chosen).** Submitting `put`s the `SubmittedResponse` over the draft in one write. The URL the respondent is on stays valid, and once the response is submitted it opens read-only. Autosave is stopped first, and it also refuses to write over a stored response that is already submitted, so a stale tab cannot turn one back into a draft.

### What a submitted response's URL shows

**`ResponseDocument` over `toExportModel(response)`**, the same view the PDF prints, with _Re-download PDF_ and an _All responses_ link. This is the owner's rule: no renderer gains a `readOnly` mode, and the screen and the PDF cannot disagree (ADR 0011).

## Decision

Write the draft on the first input and then debounced, flushing on `pagehide`, `visibilitychange` and unmount. Keep autosave in Fill's session. Serve both Fill URLs from one page component. Resume against the current template through each plugin's `readValue`, with a notice when the template has changed. Submit under the draft's own ID. Show a submitted response's URL through `ResponseDocument`.

Smaller choices, each a call the owner should confirm:

1. **Submitting always moves to the response's own URL.** This applies even when no draft was ever written (an all-optional form submitted untouched). A refresh after submit then shows the submitted record, not a blank form. This replaces ADR 0010's "the confirmation replaces the form on the same URL". _Fill in another response_ navigates to `/respond`, so Back returns to the record.
2. **`createdAt` is when the form was opened, not the first input.** A submitted draft keeps it, which matches `SubmittedResponse.createdAt` ("when the form was opened").
3. **Each save records the template it was made against** (`templateUpdatedAt`). The change notice therefore shows until the respondent's first change after resuming, not forever.
4. **A field with no stored value still gets its initial value** on resume, so a date field added since the draft started is pre-filled with today. A date the respondent cleared stays cleared.
5. **Autosave refuses two writes**: when the template has been deleted in another tab, since nothing could list that draft (D-22), and over a submitted response.
6. **A failed autosave shows an alert** ("Your progress isn't being saved") and keeps the answers on screen. If the very first write fails, the URL stays on `/respond` and the next input tries again.
7. **In progress lists each draft's last-edited time only**, with _Resume_ and _Discard_, most recently edited first. There is no answer preview. Discard asks first ("Discard this response?"), announces the outcome, and moves focus to the neighbouring row, or to the page heading after the last one.
8. **The card reads "12 responses · 2 in progress"**, and the "· N in progress" part appears only when N > 0. The delete dialog says "Its 3 responses and 2 in progress will be deleted too", and its button counts both ("Delete template and 5 responses").
9. **A draft whose template no longer exists shows Not found.** The cascade (D-22) means one should never exist.

## Consequences

- The plugin contract is unchanged. Resuming uses `readValue`, which every field type already has, so v0.9's calculation and file-upload types resume with no draft-specific code.
- `useFormRuntime` takes an optional `FormStart` (response ID, opened-at time, stored values) and reports `edited`. Preview still gets a throwaway ID and writes nothing.
- The responses key is rewritten at most about every 400 ms while someone types, plus once on hide. At the expected scale this is cheap. With more time, drafts could live under their own key, so autosave never re-serialises submitted responses.
- **Two tabs on one draft: the last write wins.** Each tab keeps its own in-memory answers, and neither sees the other's. A `storage`-event merge, or a "this draft changed in another tab" notice like the builder's save conflict (D8-8), is on the with-more-time list.
- **Two tabs submitting one draft: the first submit wins.** `useSaveResponse` refuses to write over a response already stored as submitted under the same ID, matching the autosave guard, so a submitted response and its re-downloaded PDF never change (D-10). The second tab shows "This response was already submitted", keeps its answers on screen, and links to the responses list. It links there rather than to the response's own URL because that is the address the tab is already on, and the page keeps what it opened.
- **A draft discarded in another tab while it is open here** is written again by this tab's next autosave. This is accepted, because the respondent is still typing into it.
- Only submitted responses export to PDF: a draft has no submission timestamp (D-23).
