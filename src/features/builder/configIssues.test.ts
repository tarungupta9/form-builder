import { textField, template } from '../../test/fixtures';
import { DESCRIPTION_MAX_LENGTH, configIssues } from './configIssues';

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

    expect(issues.fields.get(unlabelled.id)).toEqual(['Give this field a label.']);
  });

  it("includes the field type's own issues, such as a minimum length above the maximum", () => {
    const name = textField('Name', {
      config: { placeholder: '', minLength: 50, maxLength: 40, prefix: '', suffix: '' },
    });

    const issues = configIssues(template([name]));

    expect(issues.fields.get(name.id)).toEqual(['The minimum length is more than the maximum.']);
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
});
