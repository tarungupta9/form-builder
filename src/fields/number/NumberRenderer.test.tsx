import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NumberConfig } from '../../domain/template';
import { numberField } from '../../test/fixtures';
import { NumberRenderer } from './NumberRenderer';

const renderNumber = (config: Partial<NumberConfig>, onChange = vi.fn()) =>
  render(
    <NumberRenderer
      field={numberField('Amount', config)}
      value={undefined}
      required={false}
      error={null}
      controlId="answer"
      context={{ fields: [] }}
      onChange={onChange}
    />,
  );

describe('Number renderer', () => {
  it('is a text box with a decimal keyboard, so scrolling over it cannot change the value (D-15)', () => {
    renderNumber({ decimals: 2 });

    const box = screen.getByRole('textbox', { name: 'Amount' });
    expect(box).toHaveAttribute('type', 'text');
    expect(box).toHaveAttribute('inputmode', 'decimal');
  });

  it('asks for the numeric keyboard when only whole numbers are allowed', () => {
    renderNumber({ decimals: 0 });

    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveAttribute('inputmode', 'numeric');
  });

  it('describes the box with its limits, precision, prefix and suffix', () => {
    renderNumber({ decimals: 2, min: 0, max: 500, prefix: '$', suffix: 'AUD' });

    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveAccessibleDescription(
      'Up to 2 decimal places, from 0 to 500. $ AUD',
    );
  });

  it('emits exactly what was typed, so a mistake can be reported rather than coerced', async () => {
    const onChange = vi.fn();
    renderNumber({}, onChange);

    await userEvent.type(screen.getByRole('textbox', { name: 'Amount' }), 'e');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'number', input: 'e' });
  });
});
