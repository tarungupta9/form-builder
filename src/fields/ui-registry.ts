/**
 * The React half of the plugin registry: field type → UI. Typed as a mapped type, so
 * forgetting the UI for a new field type is a compile error.
 */
import type { Field, FieldType } from '../domain/template';
import type { FieldUi } from './contract';
import { DateEditor } from './date/DateEditor';
import { DateRenderer } from './date/DateRenderer';
import { NumberEditor } from './number/NumberEditor';
import { NumberRenderer } from './number/NumberRenderer';
import { SectionEditor } from './section/SectionEditor';
import { SectionRenderer } from './section/SectionRenderer';
import { TextEditor } from './text/TextEditor';
import { TextRenderer } from './text/TextRenderer';
import { TextareaEditor } from './textarea/TextareaEditor';
import { TextareaRenderer } from './textarea/TextareaRenderer';
import { SingleSelectEditor } from './single-select/SingleSelectEditor';
import { SingleSelectRenderer } from './single-select/SingleSelectRenderer';
import { MultiSelectEditor } from './multi-select/MultiSelectEditor';
import { MultiSelectRenderer } from './multi-select/MultiSelectRenderer';

export const fieldUi: { readonly [K in FieldType]: FieldUi<K> } = {
  text: { Editor: TextEditor, Renderer: TextRenderer },
  textarea: { Editor: TextareaEditor, Renderer: TextareaRenderer },
  number: { Editor: NumberEditor, Renderer: NumberRenderer },
  date: { Editor: DateEditor, Renderer: DateRenderer },
  singleSelect: { Editor: SingleSelectEditor, Renderer: SingleSelectRenderer },
  multiSelect: { Editor: MultiSelectEditor, Renderer: MultiSelectRenderer },
  section: { Editor: SectionEditor, Renderer: SectionRenderer },
};

export function uiOf(field: Field): FieldUi<FieldType> {
  return fieldUi[field.type];
}
