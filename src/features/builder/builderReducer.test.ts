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
import {
  type BuilderState,
  builderReducer,
  hasUnsavedChanges,
  initialBuilderState,
} from './builderReducer';

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

describe('builderReducer: reordering', () => {
  const threeFields = () => {
    const [a, b, c] = [textField('A'), textField('B'), textField('C')];
    return { a, b, c, state: initialBuilderState(template([a, b, c])) };
  };

  it.each([
    ['down one', 'a', 1, ['b', 'a', 'c']],
    ['up one', 'c', 1, ['a', 'c', 'b']],
    ['to the top', 'c', 0, ['c', 'a', 'b']],
    ['to the bottom', 'a', 2, ['b', 'c', 'a']],
  ] as const)('moves a field %s, to the given index', (_, name, toIndex, order) => {
    const fields = threeFields();
    const next = builderReducer(fields.state, {
      type: 'field/moved',
      fieldId: fields[name].id,
      toIndex,
    });
    expect(ids(next)).toEqual(order.map((key) => fields[key].id));
  });

  it('keeps the moved field selected', () => {
    const { a, b, state } = threeFields();
    const next = builderReducer(
      { ...state, selectedFieldId: a.id },
      { type: 'field/moved', fieldId: a.id, toIndex: 2 },
    );
    expect(next.selectedFieldId).toBe(a.id);
    expect(ids(next).indexOf(b.id)).toBe(0);
  });

  it('leaves the selection where it was when another field moves', () => {
    const { b, c, state } = threeFields();
    const next = builderReducer(
      { ...state, selectedFieldId: b.id },
      { type: 'field/moved', fieldId: c.id, toIndex: 0 },
    );
    expect(next.selectedFieldId).toBe(b.id);
  });

  it('ignores an unknown field', () => {
    const { state } = threeFields();
    const next = builderReducer(state, {
      type: 'field/moved',
      fieldId: textField('Gone').id,
      toIndex: 0,
    });
    expect(next).toBe(state);
  });

  it('clamps an index past either end', () => {
    const { a, b, c, state } = threeFields();
    expect(ids(builderReducer(state, { type: 'field/moved', fieldId: a.id, toIndex: 9 }))).toEqual([
      b.id,
      c.id,
      a.id,
    ]);
    expect(ids(builderReducer(state, { type: 'field/moved', fieldId: c.id, toIndex: -4 }))).toEqual(
      [c.id, a.id, b.id],
    );
  });

  it('changes nothing for a move to the same place, so the template is not dirtied', () => {
    const { b, state } = threeFields();
    expect(builderReducer(state, { type: 'field/moved', fieldId: b.id, toIndex: 1 })).toBe(state);
  });

  it('leaves conditions as they are, whichever side of their target a field moves to', () => {
    const amount = numberField('Amount');
    const receipt = textField('Receipt');
    receipt.logic.show = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
    );
    const state = initialBuilderState(template([amount, receipt]));
    const next = builderReducer(state, { type: 'field/moved', fieldId: receipt.id, toIndex: 0 });
    expect(next.template.fields).toEqual([receipt, amount]);
  });

  it('inserts a palette drop at the given position, whatever is selected', () => {
    const { a, b, c, state } = threeFields();
    const added = textField('New');
    const next = builderReducer(
      { ...state, selectedFieldId: c.id },
      { type: 'field/added', field: added, at: 1 },
    );
    expect(ids(next)).toEqual([a.id, added.id, b.id, c.id]);
    expect(next.selectedFieldId).toBe(added.id);
  });
});

describe('builderReducer: unsaved changes', () => {
  it('starts with nothing unsaved', () => {
    expect(hasUnsavedChanges(initialBuilderState(template([textField('A')])))).toBe(false);
  });

  it('counts an edit as unsaved until the template is saved', () => {
    const a = textField('A');
    const edited = builderReducer(initialBuilderState(template([a])), {
      type: 'field/updated',
      field: { ...a, label: 'Renamed' },
    });
    expect(hasUnsavedChanges(edited)).toBe(true);

    const saved = builderReducer(edited, { type: 'template/saved', template: edited.template });
    expect(hasUnsavedChanges(saved)).toBe(false);
    expect(saved.saved).toBe(edited.template);
  });

  it('does not count content that ends up as it was saved, such as a field moved back', () => {
    const [a, b] = [textField('A'), textField('B')];
    const state = initialBuilderState(template([a, b]));
    const there = builderReducer(state, { type: 'field/moved', fieldId: a.id, toIndex: 1 });
    expect(hasUnsavedChanges(there)).toBe(true);
    const back = builderReducer(there, { type: 'field/moved', fieldId: a.id, toIndex: 0 });
    expect(hasUnsavedChanges(back)).toBe(false);
  });

  it('clears the selection when the version taken from another tab no longer has that field', () => {
    const [a, b] = [textField('A'), textField('B')];
    const state = { ...initialBuilderState(template([a, b])), selectedFieldId: b.id };
    const theirs = { ...state.template, fields: [a] };
    expect(
      builderReducer(state, { type: 'template/saved', template: theirs }).selectedFieldId,
    ).toBe(null);
    const kept = { ...state, selectedFieldId: a.id };
    expect(builderReducer(kept, { type: 'template/saved', template: theirs }).selectedFieldId).toBe(
      a.id,
    );
  });
});
