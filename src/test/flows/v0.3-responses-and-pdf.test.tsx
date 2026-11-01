/**
 * The v0.3 demo script (docs/implementation-plan.md), steps 1 to 3, run end to end through the
 * real app. jsdom cannot print, so `printDocument` is mocked and the document it is handed is
 * rendered on its own, the way the print frame renders it. Manual only: the printed PDF itself
 * (page numbers, the Save dialog's file name), Safari (step 4) and VoiceOver.
 */
import { render, screen, within } from '@testing-library/react';
import type { ExportDocument } from '../../features/export/exportModel';
import { printDocument } from '../../features/export/printDocument';
import { ResponseDocument } from '../../features/export/ResponseDocument';
import { toIsoDateTime } from '../../domain/ids';
import { createRepositories } from '../../storage/repositories';
import { formatDateTime } from '../../ui/format';
import { template, textField } from '../fixtures';
import { renderApp } from '../renderApp';

vi.mock('../../features/export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);

/** The document most recently handed to the print dialog. */
const printed = (): ExportDocument => print.mock.lastCall![0];

describe('v0.3 demo: responses and PDF', () => {
  beforeEach(() => {
    // Only `Date` is faked, so user-event and React's own timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    print.mockResolvedValue();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists two responses newest first, downloads one, and re-downloads the older with its old label', async () => {
    const name = textField('Employee name');
    name.logic.defaultRequired = true;
    const claim = {
      ...template([name, textField('Notes')], 'Expense claim'),
      description: 'Travel and meals only.',
    };
    createRepositories(localStorage).templates.put(claim);
    const { user } = renderApp('/');

    // 1. Submit two responses, the second with the optional Notes left empty.
    const firstSubmittedAt = new Date('2026-11-01T09:00:00Z');
    vi.setSystemTime(firstSubmittedAt);
    await user.click(await card('Expense claim').findByRole('link', { name: /^New response/ }));
    await user.type(await screen.findByRole('textbox', { name: /Employee name/ }), 'Ada Lovelace');
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Conference in Paris');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await user.click(await screen.findByRole('button', { name: 'Fill in another response' }));

    vi.setSystemTime(new Date('2026-11-01T14:30:00Z'));
    await user.type(screen.getByRole('textbox', { name: /Employee name/ }), 'Grace Hopper');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toHaveFocus();

    // 2. Download PDF from the confirmation: the header and answers, the empty one "Not answered".
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    const latest = printed();
    const pdf = within(render(<ResponseDocument document={latest} />).container);
    expect(pdf.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible();
    expect(pdf.getByText('Travel and meals only.')).toBeVisible();
    expect(pdf.getByText('Submitted')).toBeVisible();
    expect(pdf.getByText(latest.responseId)).toBeVisible();
    const answers = pdf.getAllByRole('definition').slice(2); // After Submitted and Response ID.
    expect(answers.map((answer) => answer.textContent)).toEqual(['Grace Hopper', 'Not answered']);

    // Open the responses: two rows, newest first, with their timestamps.
    await user.click(screen.getByRole('link', { name: 'View all responses' }));
    const list = within(await screen.findByRole('list', { name: '2 submitted responses' }));
    const rows = list.getAllByRole('listitem');
    expect(
      rows.map((row) => within(row).getByText(/\d/, { selector: 'time' }).textContent),
    ).toEqual([
      formatDateTime(latest.submittedAt),
      formatDateTime(toIsoDateTime(firstSubmittedAt)),
    ]);

    // 3. Rename the field and save. Re-download the older response: it shows the old label.
    await user.click(screen.getByRole('link', { name: 'All templates' }));
    await user.click(await card('Expense claim').findByRole('link', { name: /^Open in builder/ }));
    await user.click(await screen.findByRole('button', { name: /^Employee name/ }));
    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'Full name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    await user.click(screen.getByRole('link', { name: 'All templates' }));
    await user.click(await card('Expense claim').findByRole('link', { name: /^View responses/ }));
    const older = within(await screen.findByRole('list', { name: '2 submitted responses' }))
      .getAllByRole('listitem')
      .at(-1)!;
    await user.click(within(older).getByRole('button', { name: /^Re-download PDF/ }));

    expect(printed()).toMatchObject({
      title: 'Expense claim',
      blocks: [
        { label: 'Employee name', value: { kind: 'text', text: 'Ada Lovelace' } },
        { label: 'Notes', value: { kind: 'text', text: 'Conference in Paris' } },
      ],
    });
  });
});
