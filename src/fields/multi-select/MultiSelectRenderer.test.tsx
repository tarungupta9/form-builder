import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MultiValue } from '../../domain/response';
import type { MultiSelectConfig } from '../../domain/template';
import { expectNoAxeViolations } from '../../test/axe';
import { multi, multiSelectField, options } from '../../test/fixtures';
import { MultiSelectRenderer } from './MultiSelectRenderer';

const fieldWith = (limits: Pick<MultiSelectConfig, 'minSelections' | 'maxSelections'> = {}) =>
  multiSelectField('Expense types', {
    config: { options: options('Travel', 'Meals', 'Lodging'), ...limits },
  });

function Harness({
  field,
  error = null,
  onChange,
}: {
  field: ReturnType<typeof fieldWith>;
  error?: string | null;
  onChange?: (value: MultiValue) => void;
}) {
  const [value, setValue] = useState<MultiValue>();
  return (
    <MultiSelectRenderer
      field={field}
      value={value}
      required={false}
      error={error}
      controlId="answer-types"
      context={{ fields: [] }}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('Multi select renderer', () => {
  it('shows a group of checkboxes named by its legend', async () => {
    const { container } = render(<Harness field={fieldWith()} />);

    const group = screen.getByRole('group', { name: 'Expense types' });
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('id')),
    ).toEqual(['answer-types', null, null]);
    await expectNoAxeViolations(container);
  });

  it('emits the ticked IDs in option order, whatever order they were ticked in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const field = fieldWith();
    const [travel, meals, lodging] = field.config.options.map((option) => option.id);
    render(<Harness field={field} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Lodging' }));
    await user.click(screen.getByRole('checkbox', { name: 'Travel' }));
    expect(onChange).toHaveBeenLastCalledWith(multi(travel!, lodging!));

    await user.click(screen.getByRole('checkbox', { name: 'Meals' }));
    await user.click(screen.getByRole('checkbox', { name: 'Travel' }));
    expect(onChange).toHaveBeenLastCalledWith(multi(meals!, lodging!));
  });

  it.each([
    [{ minSelections: 1, maxSelections: 2 }, 'Choose between 1 and 2 options.'],
    [{ minSelections: 2, maxSelections: 2 }, 'Choose 2 options.'],
    [{ minSelections: 2 }, 'Choose at least 2 options.'],
    [{ maxSelections: 5 }, 'Choose up to 5 options.'],
    [{ minSelections: 0 }, null],
  ] as const)('describes the limits %o to the respondent', (limits, hint) => {
    render(<Harness field={fieldWith(limits)} />);

    const group = screen.getByRole('group', { name: 'Expense types' });
    if (hint) expect(group).toHaveAccessibleDescription(hint);
    else expect(group).not.toHaveAccessibleDescription();
  });

  it('marks every checkbox invalid while there is an error, without making any required', () => {
    render(<Harness field={fieldWith()} error="Choose at least one option for Expense types" />);

    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).toHaveAttribute('aria-invalid', 'true');
      expect(box).not.toBeRequired();
    }
    expect(screen.getByRole('group')).toHaveAccessibleDescription(
      /Choose at least one option for Expense types/,
    );
  });
});
