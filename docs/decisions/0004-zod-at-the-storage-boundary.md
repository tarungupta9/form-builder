# 0004. Validate everything read from storage with zod

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

`localStorage` is untrusted input: the user can edit it in DevTools, an older version of the app may have written it, and another tab may be mid-write. The types promise, for example, that every `FieldId` is a real UUID and that no field has a condition on itself. Those promises only hold if stored data is checked before the app uses it.

## Options considered

### Trust `JSON.parse` and cast

Pros: no code. Cons: a hand-edited value crashes a screen far from the cause, or silently corrupts data on the next save.

### Hand-written type guards

Pros: no dependency. Cons: verbose for a nested, discriminated data model, and they drift from the types as fields are added.

### zod schemas

Pros: declarative, composable, and each schema is checked against its TypeScript type (`z.ZodType<FormTemplate>`), so a schema that drifts from the type fails to compile. Transforms mint branded IDs only after the string is checked. Cons: a runtime dependency in the bundle.

## Decision

zod. Shared parts of the model (IDs, conditions, field logic) are in `domain/schemas.ts`. Each field type owns its config schema in its plugin folder, and `storage/schemas.ts` joins them through the registry. Invariants the types cannot express, such as "no field has a condition on itself", are `superRefine` checks.

## Consequences

- A template that fails validation is never used. The collection copies the raw value to a quarantine key and reports it (ADR 0007), so bad data is neither trusted nor lost.
- A new field type's schema joins the storage schema by being registered; storage code does not change.
- Invariants checked at load time are only for data the builder could never produce. The builder enforces the same rules as the author edits.
