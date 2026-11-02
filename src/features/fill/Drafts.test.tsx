/**
 * Drafts while filling in (D-23, ADR 0019): created on the first input, autosaved, resumed
 * against the current template, and opened read-only once submitted. The autosave delay runs
 * on a fake clock (`test/timers.ts`), so waiting it out costs no real time.
 */
import { act, screen, within } from '@testing-library/react';
import { newResponseId, toIsoDateTime } from '../../domain/ids';
import type { DraftResponse, FormResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { expectNoAxeViolations } from '../../test/axe';
import {
  choice,
  dateField,
  draftResponse,
  singleSelectField,
  submittedResponse,
  template,
  text,
  textField,
} from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';
import { startFakeClock } from '../../test/timers';
import { printDocument } from '../export/printDocument';
import { AUTOSAVE_DELAY_MS } from './useDraftAutosave';

vi.mock('../export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

function store(form: FormTemplate, ...responses: FormResponse[]) {
  const repositories = createRepositories(localStorage);
  repositories.templates.put(form);
  responses.forEach((response) => repositories.responses.put(response));
}

function storedResponses(): FormResponse[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

function onlyDraft(): DraftResponse {
  const [stored, ...others] = storedResponses();
  if (stored?.status !== 'draft' || others.length > 0) throw new Error('Expected one draft');
  return stored;
}

/** Another tab submits a response: the write lands, then the browser fires `storage` here. */
function submitInAnotherTab(form: FormTemplate, response: FormResponse) {
  store(form, response);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.responses }));
  });
}

const render = (path: string) => renderApp(path, { advanceTimers: vi.advanceTimersByTime });
const waitOutAutosave = () => act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));

/** Name (text) and Trip date (pre-filled with today). */
function tripForm() {
  const name = textField('Name');
  const trip = dateField('Trip date', { prefillToday: true });
  const form = template([name, trip], 'Expense claim');
  store(form);
  return { form, name };
}

describe('Drafts (D-23)', () => {
  beforeEach(() => {
    startFakeClock();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves nothing when a new response is opened and left without input, even with a pre-filled date', async () => {
    const { form } = tripForm();
    const { user, router } = await render(`/templates/${form.id}/respond`);
    expect(screen.getByLabelText(/Trip date/)).not.toHaveValue('');

    await user.click(screen.getByRole('link', { name: 'All templates' }));

    await screen.findByRole('heading', { level: 1, name: 'Templates' });
    expect(storedResponses()).toEqual([]);
    expect(router.state.location.pathname).toBe('/');
  });

  it('saves a draft on the first input and moves to its own URL, leaving focus in the field', async () => {
    const { form, name } = tripForm();
    const { user, router } = await render(`/templates/${form.id}/respond`);
    const field = screen.getByRole('textbox', { name: 'Name' });

    await user.type(field, 'A');

    const draft = onlyDraft();
    expect(draft).toMatchObject({ templateId: form.id, templateUpdatedAt: form.updatedAt });
    expect(draft.values[name.id]).toEqual(text('A'));
    expect(router.state.location.pathname).toBe(`/templates/${form.id}/responses/${draft.id}`);
    expect(field).toHaveFocus();
  });

  it('saves later changes once typing pauses, not on every keystroke', async () => {
    const { form, name } = tripForm();
    const { user } = await render(`/templates/${form.id}/respond`);
    const writes = vi.spyOn(Storage.prototype, 'setItem');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada Lovelace, London');
    await waitOutAutosave();

    expect(onlyDraft().values[name.id]).toEqual(text('Ada Lovelace, London'));
    // 20 keystrokes; the first creates the draft, the rest are debounced into a few writes.
    expect(writes.mock.calls.length).toBeLessThan(10);
  });

  it.each([
    [
      'the page is closed (pagehide)',
      () => {
        window.dispatchEvent(new Event('pagehide'));
      },
    ],
    [
      'the tab is hidden (visibilitychange)',
      () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      },
    ],
  ])('writes the waiting change straight away when %s', async (_, hide) => {
    const { form, name } = tripForm();
    const { user } = await render(`/templates/${form.id}/respond`);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');

    // The write re-renders the page, which subscribes to storage, so it is applied in act.
    act(hide);

    expect(onlyDraft().values[name.id]).toEqual(text('Ada'));
  });

  it('keeps the values after a refresh mid-form', async () => {
    const { form } = tripForm();
    const { user, router, unmount } = await render(`/templates/${form.id}/respond`);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    const trip = screen.getByLabelText(/Trip date/);
    await user.clear(trip);
    await user.type(trip, '2026-12-24');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    const url = router.state.location.pathname;
    unmount();

    await render(url);

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
    expect(screen.getByLabelText(/Trip date/)).toHaveValue('2026-12-24');
    expect(screen.queryByRole('heading', { name: /form has changed/ })).not.toBeInTheDocument();
  });

  it('resumes a draft against the current template: a deleted option’s answer is empty, and a notice says the form changed', async () => {
    const name = textField('Name');
    const method = singleSelectField('Payment method');
    const [card, cash] = method.config.options;
    const original = template([name, method], 'Expense claim');
    const draft = draftResponse(original, {
      [name.id]: text('Ada'),
      [method.id]: choice(card!.id),
    });
    const edited: FormTemplate = {
      ...original,
      fields: [name, { ...method, config: { ...method.config, options: [cash!] } }],
      updatedAt: toIsoDateTime(new Date('2026-11-02T10:00:00Z')),
    };
    store(edited, draft);

    const { user } = await render(`/templates/${edited.id}/responses/${draft.id}`);

    expect(
      screen.getByRole('heading', { level: 2, name: 'This form has changed since you started' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
    expect(screen.getByRole('radio', { name: 'Cash' })).not.toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Card' })).not.toBeInTheDocument();
    // The next save stores the draft as it reads now: the deleted option's answer is gone.
    await user.type(screen.getByRole('textbox', { name: 'Name' }), ' L');
    await waitOutAutosave();
    expect(onlyDraft().values).toEqual({ [name.id]: text('Ada L') });
  });

  it('stops showing the change notice once the resumed draft is saved against the new template', async () => {
    const name = textField('Name');
    const original = template([name]);
    const draft = draftResponse(original, { [name.id]: text('Ada') });
    const edited = { ...original, updatedAt: toIsoDateTime(new Date('2026-11-02T10:00:00Z')) };
    store(edited, draft);
    const { user, unmount } = await render(`/templates/${edited.id}/responses/${draft.id}`);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), ' L');
    await waitOutAutosave();
    unmount();
    await render(`/templates/${edited.id}/responses/${draft.id}`);

    expect(onlyDraft().templateUpdatedAt).toBe(edited.updatedAt);
    expect(screen.queryByRole('heading', { name: /form has changed/ })).not.toBeInTheDocument();
  });

  it('submits a draft as a submitted response under the same ID, which its URL then opens read-only', async () => {
    const name = textField('Name');
    const form = template([name], 'Expense claim');
    const draft = draftResponse(form, { [name.id]: text('Ada') });
    store(form, draft);
    const path = `/templates/${form.id}/responses/${draft.id}`;
    const { user, unmount } = await render(path);

    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toHaveFocus();
    const [stored, ...others] = storedResponses();
    expect(others).toEqual([]);
    expect(stored).toMatchObject({ status: 'submitted', id: draft.id, createdAt: draft.createdAt });
    // Leaving now must not write the draft back over the submitted response.
    await waitOutAutosave();
    unmount();
    expect(storedResponses()[0]?.status).toBe('submitted');

    await render(path);

    expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible();
    expect(screen.getByText('Ada')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All responses' })).toHaveAttribute(
      'href',
      `/templates/${form.id}/responses`,
    );
  });

  it('refuses to submit over the same draft already submitted in another tab, keeping the answers', async () => {
    const name = textField('Name');
    const form = template([name], 'Expense claim');
    const draft = draftResponse(form, { [name.id]: text('Ada') });
    store(form, draft);
    const { user } = await render(`/templates/${form.id}/responses/${draft.id}`);
    const submittedElsewhere = submittedResponse(
      form,
      { [name.id]: text('Ada Lovelace') },
      {
        id: draft.id,
        createdAt: draft.createdAt,
      },
    );

    submitInAnotherTab(form, submittedElsewhere);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), ' King');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This response was already submitted',
    );
    expect(screen.queryByRole('heading', { name: 'Response submitted' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada King');
    // Neither the submit nor a later autosave touches what was submitted first (D-10).
    await waitOutAutosave();
    expect(storedResponses()).toEqual([submittedElsewhere]);
  });

  it('links from the already-submitted alert to the responses list, which holds the submitted response', async () => {
    const name = textField('Name');
    const form = template([name], 'Expense claim');
    const draft = draftResponse(form, { [name.id]: text('Ada') });
    store(form, draft);
    const { user, router } = await render(`/templates/${form.id}/responses/${draft.id}`);
    submitInAnotherTab(form, submittedResponse(form, {}, { id: draft.id }));
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    await user.click(
      within(await screen.findByRole('alert')).getByRole('link', { name: 'View all responses' }),
    );

    expect(router.state.location.pathname).toBe(`/templates/${form.id}/responses`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Responses to Expense claim' }),
    ).toHaveFocus();
    expect(screen.getByRole('heading', { name: '1 submitted response' })).toBeVisible();
  });

  it('moves a new response to its own URL on submit, so a refresh shows what was submitted', async () => {
    const form = template([textField('Notes')]);
    store(form);
    const { user, router } = await render(`/templates/${form.id}/respond`);

    // Nothing typed: an all-optional form can be submitted without ever creating a draft.
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    await screen.findByRole('heading', { name: 'Response submitted' });
    const [stored] = storedResponses();
    expect(router.state.location.pathname).toBe(`/templates/${form.id}/responses/${stored?.id}`);
  });

  it('re-downloads the PDF from the read-only view', async () => {
    print.mockResolvedValue();
    const form = template([textField('Name')], 'Expense claim');
    const response = submittedResponse(form);
    store(form, response);
    const { user } = await render(`/templates/${form.id}/responses/${response.id}`);

    await user.click(screen.getByRole('button', { name: 'Re-download PDF' }));

    expect(print).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Expense claim', responseId: response.id }),
    );
  });

  it.each([
    ['an unknown response', () => newResponseId()],
    ['a malformed response ID', () => 'not-an-id'],
  ])('shows Not found for %s', async (_, id) => {
    const form = template([textField('Name')]);
    store(form);

    await render(`/templates/${form.id}/responses/${id()}`);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('shows Not found for a response opened under another template’s URL', async () => {
    const claim = template([textField('Name')], 'Expense claim');
    const leave = template([textField('Dates')], 'Leave request');
    const draft = draftResponse(claim);
    store(claim, draft);
    store(leave);

    await render(`/templates/${leave.id}/responses/${draft.id}`);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('has no axe violations on a resumed draft with the notice, and on the read-only view', async () => {
    const name = textField('Name');
    const form = template([name]);
    const draft = draftResponse(form, {}, { templateUpdatedAt: toIsoDateTime(new Date(0)) });
    const response = submittedResponse(form, { [name.id]: text('Ada') });
    store(form, draft, response);

    const resumed = await render(`/templates/${form.id}/responses/${draft.id}`);
    await expectNoAxeViolations(resumed.container);
    resumed.unmount();

    const readOnly = await render(`/templates/${form.id}/responses/${response.id}`);
    await expectNoAxeViolations(readOnly.container);
  });
});
