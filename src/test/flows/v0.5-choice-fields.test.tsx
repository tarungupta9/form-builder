/**
 * The v0.5 demo script (docs/implementation-plan.md), run end to end through the real app: the
 * same single select built once per display plus a multi select, submitted empty and then
 * answered, then an option renamed while the earlier response keeps its old label.
 *
 * jsdom cannot print, so `printDocument` is mocked and the model it is handed is checked.
 * Manual only: arrow keys inside the radio and tile groups (browser behaviour jsdom does not
 * simulate), VoiceOver, and the printed PDF itself.
 */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ExportDocument } from '../../features/export/exportModel';
import { printDocument } from '../../features/export/printDocument';
import { renderApp } from '../renderApp';

vi.mock('../../features/export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);
const printed = (): ExportDocument => print.mock.lastCall![0];

const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);

async function setTitle(user: UserEvent, title: string) {
  await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Title and description' }));
  await user.clear(dialog.getByRole('textbox', { name: 'Title' }));
  await user.type(dialog.getByRole('textbox', { name: 'Title' }), title);
  await user.click(dialog.getByRole('button', { name: 'Done' }));
}

/** Adds a field from the palette, names it and makes it required. */
async function addRequired(user: UserEvent, type: string, label: string) {
  await user.click(screen.getByRole('button', { name: `Add ${type}` }));
  await user.type(screen.getByRole('textbox', { name: 'Label' }), label);
  await user.click(screen.getByRole('switch', { name: 'Required' }));
}

async function save(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(/Last saved/);
}

describe('v0.5 demo: choice fields', () => {
  beforeEach(() => {
    print.mockResolvedValue();
  });

  // About 3 s alone, the longest flow (five fields built by keystroke); 5 s ran out once at load 51.
  it(
    'builds one single select per display and a multi select, fills them in, and keeps old labels after a rename',
    { timeout: 10_000 },
    async () => {
      const { user, unmount } = await renderApp('/templates/new');

      // Build: the same single select three times, once per display, and a multi select.
      await setTitle(user, 'Expense claim');
      await addRequired(user, 'Single select', 'Paid by radio');
      await addRequired(user, 'Single select', 'Paid by dropdown');
      await user.click(screen.getByRole('radio', { name: 'Dropdown' }));
      await addRequired(user, 'Single select', 'Paid by tiles');
      await user.click(screen.getByRole('radio', { name: 'Tiles' }));
      await addRequired(user, 'Multi select', 'Expense types');
      await user.type(screen.getByRole('textbox', { name: 'Minimum choices' }), '2');
      expect(canvas().getByRole('button', { name: /^Paid by tiles/ })).toHaveTextContent(
        'Single select as tiles, 2 options',
      );
      await save(user);

      // A full refresh keeps everything; the card counts the four fields.
      unmount();
      const { user: respondent } = await renderApp('/');
      expect(await card('Expense claim').findByText('4 fields')).toBeInTheDocument();
      await respondent.click(card('Expense claim').getByRole('link', { name: /^New response/ }));

      // Submit empty: the three single selects report the same message, the multi select its minimum.
      await respondent.click(await screen.findByRole('button', { name: 'Submit response' }));
      const summary = await screen.findByRole('alert');
      expect(
        within(summary)
          .getAllByRole('button')
          .map((link) => link.textContent),
      ).toEqual([
        'Choose an option for Paid by radio',
        'Choose an option for Paid by dropdown',
        'Choose an option for Paid by tiles',
        'Choose at least 2 options for Expense types',
      ]);

      // Answer by role, the way a keyboard or screen-reader user finds each control.
      const radios = within(screen.getByRole('group', { name: /Paid by radio/ }));
      await respondent.click(radios.getByRole('radio', { name: 'Option 2' }));
      await respondent.selectOptions(
        screen.getByRole('combobox', { name: /Paid by dropdown/ }),
        'Option 1',
      );
      const tiles = within(screen.getByRole('group', { name: /Paid by tiles/ }));
      await respondent.click(tiles.getByRole('radio', { name: 'Option 2' }));
      const types = within(screen.getByRole('group', { name: /Expense types/ }));
      await respondent.click(types.getByRole('checkbox', { name: 'Option 2' }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Choose at least 2 options for Expense types',
      );
      await respondent.click(types.getByRole('checkbox', { name: 'Option 1' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await respondent.click(screen.getByRole('button', { name: 'Submit response' }));
      await screen.findByRole('heading', { name: 'Response submitted' });
      await respondent.click(screen.getByRole('button', { name: 'Download PDF' }));
      const answered = {
        title: 'Expense claim',
        blocks: [
          { label: 'Paid by radio', value: { kind: 'text', text: 'Option 2' } },
          { label: 'Paid by dropdown', value: { kind: 'text', text: 'Option 1' } },
          { label: 'Paid by tiles', value: { kind: 'text', text: 'Option 2' } },
          // In option order, although Option 2 was ticked first.
          { label: 'Expense types', value: { kind: 'list', items: ['Option 1', 'Option 2'] } },
        ],
      };
      expect(printed()).toMatchObject(answered);

      // Rename the radio field's chosen option and save.
      await respondent.click(screen.getByRole('link', { name: 'All templates' }));
      await respondent.click(
        await card('Expense claim').findByRole('link', { name: /^Open in builder/ }),
      );
      await respondent.click(await canvas().findByRole('button', { name: /^Paid by radio/ }));
      const option2 = screen.getByRole('textbox', { name: 'Option 2 label' });
      await respondent.clear(option2);
      await respondent.type(option2, 'Company card');
      await save(respondent);

      // Re-download the earlier response: it keeps the label it was answered with (D-10).
      await respondent.click(screen.getByRole('link', { name: 'All templates' }));
      await respondent.click(
        await card('Expense claim').findByRole('link', { name: /^View responses/ }),
      );
      const row = within(await screen.findByRole('list', { name: '1 submitted response' }));
      print.mockClear();
      await respondent.click(row.getByRole('button', { name: /^Re-download PDF/ }));
      await waitFor(() => {
        expect(print).toHaveBeenCalledTimes(1);
      });
      expect(printed()).toMatchObject(answered);

      // A new response shows the new label.
      await respondent.click(screen.getByRole('link', { name: 'All templates' }));
      await respondent.click(
        await card('Expense claim').findByRole('link', { name: /^New response/ }),
      );
      const renamed = within(await screen.findByRole('group', { name: /Paid by radio/ }));
      expect(renamed.getByRole('radio', { name: 'Company card' })).toBeInTheDocument();
    },
  );
});
