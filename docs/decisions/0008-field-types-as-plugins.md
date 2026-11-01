# 0008. Make each field type a plugin behind one contract

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The spec asks whether someone can add an 11th field type "without editing 6 existing files". The builder, Fill mode, validation, export and storage all need to know something about each type: its defaults, settings, schema, control and PDF formatting.

## Options considered

### Switch on `field.type` wherever behaviour differs

Pros: direct and easy to follow for one type. Cons: every new type edits the palette, the config panel, the renderer, validation, export and storage. That is exactly the cost the spec asks about.

### A plugin contract with two registries

Each type is one folder implementing `FieldDefinition` (pure: defaults, summary, config checks, schema) and `FieldUi` (React: the editor, and from v0.2 the renderer). `fields/registry.ts` and `fields/ui-registry.ts` map type to plugin with mapped types (`{ [K in FieldType]: FieldDefinition<K> }`), so a type missing from either registry is a compile error. Pros: shared code asks the plugin and never names a type. Cons: an indirection to read through; contract methods use method syntax for bivariance, which needs a comment.

## Decision

Plugins. Adding a type means: its folder, one entry in `FieldTypeMap` (`domain/template.ts`), and one line in each registry. The palette, canvas, config panel, Save checks and the storage schema all read from the registries.

The contract grows one capability per slice: v0.1 has what the builder and storage need; filling in and validating answers arrived in v0.2, and export arrives in v0.3. The field union also grows one type per slice, so each type slice's diff shows exactly what adding a type costs.

## Consequences

- Shared code that names a type is a seam leak. Starting the union with `text` only made three such leaks compile errors. One is gone: the card's field count compared with `'section'` to leave section headers out, and now counts every field (D-19 as revised), so it names no type. The other two, the calculation checks in the rules engine and in the storage invariants, were removed until v0.9, which decides how a derived value plugs in.
- v0.2 added Fill mode to the contract: `Renderer` (the control, with its label, hint and error), `readValue` (narrows a stored value to the type's own), `validateValue` (the first problem with an answer, given the field's resolved required state) and `initialValue`. Short text has no initial value, but the member lands now so that Date's "pre-fill today" in v0.4 is a plugin method, not an edit to shared Fill code.
- Shared rules that apply to every field (a label, the Required toggle) live in the builder, not in each plugin.
- **Storage depends on the pure registry** (`fields/registry.ts`, never the UI registry): the stored-field schema is the join of every plugin's schema, and a response's answers are checked with each plugin's `readValue` (ADR 0010). The alternative, a composition root that passes the schemas into storage, would keep storage unaware of plugins but add wiring that every test and the app entry must repeat; the dependency points downward either way.
- **Each type's config interface lives in `domain/template.ts`**, beside its `FieldTypeMap` entry, not in the plugin folder: the domain types reference it, and the domain layer cannot import from `fields/`. So adding a type touches that one shared file, by one interface and one map entry. `npm run check:seam` allows it and flags any other shared file.
- **The claim holds for a type that reuses an existing value kind.** Value kinds (`text`, `number`, `date`, `choice`, `multi`, `files`) and the condition operators that read them are a closed union in the domain, so the engine and the PDF can narrow them exhaustively. A type with a new kind of value (a signature, say) also edits `domain/response.ts`, `domain/values.ts`, `domain/schemas.ts` and `domain/rules/predicates.ts`. That is the honest cost; a type such as Email, whose value is text, costs only the plugin.
- A plugin can still reach shared code through `fields/shared/`; that is reuse, not a leak, as long as the dependency points from the plugin to the shared code.
