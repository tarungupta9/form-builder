# 0015. Confirm and cascade deleted references; warnings never block Save

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

v0.7 adds the _Mark as required_ and _Mark as not required_ groups, so each input field has four condition groups, and conditions now point at other fields far more often. Two gaps follow.

**Deleting what a condition points at.** The spec says nothing about deleting a field that others reference. D-12 proposed a confirmation that lists the dependants and then removes their conditions. Until now, v0.6 kept such a condition, which never held and blocked Save until the author fixed it by hand (D6-2 in [ADR 0014](0014-conditional-logic-semantics.md)). D-12 covers fields only, but deleting an **option** that a condition compares with has the same problem: _does not equal Cash_ would hold for every answer once Cash is gone, so the condition cannot just be ignored.

**Telling the author about logic that does nothing.** D-2 and D-3 promise warnings for opposing groups and for groups that cannot change the default. The builder already has one channel for problems, the config issues that block Save (D6-12). A warning must never stop a save: the form is valid, only perhaps not what the author meant.

The reviewer weighs correctness and judgment: nothing the author wrote should change without being named first, and the builder should never hold a reference to something that is gone.

## Options considered

### Deleting a field others read (D-12)

- **A: keep the v0.6 interim.** The condition stays, never holds and blocks Save. Safe, but it pushes the cleanup onto the author, one condition at a time.
- **B: confirm, then cascade.** A dialog names each dependant and how many of its conditions read the field; on confirm, those conditions go with the field. Every other condition stays, and each group keeps its _all_ / _any_.
- **C: refuse while in use.** Disable _Remove_ until nothing reads the field. Nothing is ever removed silently, but deleting a field takes several steps in the right order.

### Deleting an option a condition compares with

- **A: keep the interim** (as for fields).
- **B: confirm and cascade, like D-12.** One rule for fields and options: what points at the thing you delete is listed, then removed with it.
- **C: refuse while in use**, with the reason shown beside the disabled _Remove_ button, as for loops (D-6).

A multi-select condition can name several options. Removing one of them could strip just that ID, or remove the whole condition.

### Where warnings live

- **A: as config issues with a severity flag.** One list, but every reader of `configIssues` must remember to filter, and Save would be one missed filter from being blocked.
- **B: a separate derived list, `conditionWarnings(field)`.** Shown under the group it is about, live, and announced once when it appears. Save never reads it.

## Decision

**B for fields, B for options, B for warnings.**

- **Confirm only when something reads it.** Removing a field or option nothing refers to happens at once, as before. Otherwise a dialog titled "Remove Amount?" lists the **direct** dependants ("Receipt number: 1 required condition") and says their other conditions stay. Chained fields further down are not listed: their own conditions read a field that stays.
- **The whole condition goes.** For a multi condition that names the deleted option among others, removing only that ID would silently change what _contains all_ or _contains none_ means, so the condition is removed and the dialog names it (D7-7).
- **The reducer cascades.** `field/removed` removes every condition on the field, in every group. `field/updated` removes the conditions on that field that name an option this edit removed. Both read options through the plugin contract (`conditionTarget`), never by field type, so a future option-bearing type is covered with no change. Only options removed by the edit count, so a stored condition on an option that was already missing stays visible for the author to fix.
- **One focus owner on confirm.** _Cancel_ comes first and takes focus, since the other button destroys work. Cancel and Escape return focus to the _Remove_ button. On confirm, the dialog moves focus to the neighbouring field or option, worked out when it opened; nothing else asks for focus in that commit, because a second request would race the modal's inert page. The change is announced: "Removed Amount and 1 condition on Receipt number."
- **D6-2's checks stay, as defence.** "The field it reads was removed" and "an option it compares against was removed" still block Save, for stored or hand-edited data. Builder edits can no longer produce them.
- **Warnings are their own channel.** `conditionWarnings(field)` derives seven structural rules from the field's logic alone, following the engine exactly (D-3 as corrected in the HLD): _Show_ on a visible field, _Hide_ on a hidden field nothing shows, _Not required_ on an optional field, _Require_ on a required field nothing makes optional, each opposing pair, and a field that starts hidden with nothing showing it. Each is shown under its group, linked to the group's `<fieldset>` by `aria-describedby`, and announced once when the author's own edit makes it appear. They are not on the canvas, where "Needs attention" keeps meaning "blocks Save".

The deciding reason is one rule the author can predict: deleting something removes what points at it, after naming each of those things, and nothing else.

## Consequences

- The builder can no longer hold a condition on a missing field or option, so the engine's defensive "a missing target reads nothing" is reached only from stored data.
- A cascade can change what a group means: an _all_ group that loses a condition matches more often, an _any_ group less often, and an emptied Show group on a hidden-at-start field means the field is never shown. The dialog says the other conditions stay, and the `neverShown` and no-op warnings flag the end state.
- There is no undo. The confirmation is the safety net; undo would need a history stack in the reducer.
- The removal dialog (`ui/RemovalDialog.tsx`) lives in `ui/` because `fields/shared/OptionsEditor.tsx`, which owns the option dialog, may not import from `features/`. v0.8's template deletion can build on the same `Dialog`.
- Required conditions count as dependency edges for loop refusal, as visibility conditions do (D7-9). That is conservative: _A shows on B_ while _B is required on A_ is refused although it would be well defined. Revisit with more time: a graph per axis, so only real loops are refused.
- Revisit with more time: calculation sources become dependants in v0.9 (`Dependant.reads` has room for them), and undo after a removal.
