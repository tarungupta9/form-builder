import { condition, group, numberField, textField, template } from '../../test/fixtures';
import { CONFIG_IDS } from './configIds';
import { DESCRIPTION_MAX_LENGTH, configIssues } from './configIssues';
import { conditionControlId } from './conditions/conditionGroups';

describe('configIssues', () => {
  it('finds nothing to fix in a complete template', () => {
    const issues = configIssues(template([textField('Name')], 'Expense claim'));

    expect(issues.count).toBe(0);
  });

  it('asks for a title when the form has none (D-34)', () => {
    const issues = configIssues(template([], '   '));

    expect(issues.form).toEqual(['Give the form a title.']);
    expect(issues.count).toBe(1);
  });

  it('asks for a label when a field has none (D-35)', () => {
    const unlabelled = textField('');

    const issues = configIssues(template([unlabelled]));

    expect(issues.fields.get(unlabelled.id)).toEqual([
      { message: 'Give this field a label.', controlId: CONFIG_IDS.fieldLabel },
    ]);
  });

  it("includes the field type's own issues, such as a minimum length above the maximum", () => {
    const name = textField('Name', {
      config: { placeholder: '', minLength: 50, maxLength: 40, prefix: '', suffix: '' },
    });

    const issues = configIssues(template([name]));

    // A type's own settings have no fixed control ID, so the issue opens the panel instead.
    expect(issues.fields.get(name.id)).toEqual([
      { message: 'The minimum length is more than the maximum.', controlId: null },
    ]);
    expect(issues.count).toBe(1);
  });

  it('allows a description up to the limit and flags one over it (D-32)', () => {
    const atLimit = { ...template([]), description: 'x'.repeat(DESCRIPTION_MAX_LENGTH) };
    const overLimit = { ...atLimit, description: `${atLimit.description}x` };

    expect(configIssues(atLimit).count).toBe(0);
    expect(configIssues(overLimit).form).toEqual([
      `Keep the description to ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    ]);
  });

  it('includes each unfinished condition, pointing at the control that finishes it', () => {
    const nights = numberField('Nights');
    const reason = textField('Approval reason');
    const unfinished = condition(nights.id, { kind: 'number', op: 'gt', value: null });
    reason.logic.show = group('all', unfinished);

    const issues = configIssues(template([nights, reason]));

    expect(issues.fields.get(reason.id)).toEqual([
      {
        message: 'Show condition 1: enter a number.',
        controlId: conditionControlId(unfinished.id, 'value'),
      },
    ]);
    expect(issues.count).toBe(1);
  });
});
