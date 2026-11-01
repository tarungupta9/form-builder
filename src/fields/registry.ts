/**
 * The pure half of the plugin registry: field type → definition. The mapped type makes it
 * exhaustive, so a new member of `FieldTypeMap` without a definition here is a compile error.
 */
import type { Field, FieldType } from '../domain/template';
import type { FieldDefinition } from './contract';
import { textDefinition } from './text/definition';

export const fieldRegistry: { readonly [K in FieldType]: FieldDefinition<K> } = {
  text: textDefinition,
};

/** Palette order. */
export const FIELD_TYPES = Object.keys(fieldRegistry) as FieldType[];

/** The definition for a field of any type (see the note on method syntax in `contract.ts`). */
export function definitionOf(field: Field): FieldDefinition<FieldType> {
  return fieldRegistry[field.type];
}

export function definitionFor(type: FieldType): FieldDefinition<FieldType> {
  return fieldRegistry[type];
}
