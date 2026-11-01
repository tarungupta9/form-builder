/**
 * The v0.4 demo script (docs/implementation-plan.md), run end to end through the real app:
 * one field of each new type built in the builder, filled with invalid then valid answers,
 * submitted and exported. jsdom cannot print, so `printDocument` is mocked and the export it
 * is handed is checked instead. Manual only: the printed PDF, keyboard use of the native date
 * picker, and VoiceOver.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ExportDocument } from '../../features/export/exportModel';
import { printDocument } from '../../features/export/printDocument';
import { ResponseDocument } from '../../features/export/ResponseDocument';
import { createRepositories } from '../../storage/repositories';
import { dateField, template } from '../fixtures';
import { renderApp } from '../renderApp';

vi.mock('../../features/export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);
const printed = (): ExportDocument => print.mock.lastCall![0];

const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);

const longDate = (year: number, month: number, day: number) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(year, month - 1, day));

/** Adds a field from the palette and gives it a label; the new field is selected. */
async function addField(user: UserEvent, type: string, label: string) {
  await user.click(screen.getByRole('button', { name: `Add ${type}` }));
  await user.type(screen.getByRole('textbox', { name: 'Label' }), label);
}

describe('v0.4 demo: long text, number, date and section header', () => {
  beforeEach(() => {
    print.mockResolvedValue();
  });

  it('builds one of each type, rejects invalid answers, submits, and exports each one', async () => {
    const { user } = renderApp('/templates/new');
    await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
    const details = within(screen.getByRole('dialog', { name: 'Title and description' }));
    await user.type(details.getByRole('textbox', { name: 'Title' }), 'Travel claim');
    await user.click(details.getByRole('button', { name: 'Done' }));

    // Build: a section header (which has no Required switch), then one field of each input type.
    await addField(user, 'Section header', 'Trip details');
    expect(screen.queryByRole('switch', { name: 'Required' })).not.toBeInTheDocument();

    await addField(user, 'Short text', 'Employee name');

    await addField(user, 'Long text', 'Purpose');
    await user.click(screen.getByRole('switch', { name: 'Required' }));

    await addField(user, 'Number', 'Amount');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Decimal places' }), '2');
    await user.type(screen.getByRole('textbox', { name: /^Prefix/ }), '$');

    await addField(user, 'Date', 'Date of travel');
    fireEvent.change(screen.getByLabelText('Earliest date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Latest date'), { target: { value: '2026-11-30' } });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    // The card counts every field, the section header included (D-19).
    await user.click(screen.getByRole('link', { name: 'All templates' }));
    expect(await card('Travel claim').findByText('5 fields')).toBeInTheDocument();

    // Fill in invalid answers: too many decimals, a date out of range.
    await user.click(card('Travel claim').getByRole('link', { name: /^New response/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Trip details' })).toBeVisible();
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    await user.type(amount, '12.505');
    const travelDate = screen.getByLabelText('Date of travel');
    fireEvent.change(travelDate, { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    const summary = within(await screen.findByRole('alert'));
    expect(summary.getByRole('button', { name: 'Enter an answer for Purpose' })).toBeVisible();
    expect(
      summary.getByRole('button', { name: 'Use up to 2 decimal places for Amount' }),
    ).toBeVisible();
    expect(
      summary.getByRole('button', {
        name: `Date of travel must be on or before ${longDate(2026, 11, 30)}`,
      }),
    ).toBeVisible();

    // Fix them: each error clears as it is fixed, then the response submits.
    await user.type(
      screen.getByRole('textbox', { name: /Purpose/ }),
      'Client visit{Enter}Two days',
    );
    await user.clear(amount);
    await user.type(amount, '1234.5');
    fireEvent.change(travelDate, { target: { value: '2026-11-12' } });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toHaveFocus();

    // The export: the section as a heading, line breaks kept, the number with its prefix and
    // decimals, the date in the long local format, and the unanswered field marked so.
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    const amountText = `$${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(1234.5)}`;
    expect(printed().blocks).toEqual([
      { kind: 'section', text: 'Trip details', level: 2 },
      { kind: 'answer', label: 'Employee name', value: { kind: 'empty' } },
      { kind: 'answer', label: 'Purpose', value: { kind: 'text', text: 'Client visit\nTwo days' } },
      { kind: 'answer', label: 'Amount', value: { kind: 'text', text: amountText } },
      {
        kind: 'answer',
        label: 'Date of travel',
        value: { kind: 'text', text: longDate(2026, 11, 12) },
      },
    ]);
    const pdf = within(render(<ResponseDocument document={printed()} />).container);
    expect(pdf.getByRole('heading', { level: 2, name: 'Trip details' })).toBeVisible();
  });

  describe('pre-filling today', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });

    it('uses the local date just after midnight, not the UTC date (D-16)', async () => {
      // 00:05 on 1 November in Auckland (UTC+13) is still 31 October in UTC, so
      // `toISOString().slice(0, 10)` would pre-fill the wrong day.
      vi.stubEnv('TZ', 'Pacific/Auckland');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-31T11:05:00Z'));
      const form = template([dateField('Date of travel', { prefillToday: true })], 'Day trip');
      createRepositories(localStorage).templates.put(form);

      renderApp(`/templates/${form.id}/respond`);

      expect(await screen.findByLabelText('Date of travel')).toHaveValue('2026-11-01');
    });
  });
});
