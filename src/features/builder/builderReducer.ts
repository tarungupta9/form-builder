/**
 * The builder's editing rules as a pure reducer, so each one is tested without rendering.
 * Actions carry finished values: a new field arrives already created (with its fresh ID), which
 * keeps the reducer free of randomness and time.
 */
import type { FieldId } from '../../domain/ids';
import type { Field, FormTemplate } from '../../domain/template';

export interface BuilderState {
  template: FormTemplate;
  /** The field whose settings the config panel shows; `null` when none is, and the panel says so. */
  selectedFieldId: FieldId | null;
}

export type BuilderAction =
  /** Title and description change together: the details dialog applies them in one step. */
  | { type: 'details/changed'; title: string; description: string }
  | { type: 'field/added'; field: Field }
  | { type: 'field/updated'; field: Field }
  | { type: 'field/removed'; fieldId: FieldId }
  | { type: 'field/selected'; fieldId: FieldId | null }
  | { type: 'template/saved'; template: FormTemplate };

export const initialBuilderState = (template: FormTemplate): BuilderState => ({
  template,
  selectedFieldId: null,
});

/** Where a new field goes: after the selected field, so it lands where the author is looking; else last. */
export function insertionIndex(fields: readonly Field[], selectedFieldId: FieldId | null): number {
  const selectedIndex = fields.findIndex((field) => field.id === selectedFieldId);
  return selectedIndex === -1 ? fields.length : selectedIndex + 1;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { template } = state;
  const withFields = (fields: Field[]): FormTemplate => ({ ...template, fields });

  switch (action.type) {
    case 'details/changed':
      return {
        ...state,
        template: { ...template, title: action.title, description: action.description },
      };
    case 'field/added': {
      const at = insertionIndex(template.fields, state.selectedFieldId);
      const fields = template.fields.toSpliced(at, 0, action.field);
      return { template: withFields(fields), selectedFieldId: action.field.id };
    }
    case 'field/updated':
      return {
        ...state,
        template: withFields(
          template.fields.map((field) => (field.id === action.field.id ? action.field : field)),
        ),
      };
    case 'field/removed':
      return {
        template: withFields(template.fields.filter((field) => field.id !== action.fieldId)),
        selectedFieldId: state.selectedFieldId === action.fieldId ? null : state.selectedFieldId,
      };
    case 'field/selected':
      return { ...state, selectedFieldId: action.fieldId };
    case 'template/saved':
      return { ...state, template: action.template };
  }
}
