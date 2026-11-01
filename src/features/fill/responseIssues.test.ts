import type { FieldId } from '../../domain/ids';
import { evaluateForm } from '../../domain/rules/evaluate';
import type { ResponseValues } from '../../domain/response';
import { condition, group, text, textField } from '../../test/fixtures';
import { responseIssues } from './responseIssues';

const required = (label: string) => {
  const field = textField(label);
  field.logic.defaultRequired = true;
  return field;
};

const issuesFor = (fields: Parameters<typeof evaluateForm>[0], values: ResponseValues = {}) =>
  responseIssues(fields, evaluateForm(fields, values));

describe('responseIssues', () => {
  it('flags an empty required field, phrased for the respondent', () => {
    const name = required('Employee name');

    expect(issuesFor([name]).get(name.id)).toBe('Enter an answer for Employee name');
  });

  it('accepts an empty optional field', () => {
    expect(issuesFor([textField('Notes')]).size).toBe(0);
  });

  it('does not validate a hidden required field', () => {
    const receipt = textField('Do you have a receipt?');
    const reason = required('Why not?');
    reason.logic.hide = group(
      'all',
      condition(receipt.id, { kind: 'text', op: 'equals', value: 'yes' }),
    );

    const issues = issuesFor([receipt, reason], { [receipt.id]: text('Yes') });

    expect(issues.has(reason.id)).toBe(false);
  });

  it('skips a hidden field on its own account, not only because the engine drops its value', () => {
    // The engine never produces this state; it pins this layer's check independently of it.
    const reason = required('Why not?');
    const evaluation = {
      visible: new Set<FieldId>(),
      required: new Set([reason.id]),
      effective: { [reason.id]: text('') },
    };

    expect(responseIssues([reason], evaluation).size).toBe(0);
  });

  it('validates the same field again once it is shown', () => {
    const receipt = textField('Do you have a receipt?');
    const reason = required('Why not?');
    reason.logic.hide = group(
      'all',
      condition(receipt.id, { kind: 'text', op: 'equals', value: 'yes' }),
    );

    expect(issuesFor([receipt, reason], { [receipt.id]: text('No') }).has(reason.id)).toBe(true);
  });

  it('lists problems in form order', () => {
    const first = required('First');
    const second = required('Second');

    expect([...issuesFor([first, second]).keys()]).toEqual([first.id, second.id]);
  });
});
