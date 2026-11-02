import { buildDependencyGraph } from '../../../domain/rules/graph';
import type { Field } from '../../../domain/template';
import {
  condition,
  group,
  numberField,
  options,
  sectionField,
  singleSelectField,
  textField,
} from '../../../test/fixtures';
import { allowedTargets, loopHint, newCondition, retarget } from './conditionTargets';

/** Expense type → Nights → Approval reason, the demo's chain. */
function expenseClaim() {
  const type = singleSelectField('Expense type', {
    config: { options: options('Travel', 'Meals'), display: 'radio' },
  });
  const nights = numberField('Nights');
  const reason = textField('Approval reason');
  nights.logic.show = group(
    'any',
    condition(type.id, { kind: 'choice', op: 'equals', value: type.config.options[0]!.id }),
  );
  reason.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 3 }));
  const fields: Field[] = [type, nights, reason];
  return { type, nights, reason, fields, graph: buildDependencyGraph(fields) };
}

const choicesFor = (fields: Field[], owner: Field) =>
  allowedTargets(fields, buildDependencyGraph(fields), owner.id);

describe('allowedTargets', () => {
  it('offers every other field that can be read, in form order, including fields below (Q-4)', () => {
    const { type, nights, reason, fields, graph } = expenseClaim();

    const choices = allowedTargets(fields, graph, nights.id);

    expect(choices.map((choice) => choice.field.id)).toEqual([type.id, reason.id]);
  });

  it('never offers the field itself', () => {
    const { nights, fields, graph } = expenseClaim();

    const choices = allowedTargets(fields, graph, nights.id);

    expect(choices.some((choice) => choice.field.id === nights.id)).toBe(false);
  });

  it('does not offer a section header, which holds no answer', () => {
    const heading = sectionField('Trip details');
    const name = textField('Name');
    const note = textField('Note');

    const choices = choicesFor([heading, name, note], note);

    expect(choices.map((choice) => choice.field.id)).toEqual([name.id]);
  });

  it('describes each target by kind, with a choice’s own options', () => {
    const { type, fields, graph, reason } = expenseClaim();

    const [typeChoice, nightsChoice] = allowedTargets(fields, graph, reason.id);

    expect(typeChoice?.target).toEqual({ kind: 'choice', options: type.config.options });
    expect(nightsChoice?.target).toEqual({ kind: 'number' });
  });

  it('disables a target that already depends on the field, directly or through a chain, with the reason (D-6)', () => {
    const { type, fields, graph } = expenseClaim();

    const choices = allowedTargets(fields, graph, type.id);

    expect(choices.map((choice) => [choice.name, choice.disabledReason])).toEqual([
      ['Field 2, Nights', 'depends on this field'],
      ['Field 3, Approval reason', 'depends on this field'],
    ]);
  });

  it('names fields by their position, with a placeholder while one has no label', () => {
    const unnamed = textField('  ');
    const note = textField('Note');

    expect(choicesFor([unnamed, note], note)[0]?.name).toBe('Field 1 (no label yet)');
  });
});

describe('loopHint', () => {
  it('names the fields that cannot be chosen, and why', () => {
    const { type, fields, graph } = expenseClaim();

    expect(loopHint(allowedTargets(fields, graph, type.id))).toBe(
      'Can’t choose Nights and Approval reason: they already depend on this field, so a condition on them would make a loop.',
    );
  });

  it('uses the singular for one field, and says nothing when every target can be chosen', () => {
    const { nights, reason, fields, graph } = expenseClaim();

    expect(loopHint(allowedTargets(fields, graph, nights.id))).toBe(
      'Can’t choose Approval reason: it already depends on this field, so a condition on it would make a loop.',
    );
    expect(loopHint(allowedTargets(fields, graph, reason.id))).toBeNull();
  });
});

describe('newCondition', () => {
  it('reads the nearest field above by default, unfinished', () => {
    const { type, nights, reason, fields, graph } = expenseClaim();

    const added = newCondition(fields, allowedTargets(fields, graph, reason.id), reason.id);

    expect(added?.targetFieldId).toBe(nights.id);
    expect(added?.predicate).toEqual({ kind: 'number', op: 'equals', value: null });
    expect(newCondition(fields, allowedTargets(fields, graph, nights.id), nights.id)).toMatchObject(
      { targetFieldId: type.id, predicate: { kind: 'choice', op: 'equals', value: null } },
    );
  });

  it('reads the first field below when nothing above can be chosen', () => {
    const { type, fields } = expenseClaim();
    const fresh = textField('Purpose');
    const withFresh = [fresh, ...fields];

    const added = newCondition(
      withFresh,
      allowedTargets(withFresh, buildDependencyGraph(withFresh), fresh.id),
      fresh.id,
    );

    expect(added?.targetFieldId).toBe(type.id);
  });

  it('gives nothing when every other field already depends on this one', () => {
    const { type, fields, graph } = expenseClaim();

    expect(newCondition(fields, allowedTargets(fields, graph, type.id), type.id)).toBeNull();
  });
});

describe('retarget', () => {
  it('keeps the operator and value when the new target is read the same way', () => {
    const first = textField('First');
    const second = textField('Second');
    const note = textField('Note');
    const typed = condition(first.id, { kind: 'text', op: 'contains', value: 'Lyon' });
    const [, secondChoice] = choicesFor([first, second, note], note);

    expect(retarget(typed, secondChoice!)).toEqual({ ...typed, targetFieldId: second.id });
  });

  it('starts the comparison again for a target of another kind', () => {
    const { type, nights, reason, fields, graph } = expenseClaim();
    const [typeChoice] = allowedTargets(fields, graph, reason.id);
    const onNights = condition(nights.id, { kind: 'number', op: 'gt', value: 3 });

    expect(retarget(onNights, typeChoice!)).toEqual({
      id: onNights.id,
      targetFieldId: type.id,
      predicate: { kind: 'choice', op: 'equals', value: null },
    });
  });

  it('starts again between two choice fields, because options belong to their field', () => {
    const a = singleSelectField('A');
    const b = singleSelectField('B');
    const note = textField('Note');
    const onA = condition(a.id, {
      kind: 'choice',
      op: 'notEquals',
      value: a.config.options[0]!.id,
    });
    const [, bChoice] = choicesFor([a, b, note], note);

    expect(retarget(onA, bChoice!).predicate).toEqual({
      kind: 'choice',
      op: 'equals',
      value: null,
    });
  });
});
