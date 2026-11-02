import { screen, waitFor, within } from '@testing-library/react';
import { newTemplateId, toIsoDateTime } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { expectNoAxeViolations } from '../../test/axe';
import { draftResponse, submittedResponse, template, text, textField } from '../../test/fixtures';
import { settleAnnouncements, startFakeClock } from '../../test/timers';
import { renderApp } from '../../test/renderApp';
import { formatDateTime } from '../../ui/format';
import { printDocument } from '../export/printDocument';

// jsdom cannot print; the mock stands in for the browser's dialog and captures the document.
vi.mock('../export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

const at = (iso: string) => toIsoDateTime(new Date(iso));

function save(form: FormTemplate, ...responses: SubmittedResponse[]) {
  const repositories = createRepositories(localStorage);
  repositories.templates.put(form);
  responses.forEach((response) => repositories.responses.put(response));
}

const rows = () =>
  within(screen.getByRole('list', { name: /submitted/i })).getAllByRole('listitem');

describe('Responses page', () => {
  it('shows the empty state, with New response, when the template has none', async () => {
    const form = template([textField('Name')], 'Expense claim');
    save(form);

    await renderApp(`/templates/${form.id}/responses`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Responses to Expense claim' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'No responses yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'New response' })).toHaveAttribute(
      'href',
      `/templates/${form.id}/respond`,
    );
  });

  it('explains why there is no New response for a template with no fields', async () => {
    const form = template([], 'Empty form');
    save(form);

    await renderApp(`/templates/${form.id}/responses`);

    expect(
      await screen.findByText('Add a field in the builder to collect responses.'),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'New response' })).not.toBeInTheDocument();
  });

  it('lists submitted responses newest first with their timestamps', async () => {
    const form = template([textField('Name')]);
    const oldest = submittedResponse(form, {}, { submittedAt: at('2026-10-30T08:00:00Z') });
    const newest = submittedResponse(form, {}, { submittedAt: at('2026-11-01T16:45:00Z') });
    const middle = submittedResponse(form, {}, { submittedAt: at('2026-10-31T12:00:00Z') });
    save(form, oldest, newest, middle);

    await renderApp(`/templates/${form.id}/responses`);

    expect(
      await screen.findByRole('heading', { level: 2, name: '3 submitted responses' }),
    ).toBeVisible();
    const times = rows().map(
      (row) => within(row).getByText(/\d/, { selector: 'time' }).textContent,
    );
    expect(times).toEqual([newest, middle, oldest].map((r) => formatDateTime(r.submittedAt)));
    expect(within(rows()[0]!).getByText(newest.id)).toBeVisible();
  });

  it('lists only this template’s submitted responses, keeping drafts out of that list', async () => {
    const claim = template([textField('Name')], 'Expense claim');
    const leave = template([textField('Dates')], 'Leave request');
    const mine = submittedResponse(claim);
    save(claim, mine);
    save(leave, submittedResponse(leave));
    createRepositories(localStorage).responses.put(draftResponse(claim));

    await renderApp(`/templates/${claim.id}/responses`);

    expect(
      await screen.findByRole('heading', { level: 2, name: '1 submitted response' }),
    ).toBeVisible();
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]!).getByText(mine.id)).toBeVisible();
  });

  describe('In progress (D-23)', () => {
    const drafts = () => within(screen.getByRole('list', { name: 'In progress' }));
    const discardDialog = () =>
      within(screen.getByRole('dialog', { name: 'Discard this response?' }));
    const storedIds = () => {
      const snapshot = createRepositories(localStorage).responses.snapshot();
      return snapshot.ok ? [...snapshot.value.keys()] : null;
    };

    function seedDrafts() {
      const form = template([textField('Name')], 'Expense claim');
      const older = draftResponse(form, {}, { updatedAt: at('2026-11-01T08:00:00Z') });
      const newer = draftResponse(form, {}, { updatedAt: at('2026-11-01T10:00:00Z') });
      save(form);
      createRepositories(localStorage).responses.put(older);
      createRepositories(localStorage).responses.put(newer);
      return { form, older, newer };
    }

    it('lists drafts most recently edited first, each with Resume', async () => {
      const { form, older, newer } = seedDrafts();

      await renderApp(`/templates/${form.id}/responses`);

      const items = drafts().getAllByRole('listitem');
      expect(
        items.map((item) => within(item).getByText(/\d/, { selector: 'time' }).textContent),
      ).toEqual([newer, older].map((draft) => formatDateTime(draft.updatedAt)));
      expect(within(items[0]!).getByRole('link', { name: /^Resume/ })).toHaveAttribute(
        'href',
        `/templates/${form.id}/responses/${newer.id}`,
      );
      // Not responses yet: the submitted list still says there are none.
      expect(screen.getByRole('heading', { name: 'No responses yet' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'New response' })).toBeVisible();
    });

    it('keeps the draft after Cancel', async () => {
      const { form } = seedDrafts();
      const { user } = await renderApp(`/templates/${form.id}/responses`);

      await user.click(drafts().getAllByRole('button', { name: /^Discard/ })[0]!);
      expect(discardDialog().getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.click(discardDialog().getByRole('button', { name: 'Cancel' }));

      expect(drafts().getAllByRole('listitem')).toHaveLength(2);
      expect(storedIds()).toHaveLength(2);
    });

    it('discards a draft after confirming, announces it, and focuses the next draft', async () => {
      startFakeClock();
      try {
        const { form, older, newer } = seedDrafts();
        const { user } = await renderApp(`/templates/${form.id}/responses`, {
          advanceTimers: vi.advanceTimersByTime,
        });

        await user.click(drafts().getAllByRole('button', { name: /^Discard/ })[0]!);
        expect(
          discardDialog().getByText('Its answers will be deleted. This can’t be undone.'),
        ).toBeVisible();
        await user.click(discardDialog().getByRole('button', { name: 'Discard response' }));

        expect(storedIds()).toEqual([older.id]);
        expect(drafts().getAllByRole('listitem')).toHaveLength(1);
        expect(screen.getByText(/^Last edited/)).toHaveFocus();
        expect(storedIds()).not.toContain(newer.id);
        await settleAnnouncements();
        expect(screen.getByTestId('live-region')).toHaveTextContent(
          'Discarded the response in progress.',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('focuses the page heading once the last draft is discarded', async () => {
      const form = template([textField('Name')], 'Expense claim');
      save(form);
      createRepositories(localStorage).responses.put(draftResponse(form));
      const { user } = await renderApp(`/templates/${form.id}/responses`);

      await user.click(screen.getByRole('button', { name: /^Discard/ }));
      await user.click(discardDialog().getByRole('button', { name: 'Discard response' }));

      expect(screen.queryByRole('list', { name: 'In progress' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });
  });

  it.each([
    ['an unknown', newTemplateId()],
    ['an invalid', 'not-an-id'],
  ])('shows Not found for %s template ID', async (_case, id) => {
    await renderApp(`/templates/${id}/responses`);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('shows the storage error when stored responses cannot be read, and leaves them alone', async () => {
    const form = template([textField('Name')]);
    save(form);
    localStorage.setItem(STORAGE_KEYS.responses, '{bad');

    await renderApp(`/templates/${form.id}/responses`);

    expect(
      await screen.findByRole('heading', { name: 'Your saved data could not be read' }),
    ).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEYS.responses)).toBe('{bad');
  });

  it('lists the readable responses and says how many were set aside', async () => {
    const form = template([textField('Name')]);
    const kept = submittedResponse(form);
    createRepositories(localStorage).templates.put(form);
    localStorage.setItem(
      STORAGE_KEYS.responses,
      JSON.stringify({ schemaVersion: 1, items: { [kept.id]: kept, broken: {} } }),
    );

    await renderApp(`/templates/${form.id}/responses`);

    expect(
      await screen.findByRole('region', { name: '1 saved response could not be read' }),
    ).toBeVisible();
    expect(rows()).toHaveLength(1);
  });

  it('re-downloads a response with the labels it was submitted with after a field is renamed', async () => {
    const name = textField('Employee name');
    const form = template([name], 'Expense claim');
    const response = submittedResponse(form, { [name.id]: text('Ada') });
    save(form, response);
    save({ ...form, title: 'Claim form', fields: [{ ...name, label: 'Full name' }] });
    print.mockResolvedValue();
    const { user } = await renderApp(`/templates/${form.id}/responses`);

    await user.click(await screen.findByRole('button', { name: /^Re-download PDF/ }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(print.mock.calls[0]![0]).toMatchObject({
      title: 'Expense claim',
      responseId: response.id,
      blocks: [{ kind: 'answer', label: 'Employee name', value: { kind: 'text', text: 'Ada' } }],
    });
  });

  it('marks the PDF button busy while preparing and ignores repeat presses', async () => {
    const form = template([textField('Name')]);
    save(form, submittedResponse(form));
    let finish: () => void = () => undefined;
    print.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = await renderApp(`/templates/${form.id}/responses`);
    const button = await screen.findByRole('button', { name: /^Re-download PDF/ });

    await user.click(button);
    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeEnabled(); // Busy, not disabled, so focus stays on it.
    expect(print).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => {
      expect(button).not.toHaveAttribute('aria-busy');
    });
  });

  it('ends the busy state and shows an alert when the print dialog cannot open', async () => {
    const form = template([textField('Name')]);
    save(form, submittedResponse(form));
    print.mockRejectedValue(new Error('blocked'));
    const { user } = await renderApp(`/templates/${form.id}/responses`);
    const button = await screen.findByRole('button', { name: /^Re-download PDF/ });

    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t open the print dialog');
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('names the page after the form', async () => {
    const form = template([textField('Name')], 'Expense claim');
    save(form);

    await renderApp(`/templates/${form.id}/responses`);

    await waitFor(() => {
      expect(document.title).toBe('Responses: Expense claim – Form builder');
    });
  });

  it('has no axe violations when empty and when listing responses', async () => {
    const empty = template([textField('Name')], 'Empty');
    const full = template([textField('Name')], 'Full');
    save(empty);
    save(full, submittedResponse(full), submittedResponse(full));

    const first = await renderApp(`/templates/${empty.id}/responses`);
    await screen.findByRole('heading', { name: 'No responses yet' });
    await expectNoAxeViolations(first.container);
    first.unmount();

    const second = await renderApp(`/templates/${full.id}/responses`);
    await screen.findByRole('heading', { name: '2 submitted responses' });
    await expectNoAxeViolations(second.container);
  });
});
