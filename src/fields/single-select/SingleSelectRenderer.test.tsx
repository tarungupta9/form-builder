import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ChoiceValue } from '../../domain/response';
import type { SingleSelectDisplay } from '../../domain/template';
import { expectNoAxeViolations } from '../../test/axe';
import { choice, singleSelectField } from '../../test/fixtures';
import { SingleSelectRenderer } from './SingleSelectRenderer';

const fieldShownAs = (display: SingleSelectDisplay) => {
  const field = singleSelectField('Payment method');
  return { ...field, config: { ...field.config, display } };
};

interface HarnessProps {
  display: SingleSelectDisplay;
  required?: boolean;
  error?: string | null;
  onChange?: (value: ChoiceValue) => void;
}

/** The renderer with its value held in state, the way Fill mode holds it. */
function Harness({ display, required = false, error = null, onChange }: HarnessProps) {
  const [field] = useState(() => fieldShownAs(display));
  const [value, setValue] = useState<ChoiceValue>();
  return (
    <SingleSelectRenderer
      field={field}
      value={value}
      required={required}
      error={error}
      controlId="answer-payment"
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('Single select renderer', () => {
  it.each(['radio', 'tiles'] as const)(
    'shows %s as a group of native radios named by the legend',
    async (display) => {
      const { container } = render(<Harness display={display} />);

      const group = screen.getByRole('group', { name: 'Payment method' });
      expect(within(group).getAllByRole('radio')).toHaveLength(3);
      expect(within(group).getByRole('radio', { name: 'Cash' })).not.toBeChecked();
      await expectNoAxeViolations(container);
    },
  );

  it('emits the chosen option’s ID when a radio is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness display="tiles" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Cash' }));

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'choice',
      value: screen.getByRole('radio', { name: 'Cash' }).getAttribute('value'),
    });
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked();
  });

  it('shows the dropdown as a native select that starts on an empty "Choose an option"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Harness display="dropdown" required onChange={onChange} />);

    const select = screen.getByRole('combobox', { name: /Payment method/ });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose an option', 'Card', 'Cash', 'Invoice']);
    expect(select).toHaveValue('');
    await expectNoAxeViolations(container);

    await user.selectOptions(select, 'Invoice');
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'choice',
      value: within(select).getByRole('option', { name: 'Invoice' }).getAttribute('value'),
    });

    // The empty option stays selectable even when required, and choosing it means no answer.
    await user.selectOptions(select, 'Choose an option');
    expect(onChange).toHaveBeenLastCalledWith(choice(null));
  });

  it.each(['radio', 'dropdown', 'tiles'] as const)(
    'marks every %s control required, and describes the error where the role allows',
    (display) => {
      render(<Harness display={display} required error="Choose an option for Payment method" />);

      const controls =
        display === 'dropdown' ? [screen.getByRole('combobox')] : screen.getAllByRole('radio');
      for (const control of controls) expect(control).toBeRequired();
      // ARIA has no invalid state on a single radio, so the radio looks carry it on the group,
      // as its description; the select carries both.
      if (display === 'dropdown') {
        expect(controls[0]).toHaveAttribute('aria-invalid', 'true');
        expect(controls[0]).toHaveAccessibleDescription(
          'Error: Choose an option for Payment method',
        );
      } else {
        for (const control of controls) expect(control).not.toHaveAttribute('aria-invalid');
        expect(screen.getByRole('group')).toHaveAccessibleDescription(
          'Error: Choose an option for Payment method',
        );
      }
    },
  );

  describe('Clear answer (optional radio and tiles)', () => {
    it.each(['radio', 'tiles'] as const)(
      'clears the %s choice and moves focus to the first option',
      async (display) => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness display={display} onChange={onChange} />);
        expect(screen.queryByRole('button', { name: 'Clear answer' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'Invoice' }));
        await user.click(screen.getByRole('button', { name: 'Clear answer' }));

        expect(onChange).toHaveBeenLastCalledWith(choice(null));
        expect(screen.queryByRole('button', { name: 'Clear answer' })).not.toBeInTheDocument();
        for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
        expect(screen.getByRole('radio', { name: 'Card' })).toHaveFocus();
      },
    );

    it('is not offered on a required field, which must keep an answer', async () => {
      const user = userEvent.setup();
      render(<Harness display="radio" required />);

      await user.click(screen.getByRole('radio', { name: 'Cash' }));

      expect(screen.queryByRole('button', { name: 'Clear answer' })).not.toBeInTheDocument();
    });
  });
});
