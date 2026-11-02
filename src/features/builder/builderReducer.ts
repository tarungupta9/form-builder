/**
 * The builder's editing rules as a pure reducer, so each one is tested without rendering.
 * Actions carry finished values: a new field arrives already created (with its fresh ID), which
 * keeps the reducer free of randomness and time.
 *
 * Deleting never leaves a broken reference (D-12): removing a field removes the conditions that
 * read it, and removing an option removes the conditions that compare with it. The builder asks
 * the author first; the reducer only makes sure the template it holds is always consistent.
 */
import type { FieldId, OptionId } from '../../domain/ids';
import { withoutConditionsComparing, withoutConditionsOn } from '../../domain/rules/references';
import type { Field, FormTemplate } from '../../domain/template';
import { definitionOf } from '../../fields/registry';

export interface BuilderState {
  template: FormTemplate;
  /** The template as last saved (or as opened), so unsaved changes can be derived (D-21). */
  saved: FormTemplate;
  /** The field whose settings the config panel shows; `null` when none is, and the panel says so. */
  selectedFieldId: FieldId | null;
}

export type BuilderAction =
  /** Title and description change together: the details dialog applies them in one step. */
  | { type: 'details/changed'; title: string; description: string }
  /** `at` is where a palette drop lands; without it the field goes after the selection. */
  | { type: 'field/added'; field: Field; at?: number }
  | { type: 'field/updated'; field: Field }
  | { type: 'field/removed'; fieldId: FieldId }
  | { type: 'field/selected'; fieldId: FieldId | null }
  /**
   * Drag and drop and the Move buttons both send this (ADR 0016). `toIndex` is the field's
   * index in the resulting list, as in `arrayMove`.
   */
  | { type: 'field/moved'; fieldId: FieldId; toIndex: number }
  /** This tab saved, or the author took the version another tab saved. */
  | { type: 'template/saved'; template: FormTemplate };

export const initialBuilderState = (template: FormTemplate): BuilderState => ({
  template,
  saved: template,
  selectedFieldId: null,
});

/**
 * Whether the template differs from its last saved version, by content rather than by
 * reference: applying the details dialog unchanged, or moving a field back, is not a change.
 * A difference in key order could only cause a needless prompt, never a missed one.
 */
export function hasUnsavedChanges({ template, saved }: BuilderState): boolean {
  return (
    template.title !== saved.title ||
    template.description !== saved.description ||
    JSON.stringify(template.fields) !== JSON.stringify(saved.fields)
  );
}

/** Where a new field goes: after the selected field, so it lands where the author is looking; else last. */
export function insertionIndex(fields: readonly Field[], selectedFieldId: FieldId | null): number {
  const selectedIndex = fields.findIndex((field) => field.id === selectedFieldId);
  return selectedIndex === -1 ? fields.length : selectedIndex + 1;
}

/** The option IDs a condition could compare with on `field`, from its plugin's `conditionTarget`. */
function comparableOptionIds(field: Field): OptionId[] {
  const target = definitionOf(field).conditionTarget(field);
  return target?.kind === 'choice' || target?.kind === 'multi'
    ? target.options.map((option) => option.id)
    : [];
}

/**
 * Options `after` no longer has that `before` did. Only options removed by this edit count, so a
 * stored condition on an option that was already missing stays for the author to see (D6-2).
 */
function removedOptionIds(before: Field, after: Field): OptionId[] {
  const kept = new Set(comparableOptionIds(after));
  return comparableOptionIds(before).filter((id) => !kept.has(id));
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
      const at = action.at ?? insertionIndex(template.fields, state.selectedFieldId);
      const fields = template.fields.toSpliced(at, 0, action.field);
      return { ...state, template: withFields(fields), selectedFieldId: action.field.id };
    }
    case 'field/updated': {
      const updated = action.field;
      const before = template.fields.find((field) => field.id === updated.id);
      const removed = before ? removedOptionIds(before, updated) : [];
      return {
        ...state,
        template: withFields(
          template.fields.map((field) =>
            field.id === updated.id
              ? updated
              : withoutConditionsComparing(field, updated.id, removed),
          ),
        ),
      };
    }
    case 'field/removed':
      return {
        ...state,
        template: withFields(
          template.fields
            .filter((field) => field.id !== action.fieldId)
            .map((field) => withoutConditionsOn(field, action.fieldId)),
        ),
        selectedFieldId: state.selectedFieldId === action.fieldId ? null : state.selectedFieldId,
      };
    case 'field/selected':
      return { ...state, selectedFieldId: action.fieldId };
    case 'field/moved': {
      // Conditions are untouched: a field may read fields above or below it (Q-4), and
      // evaluation runs in dependency order, not form order. The selection stays with its field.
      const from = template.fields.findIndex((field) => field.id === action.fieldId);
      const moved = template.fields[from];
      if (!moved) return state;
      const to = Math.min(Math.max(action.toIndex, 0), template.fields.length - 1);
      if (to === from) return state;
      const fields = template.fields.toSpliced(from, 1).toSpliced(to, 0, moved);
      return { ...state, template: withFields(fields) };
    }
    case 'template/saved': {
      const { fields } = action.template;
      // Taking another tab's version can drop the selected field.
      const selectedFieldId = fields.some((field) => field.id === state.selectedFieldId)
        ? state.selectedFieldId
        : null;
      return { template: action.template, saved: action.template, selectedFieldId };
    }
  }
}
