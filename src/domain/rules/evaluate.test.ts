import {
  choice,
  condition,
  group,
  multi,
  multiSelectField,
  num,
  numberField,
  option,
  singleSelectField,
  text,
  textField,
} from '../../test/fixtures';
import type { OptionId } from '../ids';
import type { ResponseValues } from '../response';
import type { Field, Option, Predicate } from '../template';
import { evaluateForm } from './evaluate';

const travel = option('Travel');
const meals = option('Meals');
const other = option('Other');
const cash = option('Cash');
const card = option('Card');

const select = (label: string, choices: Option[]) =>
  singleSelectField(label, { config: { options: choices, display: 'radio' } });
const isChoice = (id: OptionId): Predicate => ({ kind: 'choice', op: 'equals', value: id });

describe('evaluateForm: visibility', () => {
  it('shows every field by default when no conditions are authored', () => {
    const name = textField('Name');
    const email = textField('Email');

    const result = evaluateForm([name, email], {});

    expect([...result.visible]).toEqual([name.id, email.id]);
  });

  it('shows a hidden-by-default field when its show condition matches', () => {
    const type = select('Expense type', [travel, meals]);
    const destination = textField('Destination');
    destination.logic.defaultVisible = false;
    destination.logic.show = group('all', condition(type.id, isChoice(travel.id)));

    const fields = [type, destination];
    expect(evaluateForm(fields, {}).visible.has(destination.id)).toBe(false);
    expect(evaluateForm(fields, { [type.id]: choice(travel.id) }).visible.has(destination.id)).toBe(
      true,
    );
    expect(evaluateForm(fields, { [type.id]: choice(meals.id) }).visible.has(destination.id)).toBe(
      false,
    );
  });

  it('hides a field when its hide condition matches', () => {
    const amount = numberField('Amount');
    const reason = textField('Reason');
    reason.logic.hide = group('all', condition(amount.id, { kind: 'number', op: 'lt', value: 10 }));

    const fields = [amount, reason];
    expect(evaluateForm(fields, { [amount.id]: num('5') }).visible.has(reason.id)).toBe(false);
    expect(evaluateForm(fields, { [amount.id]: num('50') }).visible.has(reason.id)).toBe(true);
  });

  it('hide beats show when both groups are active', () => {
    const amount = numberField('Amount');
    const note = textField('Note');
    note.logic.defaultVisible = false;
    note.logic.show = group('all', condition(amount.id, { kind: 'number', op: 'gt', value: 0 }));
    note.logic.hide = group('all', condition(amount.id, { kind: 'number', op: 'gt', value: 100 }));

    const fields = [amount, note];
    expect(evaluateForm(fields, { [amount.id]: num('50') }).visible.has(note.id)).toBe(true);
    expect(evaluateForm(fields, { [amount.id]: num('500') }).visible.has(note.id)).toBe(false);
  });

  it('matches any condition in an "any" group and every condition in an "all" group', () => {
    const type = select('Expense type', [travel, meals, other]);
    const either = textField('Either');
    either.logic.defaultVisible = false;
    either.logic.show = group(
      'any',
      condition(type.id, isChoice(travel.id)),
      condition(type.id, isChoice(meals.id)),
    );
    const both = textField('Both');
    both.logic.defaultVisible = false;
    both.logic.show = group(
      'all',
      condition(type.id, isChoice(travel.id)),
      condition(type.id, isChoice(meals.id)),
    );

    const result = evaluateForm([type, either, both], { [type.id]: choice(meals.id) });

    expect(result.visible.has(either.id)).toBe(true);
    expect(result.visible.has(both.id)).toBe(false);
  });

  it('resolves an "any" show group and an "all" hide group on the same field independently', () => {
    const type = select('Expense type', [travel, meals, other]);
    const amount = numberField('Amount');
    const receipt = textField('Receipt');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'any',
      condition(type.id, isChoice(travel.id)),
      condition(type.id, isChoice(meals.id)),
    );
    // Hidden only when both hold: small and a meal.
    receipt.logic.hide = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'lt', value: 10 }),
      condition(type.id, isChoice(meals.id)),
    );
    const fields: Field[] = [type, amount, receipt];
    const visibleFor = (values: ResponseValues) =>
      evaluateForm(fields, values).visible.has(receipt.id);

    // One show condition is enough; one hide condition is not.
    expect(visibleFor({ [type.id]: choice(travel.id), [amount.id]: num('5') })).toBe(true);
    expect(visibleFor({ [type.id]: choice(meals.id), [amount.id]: num('50') })).toBe(true);
    expect(visibleFor({ [type.id]: choice(meals.id), [amount.id]: num('5') })).toBe(false);
    expect(visibleFor({ [type.id]: choice(other.id), [amount.id]: num('50') })).toBe(false);
  });

  it('leaves a "does not equal" condition inactive while its target is empty', () => {
    const payment = select('Payment', [cash, card]);
    const receipt = textField('Receipt');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'all',
      condition(payment.id, { kind: 'choice', op: 'notEquals', value: card.id }),
    );

    const fields = [payment, receipt];
    expect(evaluateForm(fields, {}).visible.has(receipt.id)).toBe(false);
    expect(evaluateForm(fields, { [payment.id]: choice(null) }).visible.has(receipt.id)).toBe(
      false,
    );
    expect(evaluateForm(fields, { [payment.id]: choice(cash.id) }).visible.has(receipt.id)).toBe(
      true,
    );
  });

  it('leaves a "contains none of" condition inactive while nothing is ticked', () => {
    const types = multiSelectField('Expense types', { config: { options: [travel, meals] } });
    const note = textField('Note');
    note.logic.defaultVisible = false;
    note.logic.show = group(
      'all',
      condition(types.id, { kind: 'multi', op: 'containsNone', value: [travel.id] }),
    );

    const fields = [types, note];
    expect(evaluateForm(fields, { [types.id]: multi() }).visible.has(note.id)).toBe(false);
    expect(evaluateForm(fields, { [types.id]: multi(meals.id) }).visible.has(note.id)).toBe(true);
  });

  it('ignores a condition the builder has not finished', () => {
    const name = textField('Name');
    const other = textField('Other');
    other.logic.hide = group(
      'all',
      condition(name.id, { kind: 'text', op: 'notEquals', value: '' }),
    );

    expect(evaluateForm([name, other], { [name.id]: text('Ada') }).visible.has(other.id)).toBe(
      true,
    );
  });

  it('leaves a hidden field’s value out of the effective values, and keeps the raw value', () => {
    const type = select('Expense type', [travel, meals]);
    const nights = numberField('Nights');
    nights.logic.hide = group('all', condition(type.id, isChoice(meals.id)));
    const values: ResponseValues = { [type.id]: choice(meals.id), [nights.id]: num('4') };

    const result = evaluateForm([type, nights], values);

    expect(result.effective).toEqual({ [type.id]: choice(meals.id) });
    // Kept so that un-hiding the field restores what the user typed (D-9).
    expect(values[nights.id]).toEqual(num('4'));
  });
});

describe('evaluateForm: chained conditions', () => {
  // Expense type → Nights → Approval reason: Nights shows for Travel, the reason for over 3 nights.
  const build = () => {
    const type = select('Expense type', [travel, meals]);
    const nights = numberField('Nights');
    nights.logic.defaultVisible = false;
    nights.logic.show = group('all', condition(type.id, isChoice(travel.id)));
    const reason = textField('Approval reason');
    reason.logic.defaultVisible = false;
    reason.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 3 }));
    return { type, nights, reason };
  };

  it('resolves A → B → C in one pass', () => {
    const { type, nights, reason } = build();

    const result = evaluateForm([type, nights, reason], {
      [type.id]: choice(travel.id),
      [nights.id]: num('4'),
    });

    expect(result.visible.has(nights.id)).toBe(true);
    expect(result.visible.has(reason.id)).toBe(true);
  });

  it('resolves the chain whatever the form order', () => {
    const { type, nights, reason } = build();

    const result = evaluateForm([reason, nights, type], {
      [type.id]: choice(travel.id),
      [nights.id]: num('4'),
    });

    expect(result.visible.has(reason.id)).toBe(true);
  });

  it('falls back to the default when the controlling field is hidden, even though it still holds a value', () => {
    const { type, nights, reason } = build();

    const result = evaluateForm([type, nights, reason], {
      [type.id]: choice(meals.id),
      [nights.id]: num('4'),
    });

    expect(result.visible.has(nights.id)).toBe(false);
    expect(result.visible.has(reason.id)).toBe(false);
    expect(result.effective[nights.id]).toBeUndefined();
  });

  it('keeps a visible-by-default field visible when the field its hide reads is hidden', () => {
    const { type, nights } = build();
    const shortTrip = textField('Short trip note');
    shortTrip.logic.hide = group(
      'all',
      condition(nights.id, { kind: 'number', op: 'gt', value: 3 }),
    );

    // Nights still holds 4, but it is hidden, so the hide condition cannot see it (D-5).
    const result = evaluateForm([type, nights, shortTrip], {
      [type.id]: choice(meals.id),
      [nights.id]: num('4'),
    });

    expect(result.visible.has(shortTrip.id)).toBe(true);
  });

  it('treats fields caught in a cycle as their defaults instead of looping', () => {
    const a = textField('A');
    const b = textField('B');
    a.logic.hide = group('all', condition(b.id, { kind: 'text', op: 'equals', value: 'x' }));
    b.logic.hide = group('all', condition(a.id, { kind: 'text', op: 'equals', value: 'x' }));

    const result = evaluateForm([a, b], { [a.id]: text('x'), [b.id]: text('x') });

    expect(result.visible.has(a.id)).toBe(true);
    expect(result.visible.has(b.id)).toBe(true);
  });
});

describe('evaluateForm: required state', () => {
  it('requires a field that has Required turned on', () => {
    const name = textField('Name');
    name.logic.defaultRequired = true;

    expect(evaluateForm([name], {}).required.has(name.id)).toBe(true);
  });

  it('requires a field when its require condition matches', () => {
    const payment = select('Payment', [cash, card]);
    const receipt = textField('Receipt number');
    receipt.logic.require = group('all', condition(payment.id, isChoice(cash.id)));

    const fields = [payment, receipt];
    expect(evaluateForm(fields, { [payment.id]: choice(cash.id) }).required.has(receipt.id)).toBe(
      true,
    );
    expect(evaluateForm(fields, { [payment.id]: choice(card.id) }).required.has(receipt.id)).toBe(
      false,
    );
  });

  it('require beats not-require when both groups are active', () => {
    const amount = numberField('Amount');
    const receipt = textField('Receipt number');
    receipt.logic.defaultRequired = true;
    receipt.logic.unrequire = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'lt', value: 100 }),
    );
    receipt.logic.require = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
    );

    const fields = [amount, receipt];
    expect(evaluateForm(fields, { [amount.id]: num('20') }).required.has(receipt.id)).toBe(false);
    expect(evaluateForm(fields, { [amount.id]: num('75') }).required.has(receipt.id)).toBe(true);
  });

  it('never marks a hidden field as required, even when it is required by default', () => {
    const type = select('Expense type', [travel, meals]);
    const nights = numberField('Nights');
    nights.logic.defaultRequired = true;
    nights.logic.hide = group('all', condition(type.id, isChoice(meals.id)));

    const result = evaluateForm([type, nights], { [type.id]: choice(meals.id) });

    expect(result.visible.has(nights.id)).toBe(false);
    expect(result.required.has(nights.id)).toBe(false);
  });

  it('resolves the show group and the require group of one field independently', () => {
    const type = select('Type', [travel, meals]);
    const payment = select('Payment', [cash, card]);
    const amount = numberField('Amount');
    const receipt = textField('Receipt');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'any',
      condition(type.id, isChoice(travel.id)),
      condition(type.id, isChoice(meals.id)),
    );
    receipt.logic.require = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
      condition(payment.id, isChoice(cash.id)),
    );
    const fields: Field[] = [type, payment, amount, receipt];

    const onlyShown = evaluateForm(fields, { [type.id]: choice(meals.id), [amount.id]: num('80') });
    expect(onlyShown.visible.has(receipt.id)).toBe(true);
    expect(onlyShown.required.has(receipt.id)).toBe(false);

    const shownAndRequired = evaluateForm(fields, {
      [type.id]: choice(meals.id),
      [amount.id]: num('80'),
      [payment.id]: choice(cash.id),
    });
    expect(shownAndRequired.required.has(receipt.id)).toBe(true);
  });
});
