/**
 * The pure half of the plugin registry: field type → definition. The mapped type makes it
 * exhaustive, so a new member of `FieldTypeMap` without a definition here is a compile error.
 */
import type { FieldDerivations } from '../domain/rules/derivations';
import type { Field, FieldType } from '../domain/template';
import type { FieldDefinition } from './contract';
import { dateDefinition } from './date/definition';
import { numberDefinition } from './number/definition';
import { sectionDefinition } from './section/definition';
import { textDefinition } from './text/definition';
import { textareaDefinition } from './textarea/definition';
import { singleSelectDefinition } from './single-select/definition';
import { multiSelectDefinition } from './multi-select/definition';
import { fileDefinition } from './file/definition';
import { calculationDefinition } from './calculation/definition';

export const fieldRegistry: { readonly [K in FieldType]: FieldDefinition<K> } = {
  text: textDefinition,
  textarea: textareaDefinition,
  number: numberDefinition,
  date: dateDefinition,
  singleSelect: singleSelectDefinition,
  multiSelect: multiSelectDefinition,
  section: sectionDefinition,
  file: fileDefinition,
  calculation: calculationDefinition,
};

/**
 * Palette order, which is the key order above. New types go in this order, the same as
 * `FieldTypeMap`: text, textarea, number, date, singleSelect, multiSelect, section, then file
 * and calculation. A flat list for now; grouping the palette would be a change to the palette.
 */
export const FIELD_TYPES = Object.keys(fieldRegistry) as FieldType[];

/** The definition for a field of any type (see the note on method syntax in `contract.ts`). */
export function definitionOf(field: Field): FieldDefinition<FieldType> {
  return fieldRegistry[field.type];
}

export function definitionFor(type: FieldType): FieldDefinition<FieldType> {
  return fieldRegistry[type];
}

/**
 * The plugins' `derivation` members, in the shape the rules engine takes, so the engine computes
 * derived values and follows their sources without importing the registry (ADR 0018). Every
 * caller of the graph, the evaluation and the D-12 references passes this.
 */
export const fieldDerivations: FieldDerivations = {
  sourcesOf: (field) => definitionOf(field).derivation?.sourcesOf(field) ?? [],
  withoutSource: (field, sourceId) =>
    definitionOf(field).derivation?.withoutSource(field, sourceId) ?? field,
  derive: (field, effective) => {
    const derivation = definitionOf(field).derivation;
    return derivation ? { value: derivation.derive(field, effective) } : null;
  },
};
