import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { DateValue } from '../../domain/response';
import { date, dateField, isoDate } from '../../test/fixtures';
import { DateRenderer } from './DateRenderer';

const longDate = (year: number, month: number, day: number) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(year, month - 1, day));

const travel = dateField('Date of travel', {
  minDate: isoDate('2026-11-01'),
  maxDate: isoDate('2026-11-30'),
});

describe('Date renderer', () => {
  it('is a labelled native date input bounded by the allowed dates, which the hint names', () => {
    render(
      <DateRenderer
        field={travel}
        value={undefined}
        required={false}
        error={null}
        controlId="answer"
        context={{ fields: [] }}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Date of travel');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-11-01');
    expect(input).toHaveAttribute('max', '2026-11-30');
    expect(input).toHaveAccessibleDescription(
      `Between ${longDate(2026, 11, 1)} and ${longDate(2026, 11, 30)}.`,
    );
  });

  it('emits the chosen calendar date, and no date when cleared', () => {
    const onChange = vi.fn();
    render(
      <DateRenderer
        field={travel}
        value={date('2026-11-05')}
        required={false}
        error={null}
        controlId="answer"
        context={{ fields: [] }}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Date of travel');

    fireEvent.change(input, { target: { value: '2026-11-12' } });
    expect(onChange).toHaveBeenLastCalledWith(date('2026-11-12'));

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'date', value: null });
  });

  it('keeps a date while its year is typed digit by digit, instead of wiping it', () => {
    // The Fill form owns the value; this stands in for it so the input stays controlled.
    function Controlled() {
      const [value, setValue] = useState<DateValue | undefined>(undefined);
      return (
        <DateRenderer
          field={dateField('Date of birth')}
          value={value}
          required={false}
          error={null}
          controlId="answer"
          context={{ fields: [] }}
          onChange={setValue}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByLabelText('Date of birth');

    // Chrome's value after the first year digit of 15/03/2026.
    fireEvent.change(input, { target: { value: '0002-03-15' } });
    expect(input).toHaveValue('0002-03-15');

    fireEvent.change(input, { target: { value: '2026-03-15' } });
    expect(input).toHaveValue('2026-03-15');
  });
});
