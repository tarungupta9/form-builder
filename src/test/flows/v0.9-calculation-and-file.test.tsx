/**
 * The v0.9 demo script (docs/implementation-plan.md), run through the real app in two parts.
 * The first builds Total (sum) and Average over Hotel, Meals and Taxi by role and label, shows
 * that a calculation with no sources blocks Save, that neither new type is offered as a
 * condition target, and that removing a source names the calculation and drops the source.
 * The second fills the claim in live: both results update as the respondent types, both drop
 * Taxi once it is hidden, a disallowed file is refused even with the picker filter bypassed,
 * and the PDF lists the allowed one as metadata with the footnote.
 *
 * jsdom cannot print, so `printDocument` is mocked and the model it is handed is checked.
 * Manual only: choosing files through the real OS picker (and its "All files" switch), VoiceOver
 * reading the result and its sources, and the printed PDF itself.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import type { ExportDocument } from '../../features/export/exportModel';
import { printDocument } from '../../features/export/printDocument';
import { createRepositories } from '../../storage/repositories';
import {
  calculationField,
  condition,
  fileField,
  group,
  numberField,
  options,
  singleSelectField,
  template,
} from '../fixtures';
import { renderApp } from '../renderApp';
import { settleAnnouncements, startFakeClock } from '../timers';

vi.mock('../../features/export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

const repositories = () => createRepositories(localStorage);
const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const sources = () => within(screen.getByRole('group', { name: 'Calculate from' }));
const result = (name: string) => screen.getByRole('status', { name });
const amount = (name: string) => screen.getByRole('textbox', { name: new RegExp(`^${name}`) });

function storedTemplates(): FormTemplate[] {
  const snapshot = repositories().templates.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

function storedResponses(): FormResponse[] {
  const snapshot = repositories().responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

/** The claim the fill part runs on: Taxi is hidden once "Took a taxi?" is No. */
function travelClaim() {
  const tookTaxi = singleSelectField('Took a taxi?', {
    config: { options: options('Yes', 'No'), display: 'radio' },
  });
  const no = tookTaxi.config.options[1]!;
  const hotel = numberField('Hotel', { decimals: 2 });
  const meals = numberField('Meals', { decimals: 2 });
  const taxi = numberField('Taxi', { decimals: 2 });
  taxi.logic.hide = group(
    'all',
    condition(tookTaxi.id, { kind: 'choice', op: 'equals', value: no.id }),
  );
  const total = calculationField('Total', [hotel, meals, taxi]);
  const average = calculationField('Average', [hotel, meals, taxi], { aggregation: 'average' });
  const receipts = fileField('Receipts', { allowedTypes: ['.pdf'], maxFiles: 2 });
  const form = template([tookTaxi, hotel, meals, taxi, total, average, receipts], 'Travel claim');
  repositories().templates.put(form);
  return { form, hotel, meals, taxi, total, average, receipts };
}

describe('v0.9 demo: calculation and file upload', () => {
  beforeEach(() => {
    startFakeClock();
    print.mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    print.mockReset();
  });

  it('builds Total and Average over three Number fields, and removing a source drops it', async () => {
    const hotel = numberField('Hotel');
    const meals = numberField('Meals');
    const taxi = numberField('Taxi');
    const form = template([hotel, meals, taxi], 'Travel claim');
    repositories().templates.put(form);
    const { user } = await renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });

    // A calculation with no sources blocks Save (D-12).
    await user.click(screen.getByRole('button', { name: 'Add Calculation' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Total');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose at least one Number field to calculate from.',
    );

    for (const name of ['Hotel', 'Meals', 'Taxi']) {
      await user.click(sources().getByRole('checkbox', { name }));
    }
    await user.click(screen.getByRole('button', { name: 'Add Calculation' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Average');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Calculation' }), 'Average');
    for (const name of ['Hotel', 'Meals', 'Taxi']) {
      await user.click(sources().getByRole('checkbox', { name }));
    }
    await user.click(screen.getByRole('button', { name: 'Add File upload' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Receipts');
    await user.type(screen.getByRole('textbox', { name: 'Allowed file types' }), 'PDF');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    // Neither type can be a condition target.
    await user.click(canvas().getByRole('button', { name: /^Hotel/ }));
    await user.click(screen.getByRole('button', { name: 'Add a show condition' }));
    const targets = within(screen.getByRole('combobox', { name: 'Show condition 1: field' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(targets).toEqual(['Field 2, Meals', 'Field 3, Taxi']);
    await user.click(screen.getByRole('button', { name: 'Remove show condition 1' }));

    // Removing Taxi names both calculations, and drops Taxi from their sources.
    await user.click(screen.getByRole('button', { name: 'Remove Taxi' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Remove Taxi?' }));
    expect(dialog.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Total: 1 calculation source',
      'Average: 1 calculation source',
    ]);
    await user.click(dialog.getByRole('button', { name: 'Remove field and references' }));
    await settleAnnouncements();
    expect(screen.getByTestId('live-region')).toHaveTextContent(
      'Removed Taxi and 2 calculation sources on Total and Average.',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    const [saved] = storedTemplates();
    expect(saved?.fields.map((field) => [field.label, field.type])).toEqual([
      ['Hotel', 'number'],
      ['Meals', 'number'],
      ['Total', 'calculation'],
      ['Average', 'calculation'],
      ['Receipts', 'file'],
    ]);
    expect(saved?.fields[2]?.config).toEqual({
      sourceFieldIds: [hotel.id, meals.id],
      aggregation: 'sum',
      decimals: 2,
    });
    expect(saved?.fields[3]?.config).toMatchObject({ aggregation: 'average' });
    expect(saved?.fields[4]?.config).toEqual({ allowedTypes: ['.pdf'] });
  });

  it('updates both results live, drops a hidden Taxi, refuses a disallowed file, and exports metadata', async () => {
    const { form, hotel, meals, taxi, total, average, receipts } = travelClaim();
    await renderApp(`/templates/${form.id}/respond`);
    // A user of our own: the picker's `accept` filter is bypassed, as a respondent switching
    // the picker to "All files" would.
    const user = userEvent.setup({
      delay: null,
      applyAccept: false,
      advanceTimers: vi.advanceTimersByTime,
    });

    expect(result('Total')).toHaveTextContent('—');
    expect(result('Total')).toHaveAccessibleDescription(
      'Sum of Hotel, Meals and Taxi. Empty and hidden answers are left out.',
    );
    await user.type(amount('Hotel'), '120');
    expect(result('Total')).toHaveTextContent('120.00');
    expect(result('Average')).toHaveTextContent('120.00');
    await user.type(amount('Meals'), '50');
    await user.type(amount('Taxi'), '30');
    expect(result('Total')).toHaveTextContent('200.00');
    expect(result('Average')).toHaveTextContent('66.67');

    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.queryByRole('textbox', { name: /^Taxi/ })).not.toBeInTheDocument();
    expect(result('Total')).toHaveTextContent('170.00');
    expect(result('Average')).toHaveTextContent('85.00');

    const picker = screen.getByLabelText('Choose files');
    await user.upload(picker, new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByText('notes.txt is not PDF.')).toBeVisible();
    await user.upload(picker, new File(['%PDF'], 'hotel.pdf', { type: 'application/pdf' }));
    expect(
      within(screen.getByRole('list', { name: 'Files added to Receipts' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });

    const [response] = storedResponses();
    if (response?.status !== 'submitted') throw new Error('Expected a submitted response');
    expect(response.answers[total.id]).toEqual({ kind: 'number', input: '170.00' });
    expect(response.answers[average.id]).toEqual({ kind: 'number', input: '85.00' });
    expect(response.answers[taxi.id]).toBeUndefined();
    expect(response.answers[hotel.id]).toEqual({ kind: 'number', input: '120' });
    expect(response.answers[meals.id]).toEqual({ kind: 'number', input: '50' });
    // Metadata only: the stored value has no contents to carry.
    expect(response.answers[receipts.id]).toMatchObject({
      kind: 'files',
      value: [{ name: 'hotel.pdf', size: 4, type: 'application/pdf' }],
    });

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1);
    });
    const printed: ExportDocument = print.mock.lastCall![0];
    expect(printed.blocks).toEqual([
      expect.objectContaining({ label: 'Took a taxi?' }),
      expect.objectContaining({ label: 'Hotel' }),
      expect.objectContaining({ label: 'Meals' }),
      { kind: 'answer', label: 'Total', value: { kind: 'text', text: '170.00' } },
      { kind: 'answer', label: 'Average', value: { kind: 'text', text: '85.00' } },
      {
        kind: 'answer',
        label: 'Receipts',
        value: { kind: 'list', items: ['hotel.pdf · 4 B · PDF'] },
        note: 'Attachments are listed by name only; file contents are not included in this export.',
      },
    ]);
  });
});
