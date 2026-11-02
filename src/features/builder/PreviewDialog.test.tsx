import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { createRepositories } from '../../storage/repositories';
import {
  condition,
  group,
  numberField,
  option,
  singleSelectField,
  template,
  textField,
} from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';
import { expectNoAxeViolations } from '../../test/axe';
import { AUTOSAVE_DELAY_MS } from '../fill/useDraftAutosave';
import { settleAnnouncements, startFakeClock } from '../../test/timers';

const preview = () => within(screen.getByRole('dialog', { name: /^Preview:/ }));
const openPreview = (user: UserEvent) =>
  user.click(screen.getByRole('button', { name: 'Preview' }));

/** Every key and value in storage, to show that a preview writes nothing at all. */
const everyStoredKey = () =>
  Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));

/** Amount, then Receipt number, which shows only when Amount is over 50 and is then required. */
function seedClaim() {
  const amount = numberField('Amount');
  const receipt = textField('Receipt number');
  receipt.logic.defaultVisible = false;
  receipt.logic.show = group('all', condition(amount.id, { kind: 'number', op: 'gt', value: 50 }));
  receipt.logic.defaultRequired = true;
  const form = template([amount, receipt], 'Expense claim');
  createRepositories(localStorage).templates.put(form);
  return form;
}

describe('Preview', () => {
  it('shows the form as it is in the builder, including a field added since the last save', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await user.click(screen.getByRole('button', { name: 'Add Short text' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Project code');

    await openPreview(user);

    expect(screen.getByRole('dialog', { name: 'Preview: Expense claim' })).toBeInTheDocument();
    expect(preview().getByRole('textbox', { name: /^Project code/ })).toBeInTheDocument();
    expect(preview().getByText(/Nothing you enter here is saved/)).toBeInTheDocument();
  });

  it('shows and hides fields live as conditions change', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await openPreview(user);

    expect(preview().queryByRole('textbox', { name: /^Receipt number/ })).not.toBeInTheDocument();
    await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '60');

    expect(preview().getByRole('textbox', { name: /^Receipt number/ })).toBeInTheDocument();
  });

  it('speaks visibility changes through a live region inside the dialog, which the modal leaves reachable', async () => {
    startFakeClock();
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    await openPreview(user);

    await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '60');
    await settleAnnouncements();

    expect(preview().getByTestId('live-region')).toHaveTextContent('Receipt number shown');
    vi.useRealTimers();
  });

  it('blocks submit on a required field with the error summary, as Fill does', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await openPreview(user);
    await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '60');

    await user.click(preview().getByRole('button', { name: 'Submit response' }));

    expect(await preview().findByRole('alert')).toHaveTextContent('Receipt number');
    expect(preview().queryByRole('heading', { name: 'Preview submitted' })).not.toBeInTheDocument();
    // Let the live region speak first, so its update never lands while axe is running.
    await waitFor(() => {
      expect(preview().getByTestId('live-region')).toHaveTextContent('Receipt number shown');
    });
    await expectNoAxeViolations(document.body);
  });

  it('says nothing was saved after a valid submit, and writes nothing to storage', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    const before = everyStoredKey();
    await openPreview(user);
    await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '60');
    await user.type(preview().getByRole('textbox', { name: /^Receipt number/ }), 'R-1');

    await user.click(preview().getByRole('button', { name: 'Submit response' }));

    const notice = await preview().findByRole('heading', { name: 'Preview submitted' });
    expect(notice).toHaveFocus();
    expect(preview().getByText(/Nothing was saved/)).toBeInTheDocument();
    expect(everyStoredKey()).toEqual(before);
  });

  // ADR 0016 / 0019: autosave lives in Fill's session, never in the form Preview shares.
  it('never writes a draft while typing, after the autosave delay, or when the page is hidden', async () => {
    startFakeClock();
    try {
      const form = seedClaim();
      const { user } = await renderApp(`/templates/${form.id}/edit`, {
        advanceTimers: vi.advanceTimersByTime,
      });
      const before = everyStoredKey();
      await openPreview(user);

      await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '60');
      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
      act(() => {
        window.dispatchEvent(new Event('pagehide'));
      });

      expect(everyStoredKey()).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts again with an empty form', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await openPreview(user);
    await user.type(preview().getByRole('textbox', { name: /^Amount/ }), '20');
    await user.click(preview().getByRole('button', { name: 'Submit response' }));

    await user.click(await preview().findByRole('button', { name: 'Start again' }));

    expect(preview().getByRole('textbox', { name: /^Amount/ })).toHaveValue('');
    expect(preview().getByText(/Nothing you enter here is saved/)).toHaveFocus();
  });

  it.each([
    ['Escape', (user: UserEvent) => user.keyboard('{Escape}')],
    [
      'Close preview',
      (user: UserEvent) => user.click(preview().getByRole('button', { name: 'Close preview' })),
    ],
  ])('closes with %s and returns focus to the Preview button', async (_, close) => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await openPreview(user);

    await close(user);

    expect(screen.queryByRole('dialog', { name: /^Preview:/ })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus();
    });
  });

  it('offers Close preview right before Submit, and closing never submits the form', async () => {
    const form = seedClaim();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await openPreview(user);
    const close = preview().getByRole('button', { name: 'Close preview' });

    close.focus();
    await user.tab();
    expect(preview().getByRole('button', { name: 'Submit response' })).toHaveFocus();

    await user.click(close);
    expect(screen.queryByRole('dialog', { name: /^Preview:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /before submitting/ })).not.toBeInTheDocument();
  });

  it('opens while Save is blocked, with a blank label and a blank option', async () => {
    const blankLabel = textField('');
    const choice = singleSelectField('Payment method', {
      config: { options: [option('Card'), option('')], display: 'radio' },
    });
    const form = template([blankLabel, choice], 'Unfinished');
    createRepositories(localStorage).templates.put(form);
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByRole('heading', { name: /Fix .* before saving/ }),
    ).toBeInTheDocument();

    await openPreview(user);

    expect(preview().getByRole('textbox', { name: /^Untitled field/ })).toBeInTheDocument();
    expect(preview().getByRole('radio', { name: 'Card' })).toBeInTheDocument();
    expect(preview().getAllByRole('radio')).toHaveLength(2);
  });
});
