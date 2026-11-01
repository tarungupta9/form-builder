/**
 * The React half of the plugin registry: field type → UI. Typed as a mapped type, so
 * forgetting the UI for a new field type is a compile error.
 */
import type { Field, FieldType } from '../domain/template';
import type { FieldUi } from './contract';
import { TextEditor } from './text/TextEditor';
import { TextRenderer } from './text/TextRenderer';

export const fieldUi: { readonly [K in FieldType]: FieldUi<K> } = {
  text: { Editor: TextEditor, Renderer: TextRenderer },
};

export function uiOf(field: Field): FieldUi<FieldType> {
  return fieldUi[field.type];
}
