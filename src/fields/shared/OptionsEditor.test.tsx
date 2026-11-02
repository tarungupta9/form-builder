import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { OptionId } from '../../domain/ids';
import type { Dependant } from '../../domain/rules/references';
import type { Option } from '../../domain/template';
import { expectNoAxeViolations } from '../../test/axe';
import { options, textField } from '../../test/fixtures';
import { LiveRegionProvider } from '../../ui/LiveRegion';
import { OptionsEditor } from './OptionsEditor';

let latest: Option[] = [];

type UsedBy = (optionId: OptionId) => readonly Dependant[];
const unused: UsedBy = () => [];

function Harness({ initial, usedBy }: { initial: Option[]; usedBy: UsedBy }) {
  const [current, setCurrent] = useState(initial);
  latest = current;
  return (
    <LiveRegionProvider>
      <OptionsEditor options={current} usedBy={usedBy} onChange={setCurrent} />
    </LiveRegionProvider>
  );
}

const setupUsed = (usedBy: (initial: Option[]) => UsedBy, ...labels: string[]) => {
  const initial = options(...labels);
  const user = userEvent.setup();
  const view = render(<Harness initial={initial} usedBy={usedBy(initial)} />);
  return { user, initial, ...view };
};

const setup = (...labels: string[]) => setupUsed(() => unused, ...labels);

/** Card, Cash and Invoice, where a required condition on Receipt number compares with Cash. */
function cashInUse() {
  const receipt = textField('Receipt number');
  return setupUsed(
    ([, cash]) =>
      (optionId) =>
        optionId === cash!.id ? [{ field: receipt, reads: [{ effect: 'require', count: 1 }] }] : [],
    'Card',
    'Cash',
    'Invoice',
  );
}

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

    it('asks before removing an option a condition compares with, naming the field', async () => {
      const { user } = cashInUse();

      await user.click(screen.getByRole('button', { name: 'Remove Cash' }));

      const dialog = screen.getByRole('dialog', { name: 'Remove Cash?' });
      expect(within(dialog).getByRole('listitem')).toHaveTextContent(
        'Receipt number: 1 required condition',
      );
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      expect(labels()).toEqual(['Card', 'Cash', 'Invoice']);
    });

    it('keeps the option and returns focus to its Remove button on Cancel or Escape', async () => {
      const { user } = cashInUse();
      const remove = screen.getByRole('button', { name: 'Remove Cash' });

      await user.click(remove);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(remove).toHaveFocus();

      await user.click(remove);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(remove).toHaveFocus();
      expect(labels()).toEqual(['Card', 'Cash', 'Invoice']);
    });

    it('removes the option on confirm, focuses the next option and announces what went with it', async () => {
      const { user } = cashInUse();

      await user.click(screen.getByRole('button', { name: 'Remove Cash' }));
      await user.click(screen.getByRole('button', { name: 'Remove option and conditions' }));

      expect(labels()).toEqual(['Card', 'Invoice']);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(labelBox(2)).toHaveFocus();
      await expectAnnounced('Cash removed, and 1 condition on Receipt number.');
    });

    it('removes an option nothing compares with without asking', async () => {
      const { user } = cashInUse();

      await user.click(screen.getByRole('button', { name: 'Remove Invoice' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(labels()).toEqual(['Card', 'Cash']);
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
