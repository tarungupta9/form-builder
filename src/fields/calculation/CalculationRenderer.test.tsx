import { render, screen } from '@testing-library/react';
import type { NumberValue } from '../../domain/response';
import { calculationField, num, numberField } from '../../test/fixtures';
import { expectNoAxeViolations } from '../../test/axe';
import { CalculationRenderer } from './CalculationRenderer';

const hotel = numberField('Hotel');
const meals = numberField('Meals');
const taxi = numberField('Taxi');
const total = calculationField('Total', [hotel, meals, taxi]);

function renderResult(value: NumberValue | undefined = num('245.5')) {
  return render(
    <CalculationRenderer
      field={total}
      value={value}
      required={false}
      error={null}
      controlId="answer-total"
      context={{ fields: [hotel, meals, taxi, total] }}
      onChange={vi.fn()}
    />,
  );
}

describe('Calculation renderer', () => {
  it('shows the result in a read-only output named by its label, with nothing to type into', () => {
    renderResult();

    const output = screen.getByRole('status', { name: 'Total' });
    expect(output.tagName).toBe('OUTPUT');
    expect(output).toHaveTextContent('245.50');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('names its aggregation and its sources', () => {
    renderResult();

    expect(screen.getByRole('status', { name: 'Total' })).toHaveAccessibleDescription(
      'Sum of Hotel, Meals and Taxi. Empty and hidden answers are left out.',
    );
  });

  it('shows "—" when there is nothing to calculate, and says so to a screen reader', () => {
    renderResult({ kind: 'number', input: '' });

    const output = screen.getByRole('status', { name: 'Total' });
    expect(output).toHaveTextContent('—');
    expect(output).toHaveTextContent('Nothing to calculate yet');
  });

  it('does not speak every change as the respondent types', () => {
    renderResult();
    expect(screen.getByRole('status', { name: 'Total' })).toHaveAttribute('aria-live', 'off');
  });

  it('has no axe violations', async () => {
    const { container } = renderResult();
    await expectNoAxeViolations(container);
  });
});
