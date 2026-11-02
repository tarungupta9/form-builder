import {
  condition,
  group,
  multiSelectField,
  numberField,
  options,
  singleSelectField,
  textField,
  template,
} from '../../test/fixtures';
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

  it('removes the conditions that read a removed field, from every other field, keeping the rest', () => {
    const amount = numberField('Amount');
    const notes = textField('Notes');
    const onNotes = condition(notes.id, { kind: 'text', op: 'equals', value: 'x' });
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'any',
      condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
      onNotes,
    );
    notes.logic.show = group('all', condition(amount.id, { kind: 'number', op: 'gt', value: 1 }));

    const next = builderReducer(initialBuilderState(template([amount, notes, receipt])), {
      type: 'field/removed',
      fieldId: amount.id,
    });

    const [nextNotes, nextReceipt] = next.template.fields;
    expect(nextNotes?.logic.show).toEqual(group('all'));
    expect(nextReceipt?.logic).toEqual({ ...receipt.logic, require: group('any', onNotes) });
  });

  it('removes conditions that compare with an option the field no longer has', () => {
    const payment = singleSelectField('Payment', {
      config: { options: options('Card', 'Cash'), display: 'radio' },
    });
    const [card, cash] = payment.config.options;
    const onCard = condition(payment.id, { kind: 'choice', op: 'equals', value: card!.id });
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'all',
      condition(payment.id, { kind: 'choice', op: 'equals', value: cash!.id }),
      onCard,
    );

    const next = builderReducer(initialBuilderState(template([payment, receipt])), {
      type: 'field/updated',
      field: { ...payment, config: { ...payment.config, options: [card!] } },
    });

    expect(next.template.fields[1]?.logic).toEqual({
      ...receipt.logic,
      require: group('all', onCard),
    });
  });

  it('leaves conditions alone when options are renamed, reordered or added', () => {
    const types = multiSelectField('Types', { config: { options: options('Travel', 'Meals') } });
    const [travel, meals] = types.config.options;
    const notes = textField('Notes');
    notes.logic.show = group(
      'all',
      condition(types.id, { kind: 'multi', op: 'containsAny', value: [travel!.id] }),
    );
    const state = initialBuilderState(template([types, notes]));

    const next = builderReducer(state, {
      type: 'field/updated',
      field: {
        ...types,
        config: { options: [meals!, { ...travel!, label: 'Trips' }, ...options('Other')] },
      },
    });

    expect(next.template.fields[1]).toBe(notes);
  });

  it('leaves a stored condition on an option that was already missing for the author to fix (D6-2)', () => {
    const payment = singleSelectField('Payment');
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'all',
      condition(payment.id, { kind: 'choice', op: 'equals', value: options('Gone')[0]!.id }),
    );

    const next = builderReducer(initialBuilderState(template([payment, receipt])), {
      type: 'field/updated',
      field: { ...payment, label: 'Payment method' },
    });

    expect(next.template.fields[1]).toBe(receipt);
  });
});
