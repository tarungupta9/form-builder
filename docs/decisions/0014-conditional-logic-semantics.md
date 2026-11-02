# 0014. Combine conditions per effect, fail closed on conflicts, and refuse loops while authoring

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The spec gives every field a default state and a list of conditions, each with a target field, an operator, a value and an effect (show, hide, require, not require). It leaves the semantics open: how several conditions combine, what happens when two effects disagree, what an empty target means, how chains and loops behave, how text compares, whether _is within range_ includes its ends, and what happens to an answer whose field hides. It asks the README to state the AND / OR rule explicitly.

This is the most heavily graded part of the assessment. The reviewer's invariants (AGENTS.md) must each be pinned by a test: a hidden field is never validated and never submitted, a field cannot hold a condition on itself, and chains resolve and update as the user types. So every rule below has to be one an engine can apply in a single, predictable pass, and one an author can read back from the builder.

v0.6 ships the visibility half (the _Show_ and _Hide_ groups, in Builder and Fill). The engine already resolves the required half, whose editor arrives in v0.7.

## Options considered

### How several conditions combine (D-1)

- **A: AND only.** Simple to explain, but with only _equals_ on a single select, "show when the type is Travel or Meals" cannot be written at all.
- **B: one `all` / `any` per field.** Covers that case, but one field often needs both: "show when the type is Travel **or** Meals" and "require when the amount is over 50 **and** the payment is cash".
- **C: one flat group per effect, each with its own `all` / `any`, defaulting to `all`.** Covers both. The builder reads each group as one sentence ("Show this field when [all] of these match").
- **D: nested groups, `(A and B) or (C and D)`.** Covers everything, but its cost is in the builder UI, its accessibility and its tests, not in the engine.

### When opposing effects both match (D-2)

- **A: the last condition wins.** Order-dependent and invisible to the author.
- **B: hide beats show, and require beats not-require.** Fixed, explainable rules: hiding fails closed (when the rules disagree, collect less), and requiring fails safe (when unsure, ask).

### Chains, loops and targets (D-5, D-6, Q-4)

- **A: targets only above the field.** Loops become impossible by construction, but reordering fields can then silently break conditions.
- **B: any field except itself, with loop prevention.** The builder disables any target that would close a loop and says why, and the engine evaluates in dependency order, so A → B → C settles in one pass whatever the form order.

## Decision

Option C for combining, option B for conflicts and option B for targets, with these rules:

- **D-1:** each field has a _Show_ and a _Hide_ group (input fields also _Require_ and _Not required_), each with its own `match`: `all` (AND) or `any` (OR), default `all`. Groups are flat. A group with no conditions is never active, and when no group is active the field's default applies.
- **D-2:** hide beats show, and require beats not-require.
- **D-4:** a condition whose target has no answer is inactive, for every operator, including _does not equal_ and _contains none of_. The spec applies the default "when the target field has no value".
- **D-5:** a hidden field's effective value is empty. Conditions that read it are inactive, so C falls back to its default when B hides, even though B still holds what was typed. Fields are evaluated in topological order, so chains need no iteration.
- **D-6:** the builder refuses a loop: a target that already depends on the field, directly or through a chain, is listed but disabled, with the reason in the option text and in a visible hint linked to the select. The engine is defensive too: a field caught in a loop uses its defaults.
- **Q-4:** a condition may read any other field that holds an answer, above or below it, but never the field itself. Which fields can be read comes from the plugin contract (`conditionTarget`), so the builder never names a field type.
- **D-7:** text compares trimmed and case-insensitively, so "Yes" equals " yes ".
- **D-8:** _is within range_ includes both ends, and a range whose first number is more than its second blocks Save.
- **D-9:** a hidden field's answer stays in the in-memory response, so showing the field again restores it, but it is left out of the submitted record and the PDF. Fill says so when it happens: "Approval reason hidden. Its answer won't be submitted."
- **D6-2, until v0.7:** a condition whose target field or compared option was deleted is kept, never silently edited. It never holds, and it blocks Save with "the field it reads was removed" or "an option it compares against was removed" until the author fixes it. A missing option is treated as incomplete on purpose: otherwise _does not equal_ that option would hold for every answer. v0.7's deletion dialog (D-12) replaces this.
- **D6-13:** a loop or a predicate that does not fit its target, found in stored data (a hand edit), is a builder config issue, never a reason to set the template aside. The engine already treats both as inactive, and quarantining the template over it would hide the author's work.

The deciding reason is that every rule fails closed and is visible: an unfinished, broken or contradictory condition never shows a field or demands an answer, and the builder names the problem before it can be saved.

## Consequences

- The engine is one pass in dependency order (`domain/rules/evaluate.ts`), O(fields + conditions), pure and unit-tested per rule. The builder's checks (`features/builder/conditions/`) are pure functions too, so loop refusal, target lists and Save issues are tested without rendering.
- Stored data needs no change: the flat group is also a valid nested group with one level, so nested groups can be added later without a migration.
- The author cannot write `(A and B) or (C and D)` in one group. Two groups with different effects cover most real forms; truly nested logic is under "with more time".
- Until v0.7, deleting a field that others read leaves their conditions in place and blocks Save until each is removed by hand. That is friction, but it never changes what an author wrote without telling them.
- v0.7 adds the _Require_ and _Not required_ groups by rendering the same group editor twice more, plus the opposing-effects and no-op warnings (D-2, D-3). v0.6 pulls forward only one static line of D-3: a field that is already visible says its show conditions only matter if it starts hidden.
- Revisit with more time: nested groups, and conditions on calculated values (v0.9 decides whether a calculation can be a target).
