import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Field, FieldOf } from '../../domain/template';
import { calculationField, numberField, sectionField, textField } from '../../test/fixtures';
import { CalculationEditor } from './CalculationEditor';

const hotel = numberField('Hotel');
const meals = numberField('Meals');
const subtotal = calculationField('Subtotal', [hotel]);

function Harness({
  others,
  onChange,
}: {
  others: Field[];
  onChange?: (field: FieldOf<'calculation'>) => void;
}) {
  const [field, setField] = useState(() => calculationField('Total'));
  return (
    <CalculationEditor
      field={field}
      context={{ fields: [...others, field] }}
      onChange={(next) => {
        setField(next);
        onChange?.(next);
      }}
    />
  );
}

const lastConfig = (onChange: ReturnType<typeof vi.fn<(field: FieldOf<'calculation'>) => void>>) =>
  onChange.mock.lastCall?.[0].config;

const sources = () => within(screen.getByRole('group', { name: 'Calculate from' }));

describe('Calculation editor', () => {
  it('offers Number fields only: never another calculation, a text field or a heading', () => {
    render(
      <Harness others={[textField('Notes'), hotel, subtotal, sectionField('Costs'), meals]} />,
    );

    const offered = sources()
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent);
    expect(offered).toEqual(['Hotel', 'Meals']);
  });

  it('keeps the chosen sources in form order, whatever order they were ticked in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(field: FieldOf<'calculation'>) => void>();
    render(<Harness others={[hotel, meals]} onChange={onChange} />);

    await user.click(sources().getByRole('checkbox', { name: 'Meals' }));
    await user.click(sources().getByRole('checkbox', { name: 'Hotel' }));

    expect(lastConfig(onChange)?.sourceFieldIds).toEqual([hotel.id, meals.id]);
  });

  it('says a source is needed until one is chosen', async () => {
    const user = userEvent.setup();
    render(<Harness others={[hotel]} />);

    expect(screen.getByText('Choose at least one Number field to calculate from.')).toBeVisible();
    await user.click(sources().getByRole('checkbox', { name: 'Hotel' }));
    expect(
      screen.queryByText('Choose at least one Number field to calculate from.'),
    ).not.toBeInTheDocument();
  });

  it('explains that a Number field is needed when the form has none', () => {
    render(<Harness others={[textField('Notes')]} />);

    expect(sources().queryAllByRole('checkbox')).toEqual([]);
    expect(screen.getByText(/Add a Number field to the form first/)).toBeVisible();
  });

  it('changes the aggregation and the decimal places', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(field: FieldOf<'calculation'>) => void>();
    render(<Harness others={[hotel]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Calculation'), 'Average');
    await user.selectOptions(screen.getByLabelText('Decimal places'), 'None');

    expect(lastConfig(onChange)).toMatchObject({ aggregation: 'average', decimals: 0 });
  });
});
