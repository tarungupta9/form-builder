import {
  condition,
  group,
  multiSelectField,
  numberField,
  options,
  sectionField,
  singleSelectField,
  textField,
} from '../../test/fixtures';
import type { Predicate } from '../template';
import {
  dependantsOf,
  describeReads,
  optionDependantsOf,
  withoutConditionsComparing,
  withoutConditionsOn,
} from './references';

const over50: Predicate = { kind: 'number', op: 'gt', value: 50 };

describe('dependantsOf', () => {
  it('lists each field that reads the removed one, with the groups that read it, in form order', () => {
    const amount = numberField('Amount');
    const notes = textField('Notes');
    notes.logic.show = group('all', condition(amount.id, over50));
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'all',
      condition(amount.id, over50),
      condition(amount.id, over50),
    );
    receipt.logic.hide = group(
      'any',
      condition(notes.id, { kind: 'text', op: 'equals', value: 'x' }),
    );
    const heading = sectionField('Approval');
    heading.logic.hide = group('all', condition(amount.id, over50));

    const found = dependantsOf([amount, notes, receipt, heading], amount.id);

    expect(found.map(({ field, reads }) => [field.label, reads])).toEqual([
      ['Notes', [{ effect: 'show', count: 1 }]],
      ['Receipt number', [{ effect: 'require', count: 2 }]],
      ['Approval', [{ effect: 'hide', count: 1 }]],
    ]);
  });

  it('leaves out fields that read it only through a chain', () => {
    const amount = numberField('Amount');
    const nights = numberField('Nights');
    nights.logic.show = group('all', condition(amount.id, over50));
    const reason = textField('Reason');
    reason.logic.show = group('all', condition(nights.id, over50));

    expect(dependantsOf([amount, nights, reason], amount.id).map((d) => d.field.label)).toEqual([
      'Nights',
    ]);
  });

  it('finds nothing for a field no condition reads', () => {
    const amount = numberField('Amount');

    expect(dependantsOf([amount, textField('Notes')], amount.id)).toEqual([]);
  });
});

describe('withoutConditionsOn', () => {
  it('removes conditions on the field from every group and keeps the rest, match included', () => {
    const amount = numberField('Amount');
    const notes = textField('Notes');
    const keep = condition(notes.id, { kind: 'text', op: 'equals', value: 'x' });
    const receipt = textField('Receipt number');
    receipt.logic.show = group('any', condition(amount.id, over50), keep);
    receipt.logic.hide = group('all', condition(amount.id, over50));
    receipt.logic.require = group('any', condition(amount.id, over50));
    receipt.logic.unrequire = group('any', keep, condition(amount.id, over50));

    const cleaned = withoutConditionsOn(receipt, amount.id);

    expect(cleaned.logic).toEqual({
      ...receipt.logic,
      show: group('any', keep),
      hide: group('all'),
      require: group('any'),
      unrequire: group('any', keep),
    });
  });

  it('returns the same field when nothing reads the removed one, and works on display-only fields', () => {
    const amount = numberField('Amount');
    const heading = sectionField('Approval');
    heading.logic.show = group('all', condition(amount.id, over50));
    const notes = textField('Notes');

    expect(withoutConditionsOn(notes, amount.id)).toBe(notes);
    expect(withoutConditionsOn(heading, amount.id).logic.show).toEqual(group('all'));
  });
});

describe('optionDependantsOf', () => {
  it('finds the conditions that compare with one option, for choice and multi targets', () => {
    const payment = singleSelectField('Payment', {
      config: { options: options('Card', 'Cash'), display: 'radio' },
    });
    const [card, cash] = payment.config.options;
    const types = multiSelectField('Types', { config: { options: options('Travel', 'Meals') } });
    const [travel, meals] = types.config.options;
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'all',
      condition(payment.id, { kind: 'choice', op: 'equals', value: cash!.id }),
      condition(payment.id, { kind: 'choice', op: 'equals', value: card!.id }),
    );
    const notes = textField('Notes');
    notes.logic.show = group(
      'any',
      condition(types.id, { kind: 'multi', op: 'containsAll', value: [travel!.id, meals!.id] }),
    );
    const fields = [payment, types, receipt, notes];

    expect(
      optionDependantsOf(fields, payment.id, cash!.id).map((d) => [d.field.label, d.reads]),
    ).toEqual([['Receipt number', [{ effect: 'require', count: 1 }]]]);
    expect(optionDependantsOf(fields, types.id, meals!.id).map((d) => d.field.label)).toEqual([
      'Notes',
    ]);
    expect(optionDependantsOf(fields, payment.id, travel!.id)).toEqual([]);
  });
});

describe('withoutConditionsComparing', () => {
  it('removes the whole condition, even a multi condition that names other options too (D7-7)', () => {
    const types = multiSelectField('Types', { config: { options: options('Travel', 'Meals') } });
    const [travel, meals] = types.config.options;
    const notes = textField('Notes');
    const onlyTravel = condition(types.id, {
      kind: 'multi',
      op: 'containsAny',
      value: [travel!.id],
    });
    notes.logic.show = group(
      'any',
      condition(types.id, { kind: 'multi', op: 'containsAll', value: [travel!.id, meals!.id] }),
      onlyTravel,
    );

    const cleaned = withoutConditionsComparing(notes, types.id, [meals!.id]);

    expect(cleaned.logic.show).toEqual(group('any', onlyTravel));
  });

  it('returns the same field when none of its conditions name the removed option', () => {
    const payment = singleSelectField('Payment');
    const [card] = payment.config.options;
    const other = singleSelectField('Other');
    const notes = textField('Notes');
    notes.logic.show = group(
      'all',
      condition(other.id, { kind: 'choice', op: 'equals', value: other.config.options[0]!.id }),
    );

    expect(withoutConditionsComparing(notes, payment.id, [card!.id])).toBe(notes);
  });
});

describe('describeReads', () => {
  it('names each group that reads the field, with its count', () => {
    expect(describeReads([{ effect: 'require', count: 1 }])).toBe('1 required condition');
    expect(
      describeReads([
        { effect: 'show', count: 2 },
        { effect: 'unrequire', count: 1 },
      ]),
    ).toBe('2 show conditions and 1 not-required condition');
  });
});
