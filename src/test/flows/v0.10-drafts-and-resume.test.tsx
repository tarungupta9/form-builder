/**
 * The v0.10 demo script (docs/implementation-plan.md), run end to end through the real app on a
 * fake clock (`test/timers.ts`), so the autosave delay costs no real time. A refresh is an
 * unmount and a fresh render of the same URL, which keeps only what was written to storage.
 *
 * Manual only: a real browser refresh and tab close (pagehide and visibilitychange fire there,
 * jsdom only simulates them), two tabs editing one draft, and VoiceOver reading the change
 * notice and the In progress list.
 */
import { act, screen, within } from '@testing-library/react';
import type { FormResponse } from '../../domain/response';
import { AUTOSAVE_DELAY_MS } from '../../features/fill/useDraftAutosave';
import { createRepositories } from '../../storage/repositories';
import { singleSelectField, template, textField } from '../fixtures';
import { renderApp } from '../renderApp';
import { startFakeClock } from '../timers';

const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);
/** The responses page loads on first visit (ADR 0017), so the list is waited for. */
const drafts = async () => within(await screen.findByRole('list', { name: 'In progress' }));

function storedResponses(): FormResponse[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

const render = (path: string) => renderApp(path, { advanceTimers: vi.advanceTimersByTime });

describe('v0.10 demo: drafts and resume', () => {
  beforeEach(() => {
    startFakeClock();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps typing through a refresh, leaves nothing for an abandoned form, resumes, survives an option deletion, and discards', async () => {
    const method = singleSelectField('Payment method');
    const claim = template([textField('Employee name'), method], 'Expense claim');
    createRepositories(localStorage).templates.put(claim);

    // 1. Start a response and type, then refresh: the values are still there.
    let app = await render('/');
    await app.user.click(card('Expense claim').getByRole('link', { name: /^New response/ }));
    await app.user.type(
      await screen.findByRole('textbox', { name: 'Employee name' }),
      'Ada Lovelace',
    );
    await app.user.click(screen.getByRole('radio', { name: 'Card' }));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    const draftUrl = app.router.state.location.pathname;
    expect(draftUrl).toMatch(new RegExp(`^/templates/${claim.id}/responses/`));
    app.unmount();

    app = await render(draftUrl);
    expect(screen.getByRole('textbox', { name: 'Employee name' })).toHaveValue('Ada Lovelace');
    expect(screen.getByRole('radio', { name: 'Card' })).toBeChecked();

    // 2. New response, then leave without typing: no second draft appears.
    await app.user.click(screen.getByRole('link', { name: 'All templates' }));
    await app.user.click(card('Expense claim').getByRole('link', { name: /^New response/ }));
    await screen.findByRole('button', { name: 'Submit response' });
    await app.user.click(screen.getByRole('link', { name: 'All templates' }));
    expect(storedResponses()).toHaveLength(1);
    expect(card('Expense claim').getByText('0 responses · 1 in progress')).toBeVisible();

    // 3. Resume from In progress.
    await app.user.click(card('Expense claim').getByRole('link', { name: /^View responses/ }));
    await app.user.click((await drafts()).getByRole('link', { name: /^Resume/ }));
    expect(await screen.findByRole('textbox', { name: 'Employee name' })).toHaveValue(
      'Ada Lovelace',
    );
    expect(screen.queryByRole('heading', { name: /form has changed/ })).not.toBeInTheDocument();

    // 4. Delete the option the draft used, then resume: the notice shows and the answer is empty.
    await app.user.click(screen.getByRole('link', { name: 'All templates' }));
    await app.user.click(card('Expense claim').getByRole('link', { name: /^Open in builder/ }));
    await app.user.click(await screen.findByRole('button', { name: /^Payment method/ }));
    await app.user.click(screen.getByRole('button', { name: 'Remove Card' }));
    await app.user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);
    app.unmount();

    app = await render(draftUrl);
    expect(
      screen.getByRole('heading', { level: 2, name: 'This form has changed since you started' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Employee name' })).toHaveValue('Ada Lovelace');
    expect(screen.queryByRole('radio', { name: 'Card' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cash' })).not.toBeChecked();

    // 5. Discard the draft, after confirming.
    await app.user.click(screen.getByRole('link', { name: 'All templates' }));
    await app.user.click(card('Expense claim').getByRole('link', { name: /^View responses/ }));
    await app.user.click((await drafts()).getByRole('button', { name: /^Discard/ }));
    await app.user.click(screen.getByRole('button', { name: 'Discard response' }));
    expect(screen.queryByRole('list', { name: 'In progress' })).not.toBeInTheDocument();
    expect(storedResponses()).toEqual([]);
  });

  it('submits a resumed draft once, then opens it read-only at the same URL', async () => {
    const claim = template([textField('Employee name')], 'Expense claim');
    createRepositories(localStorage).templates.put(claim);
    let app = await render(`/templates/${claim.id}/respond`);
    await app.user.type(screen.getByRole('textbox', { name: 'Employee name' }), 'Grace Hopper');
    const draftUrl = app.router.state.location.pathname;
    app.unmount();

    app = await render(draftUrl);
    await app.user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });
    await app.user.click(screen.getByRole('link', { name: 'View all responses' }));

    expect(screen.queryByRole('list', { name: 'In progress' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1 submitted response' })).toBeVisible();
    app.unmount();

    await render(draftUrl);
    expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible();
    expect(screen.getByText('Grace Hopper')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Re-download PDF' })).toBeVisible();
  });
});
