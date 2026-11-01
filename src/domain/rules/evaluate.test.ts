import { condition, group, text, textField } from '../../test/fixtures';
import type { ResponseValues } from '../response';
import type { Predicate } from '../template';
import { evaluateForm } from './evaluate';

// Short text is the only field type so far, so every scenario is built from text fields.
const equals = (value: string): Predicate => ({ kind: 'text', op: 'equals', value });

describe('evaluateForm: visibility', () => {
  it('shows every field by default when no conditions are authored', () => {
    const name = textField('Name');
    const email = textField('Email');

    const result = evaluateForm([name, email], {});

    expect([...result.visible]).toEqual([name.id, email.id]);
  });

  it('shows a hidden-by-default field when its show condition matches', () => {
    const type = textField('Expense type');
    const destination = textField('Destination');
    destination.logic.defaultVisible = false;
    destination.logic.show = group('all', condition(type.id, equals('travel')));

    const fields = [type, destination];
    expect(evaluateForm(fields, {}).visible.has(destination.id)).toBe(false);
    expect(evaluateForm(fields, { [type.id]: text('Travel') }).visible.has(destination.id)).toBe(
      true,
    );
    expect(evaluateForm(fields, { [type.id]: text('Meals') }).visible.has(destination.id)).toBe(
      false,
    );
  });

  it('hides a field when its hide condition matches', () => {
    const answer = textField('Do you have a receipt?');
    const reason = textField('Why not?');
    reason.logic.hide = group('all', condition(answer.id, equals('yes')));

    const fields = [answer, reason];
    expect(evaluateForm(fields, { [answer.id]: text('yes') }).visible.has(reason.id)).toBe(false);
    expect(evaluateForm(fields, { [answer.id]: text('no') }).visible.has(reason.id)).toBe(true);
  });

  it('hide beats show when both groups are active', () => {
    const type = textField('Expense type');
    const note = textField('Note');
    note.logic.defaultVisible = false;
    note.logic.show = group(
      'all',
      condition(type.id, { kind: 'text', op: 'contains', value: 'a' }),
    );
    note.logic.hide = group('all', condition(type.id, equals('taxi')));

    const fields = [type, note];
    expect(evaluateForm(fields, { [type.id]: text('Travel') }).visible.has(note.id)).toBe(true);
    expect(evaluateForm(fields, { [type.id]: text('Taxi') }).visible.has(note.id)).toBe(false);
  });

  it('matches any condition in an "any" group and every condition in an "all" group', () => {
    const type = textField('Expense type');
    const either = textField('Either');
    either.logic.defaultVisible = false;
    either.logic.show = group(
      'any',
      condition(type.id, equals('travel')),
      condition(type.id, equals('meals')),
    );
    const both = textField('Both');
    both.logic.defaultVisible = false;
    both.logic.show = group(
      'all',
      condition(type.id, equals('travel')),
      condition(type.id, { kind: 'text', op: 'contains', value: 'el' }),
    );

    const result = evaluateForm([type, either, both], { [type.id]: text('Meals') });

    expect(result.visible.has(either.id)).toBe(true);
    expect(result.visible.has(both.id)).toBe(false);
  });

  it('leaves a "does not equal" condition inactive while its target is empty', () => {
    const payment = textField('Payment');
    const receipt = textField('Receipt');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'all',
      condition(payment.id, { kind: 'text', op: 'notEquals', value: 'card' }),
    );

    const fields = [payment, receipt];
    expect(evaluateForm(fields, {}).visible.has(receipt.id)).toBe(false);
    expect(evaluateForm(fields, { [payment.id]: text('  ') }).visible.has(receipt.id)).toBe(false);
    expect(evaluateForm(fields, { [payment.id]: text('cash') }).visible.has(receipt.id)).toBe(true);
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
    const answer = textField('Do you have a receipt?');
    const reason = textField('Why not?');
    reason.logic.hide = group('all', condition(answer.id, equals('yes')));
    const values: ResponseValues = { [answer.id]: text('yes'), [reason.id]: text('Lost it') };

    const result = evaluateForm([answer, reason], values);

    expect(result.effective).toEqual({ [answer.id]: text('yes') });
    // Kept so that un-hiding the field restores what the user typed (D-9).
    expect(values[reason.id]).toEqual(text('Lost it'));
  });
});

describe('evaluateForm: chained conditions', () => {
  // A → B → C: B is shown by A, C is shown by B.
  const build = () => {
    const a = textField('A');
    const b = textField('B');
    b.logic.defaultVisible = false;
    b.logic.show = group('all', condition(a.id, equals('travel')));
    const c = textField('C');
    c.logic.defaultVisible = false;
    c.logic.show = group('all', condition(b.id, equals('yes')));
    return { a, b, c };
  };

  it('resolves A → B → C in one pass', () => {
    const { a, b, c } = build();
    const result = evaluateForm([a, b, c], { [a.id]: text('Travel'), [b.id]: text('Yes ') });

    expect(result.visible.has(b.id)).toBe(true);
    expect(result.visible.has(c.id)).toBe(true);
  });

  it('resolves the chain whatever the form order', () => {
    const { a, b, c } = build();
    const result = evaluateForm([c, b, a], { [a.id]: text('travel'), [b.id]: text('yes') });

    expect(result.visible.has(c.id)).toBe(true);
  });

  it('falls back to the default when the controlling field is hidden, even though it still holds a value', () => {
    const { a, b, c } = build();
    const result = evaluateForm([a, b, c], { [a.id]: text('Meals'), [b.id]: text('yes') });

    expect(result.visible.has(b.id)).toBe(false);
    expect(result.visible.has(c.id)).toBe(false);
    expect(result.effective[b.id]).toBeUndefined();
  });

  it('treats fields caught in a cycle as their defaults instead of looping', () => {
    const a = textField('A');
    const b = textField('B');
    a.logic.hide = group('all', condition(b.id, equals('x')));
    b.logic.hide = group('all', condition(a.id, equals('x')));

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
    const payment = textField('Payment');
    const receipt = textField('Receipt number');
    receipt.logic.require = group('all', condition(payment.id, equals('cash')));

    const fields = [payment, receipt];
    expect(evaluateForm(fields, { [payment.id]: text('Cash') }).required.has(receipt.id)).toBe(
      true,
    );
    expect(evaluateForm(fields, { [payment.id]: text('Card') }).required.has(receipt.id)).toBe(
      false,
    );
  });

  it('require beats not-require when both groups are active', () => {
    const payment = textField('Payment');
    const receipt = textField('Receipt number');
    receipt.logic.defaultRequired = true;
    receipt.logic.unrequire = group(
      'all',
      condition(payment.id, { kind: 'text', op: 'contains', value: 'card' }),
    );
    receipt.logic.require = group('all', condition(payment.id, equals('company card')));

    const fields = [payment, receipt];
    expect(
      evaluateForm(fields, { [payment.id]: text('Personal card') }).required.has(receipt.id),
    ).toBe(false);
    expect(
      evaluateForm(fields, { [payment.id]: text('Company card') }).required.has(receipt.id),
    ).toBe(true);
  });

  it('never marks a hidden field as required, even when it is required by default', () => {
    const answer = textField('Do you have a receipt?');
    const reason = textField('Why not?');
    reason.logic.defaultRequired = true;
    reason.logic.hide = group('all', condition(answer.id, equals('yes')));

    const result = evaluateForm([answer, reason], { [answer.id]: text('yes') });

    expect(result.visible.has(reason.id)).toBe(false);
    expect(result.required.has(reason.id)).toBe(false);
  });

  it('resolves the show group and the require group of one field independently', () => {
    const type = textField('Type');
    const payment = textField('Payment');
    const receipt = textField('Receipt');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'any',
      condition(type.id, equals('travel')),
      condition(type.id, equals('meals')),
    );
    receipt.logic.require = group(
      'all',
      condition(type.id, equals('meals')),
      condition(payment.id, equals('cash')),
    );
    const fields = [type, payment, receipt];

    const onlyShown = evaluateForm(fields, { [type.id]: text('Meals') });
    expect(onlyShown.visible.has(receipt.id)).toBe(true);
    expect(onlyShown.required.has(receipt.id)).toBe(false);

    const shownAndRequired = evaluateForm(fields, {
      [type.id]: text('Meals'),
      [payment.id]: text('Cash'),
    });
    expect(shownAndRequired.required.has(receipt.id)).toBe(true);
  });
});
