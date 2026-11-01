import { textField, template } from '../../test/fixtures';
import { type BuilderState, builderReducer, initialBuilderState } from './builderReducer';

const ids = (state: BuilderState) => state.template.fields.map((field) => field.id);

describe('builderReducer', () => {
  it('adds a field after the selected one and selects it', () => {
    const [a, b, c] = [textField('A'), textField('B'), textField('C')];
    const added = textField('New');
    const state = { ...initialBuilderState(template([a, b, c])), selectedFieldId: a.id };

    const next = builderReducer(state, { type: 'field/added', field: added });

    expect(ids(next)).toEqual([a.id, added.id, b.id, c.id]);
    expect(next.selectedFieldId).toBe(added.id);
  });

  it('adds a field at the end when nothing is selected', () => {
    const a = textField('A');
    const added = textField('New');

    const next = builderReducer(initialBuilderState(template([a])), {
      type: 'field/added',
      field: added,
    });

    expect(ids(next)).toEqual([a.id, added.id]);
  });

  it('replaces a field when its settings change, keeping its place', () => {
    const [a, b] = [textField('A'), textField('B')];
    const renamed = { ...a, label: 'Employee name' };

    const next = builderReducer(initialBuilderState(template([a, b])), {
      type: 'field/updated',
      field: renamed,
    });

    expect(next.template.fields).toEqual([renamed, b]);
  });

  it('clears the selection when the selected field is removed', () => {
    const [a, b] = [textField('A'), textField('B')];
    const state = { ...initialBuilderState(template([a, b])), selectedFieldId: a.id };

    const next = builderReducer(state, { type: 'field/removed', fieldId: a.id });

    expect(ids(next)).toEqual([b.id]);
    expect(next.selectedFieldId).toBeNull();
  });

  it('keeps the selection when another field is removed', () => {
    const [a, b] = [textField('A'), textField('B')];
    const state = { ...initialBuilderState(template([a, b])), selectedFieldId: a.id };

    const next = builderReducer(state, { type: 'field/removed', fieldId: b.id });

    expect(next.selectedFieldId).toBe(a.id);
  });

  it('changes the title and description', () => {
    const state = builderReducer(initialBuilderState(template([])), {
      type: 'details/changed',
      title: 'Leave request',
      description: 'For staff',
    });

    expect(state.template.title).toBe('Leave request');
    expect(state.template.description).toBe('For staff');
  });
});
