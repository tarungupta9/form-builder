# 0018. Plug derived values into the rules engine through an optional `derivation` member

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

A calculation (v0.9) shows a value computed from other fields: the sum, average, minimum or maximum of chosen Number fields. The engine has to compute it in the same pass as visibility, because a hidden source must not count (D-9, D-14) and the result must update as the user types. The builder has to know about it as well: removing a Number field that a calculation uses must list the calculation in the D-12 dialog and drop the source.

The parts bin did this by naming the type: `isCalculation(field)` in `evaluate.ts`, `field.config.sourceFieldIds` in `graph.ts`. Ground rule 5 of the plan removed that branch at v0.2, so the engine stayed blind to field types (ADR 0008). Two constraints shape the replacement:

- The domain layer cannot import `fields/`, so the engine cannot ask the registry directly.
- Adding a field type must touch only its folder, the registries and `FieldTypeMap` (`npm run check:seam`). A seam that needs a new engine branch per derived type fails that check.

## Options considered

### A: an optional `derivation` member on the plugin, injected into the engine

`FieldDefinition` gains `derivation?: { sourcesOf, withoutSource, derive }`. The registry folds every plugin's member into one `FieldDerivations` object (`fieldDerivations`), and the graph, the evaluation and the D-12 references take it as a parameter. Sources become graph edges, like condition targets. Pros: the engine never names a type; a second derived type (say, a date difference) is one more plugin. Cons: every engine caller must pass `fieldDerivations`, and a caller that forgets gets no derived values without a compile error, because the parameter defaults to "nothing derives" for the pure rule tests.

### B: name the type in the engine

Put the calculation branch back. Pros: shortest path, no injection. Cons: the engine imports a type-specific config; the next derived type edits shared code; and it is exactly the leak the seam check exists to catch.

### C: compute calculations outside the engine, in Fill

Evaluate the conditions first, then compute calculations from `effective` in `useFormRuntime`. Pros: no engine change. Cons: the D-12 cascade and the graph still need the sources, so they would learn about calculations separately; and a calculation computed after the pass cannot be read by anything inside it, which closes off a derived value ever becoming a condition target.

### Required or defaulted parameter

A required parameter would make forgetting it a compile error, at the cost of about 50 test call sites in pure rule tests whose fields derive nothing.

## Decision

**A, with a defaulted parameter.** It is the only option that keeps the engine and the builder type-blind, which is what the reviewer checks. The default (`NO_DERIVED_FIELDS`) keeps the rule tests about rules; every production caller passes `fieldDerivations`, and the v0.9 flow test and the builder's removal test go red if one stops.

The shape:

- `sourcesOf(field)`: the fields its value is computed from. They are graph edges, so a calculation is evaluated after its sources, and `dependantsOf` reports it with a `source` read beside any condition reads.
- `withoutSource(field, id)`: what the D-12 cascade calls; `withoutReferencesTo` drops conditions and sources in one step. A calculation left with no sources blocks Save through its own `validateConfig`, so the cascade needs no special case.
- `derive(field, effective)`: called in topological order with the effective values, so hidden sources are already absent (D6-5: calculations read `effective`, never raw values). The result is written into `effective`, which is what Fill shows and what is submitted, resolved as a Number value (HLD §4.4). A value stored for a derived field is ignored: the result always wins.

`RendererProps` also gains `context` (the whole form, as the Editor already has), so the calculation can name its sources.

## Consequences

- A calculation is display-only: `logic: FieldLogic` with no required axis, and `conditionTarget` returns `null`. Its sources are Number fields only, so it cannot be in a cycle: nothing can read a calculation, and a Number field reads only through conditions.
- `FillForm` passes `evaluation.effective[field.id]` to each visible field. For an answered field that is the raw answer itself (the same object, so `FillField`'s memo holds); for a calculation, its result.
- The removal dialog says "Other fields use Hotel. Removing it also removes those references:" and "Remove field and references" when a source is involved, and keeps the v0.7 wording otherwise.
- With more time: make the parameter required and give the rule tests a one-line helper, so forgetting it is a compile error rather than a test failure.
