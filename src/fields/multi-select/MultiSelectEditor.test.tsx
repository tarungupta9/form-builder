import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { FieldOf } from '../../domain/template';
import { multiSelectField } from '../../test/fixtures';
import { LiveRegionProvider } from '../../ui/LiveRegion';
import { MultiSelectEditor } from './MultiSelectEditor';

function Harness() {
  const [field, setField] = useState<FieldOf<'multiSelect'>>(() => multiSelectField());
  return (
    <LiveRegionProvider>
      <MultiSelectEditor field={field} context={{ fields: [field] }} onChange={setField} />
    </LiveRegionProvider>
  );
}

describe('Multi select editor', () => {
  it('shows a maximum of zero as an error on the maximum', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const max = screen.getByRole('textbox', { name: 'Maximum choices' });
    await user.type(max, '0');

    expect(max).toHaveAccessibleDescription('The maximum number of choices must be at least 1.');
  });

  it('shows a minimum above the option count as an error on the minimum', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const min = screen.getByRole('textbox', { name: 'Minimum choices' });
    await user.type(min, '5');

    expect(min).toHaveAccessibleDescription(
      'The minimum number of choices is more than the 4 options available.',
    );
    expect(min).toHaveAttribute('aria-invalid', 'true');
  });
});
