import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Option } from '../../domain/template';
import { expectNoAxeViolations } from '../../test/axe';
import { options } from '../../test/fixtures';
import { LiveRegionProvider } from '../../ui/LiveRegion';
import { OptionsEditor } from './OptionsEditor';

let latest: Option[] = [];

function Harness({ initial }: { initial: Option[] }) {
  const [current, setCurrent] = useState(initial);
  latest = current;
  return (
    <LiveRegionProvider>
      <OptionsEditor options={current} onChange={setCurrent} />
    </LiveRegionProvider>
  );
}

const setup = (...labels: string[]) => {
  const initial = options(...labels);
  const user = userEvent.setup();
  const view = render(<Harness initial={initial} />);
  return { user, initial, ...view };
};

const labelBox = (position: number) =>
  screen.getByRole('textbox', { name: `Option ${position} label` });
const labels = () => latest.map((option) => option.label);
const expectAnnounced = (message: string) =>
  waitFor(() => {
    expect(screen.getByTestId('live-region')).toHaveTextContent(message);
  });

describe('Options editor', () => {
  it('lists each option as a labelled box inside an "Options" group', async () => {
    const { container } = setup('Card', 'Cash');

    const group = screen.getByRole('group', { name: 'Options' });
    expect(
      within(group)
        .getAllByRole('textbox')
        .map((box) => (box as HTMLInputElement).value),
    ).toEqual(['Card', 'Cash']);
    await expectNoAxeViolations(container);
  });

  it('renames an option in place, keeping its ID (D-11)', async () => {
    const { user, initial } = setup('Card', 'Cash');

    await user.clear(labelBox(2));
    await user.type(labelBox(2), 'Coins');

    expect(latest).toEqual([initial[0], { id: initial[1]!.id, label: 'Coins' }]);
  });

  describe('adding', () => {
    it('adds a named option, focuses it and announces it', async () => {
      const { user } = setup('Option 1', 'Option 2');

      await user.click(screen.getByRole('button', { name: 'Add option' }));

      expect(labels()).toEqual(['Option 1', 'Option 2', 'Option 3']);
      await waitFor(() => {
        expect(labelBox(3)).toHaveFocus();
      });
      await expectAnnounced('Option 3 added');
    });

    it('never gives a new option a name another option already has', async () => {
      const { user } = setup('Option 1', 'Option 2');

      await user.click(screen.getByRole('button', { name: 'Remove Option 1' }));
      await user.click(screen.getByRole('button', { name: 'Add option' }));

      expect(labels()).toEqual(['Option 2', 'Option 3']);
      expect(screen.queryByText('Option labels must be different from each other.')).toBeNull();
    });
  });

  describe('removing', () => {
    it('removes an option, moves focus to the next one and announces it', async () => {
      const { user } = setup('Card', 'Cash', 'Invoice');

      await user.click(screen.getByRole('button', { name: 'Remove Cash' }));

      expect(labels()).toEqual(['Card', 'Invoice']);
      await waitFor(() => {
        expect(labelBox(2)).toHaveValue('Invoice');
      });
      expect(labelBox(2)).toHaveFocus();
      await expectAnnounced('Cash removed');
    });

    it('moves focus to the previous option when the last one is removed', async () => {
      const { user } = setup('Card', 'Cash');

      await user.click(screen.getByRole('button', { name: 'Remove Cash' }));

      await waitFor(() => {
        expect(labelBox(1)).toHaveFocus();
      });
    });

    it('cannot remove the only option', () => {
      setup('I confirm');

      expect(screen.getByRole('button', { name: 'Remove I confirm' })).toBeDisabled();
    });
  });

  describe('reordering', () => {
    it('disables moving the first option up and the last option down', () => {
      setup('Card', 'Cash', 'Invoice');

      expect(screen.getByRole('button', { name: 'Move Card up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move Card down' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Move Invoice up' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Move Invoice down' })).toBeDisabled();
    });

    it('moves an option down, keeps focus on its button and announces the new position', async () => {
      const { user, initial } = setup('Card', 'Cash', 'Invoice');

      await user.click(screen.getByRole('button', { name: 'Move Card down' }));

      expect(latest.map((option) => option.id)).toEqual([
        initial[1]!.id,
        initial[0]!.id,
        initial[2]!.id,
      ]);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Move Card down' })).toHaveFocus();
      });
      await expectAnnounced('Card moved to position 2 of 3');
    });

    it('moves focus to the other move button once an option reaches the end', async () => {
      const { user } = setup('Card', 'Cash', 'Invoice');

      await user.click(screen.getByRole('button', { name: 'Move Cash up' }));

      expect(labels()).toEqual(['Cash', 'Card', 'Invoice']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Move Cash down' })).toHaveFocus();
      });
      await expectAnnounced('Cash moved to position 1 of 3');
    });
  });

  describe('problems', () => {
    it('describes the group with the problem and marks the clashing boxes invalid', async () => {
      const { user } = setup('Card', 'Cash');

      await user.clear(labelBox(2));
      await user.type(labelBox(2), 'card');

      expect(screen.getByRole('group', { name: 'Options' })).toHaveAccessibleDescription(
        'Option labels must be different from each other.',
      );
      expect(labelBox(1)).toHaveAttribute('aria-invalid', 'true');
      expect(labelBox(2)).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks an emptied box invalid, and only that one', async () => {
      const { user } = setup('Card', 'Cash');

      await user.clear(labelBox(1));

      expect(labelBox(1)).toHaveAttribute('aria-invalid', 'true');
      expect(labelBox(1)).toHaveAccessibleDescription('Give every option a label.');
      expect(labelBox(2)).toHaveAttribute('aria-invalid', 'false');
    });
  });
});
