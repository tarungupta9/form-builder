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

The contract grows one capability per slice: v0.1 has what the builder and storage need; filling in, validating answers and export arrive in v0.2 and v0.3. The field union also grows one type per slice, so each type slice's diff shows exactly what adding a type costs.

## Consequences

- Shared code that names a type is a seam leak. Starting the union with `text` only made three such leaks compile errors. One is gone: the card's field count compared with `'section'` to leave section headers out, and now counts every field (D-19 as revised), so it names no type. The other two, the calculation checks in the rules engine and in the storage invariants, were removed until v0.9, which decides how a derived value plugs in.
- Shared rules that apply to every field (a label, the Required toggle) live in the builder, not in each plugin.
- A plugin can still reach shared code through `fields/shared/`; that is reuse, not a leak, as long as the dependency points from the plugin to the shared code.
