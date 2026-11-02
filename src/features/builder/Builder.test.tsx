import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { createRepositories } from '../../storage/repositories';
import type { FormTemplate } from '../../domain/template';
import {
  condition,
  group,
  numberField,
  options,
  singleSelectField,
  template,
  textField,
} from '../../test/fixtures';
import { expectNoAxeViolations } from '../../test/axe';
import { settleAnnouncements, startFakeClock } from '../../test/timers';

const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const detailsDialog = () => screen.getByRole('dialog', { name: 'Title and description' });

/** Names the template through the heading's edit button, as an author would. */
async function setDetails(user: UserEvent, title: string, description = '') {
  await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
  const dialog = within(detailsDialog());
  await user.clear(dialog.getByRole('textbox', { name: 'Title' }));
  await user.type(dialog.getByRole('textbox', { name: 'Title' }), title);
  if (description)
    await user.type(dialog.getByRole('textbox', { name: /Description/ }), description);
  await user.click(dialog.getByRole('button', { name: 'Done' }));
}

describe('Builder', () => {
  it('creates a template, saves it, and lists it after a reload', async () => {
    const first = renderApp('/templates/new');
    const { user, router } = first;

    await setDetails(user, 'Expense claim', 'For staff expenses');
    await user.click(screen.getByRole('button', { name: 'Add Short text' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Employee name');
    await user.click(screen.getByRole('switch', { name: 'Required' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/templates\/[0-9a-f-]+\/edit$/);
    });
    // Replacing the URL is not a new page: the builder stays mounted and focus stays on Save.
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeInTheDocument();

    // A full refresh: nothing in memory survives, only what was written to localStorage.
    first.unmount();
    const second = renderApp('/');
    const card = (await screen.findByRole('heading', { name: 'Expense claim' })).closest('li')!;
    expect(within(card).getByText('For staff expenses')).toBeInTheDocument();
    expect(within(card).getByText('1 field')).toBeInTheDocument();

    await second.user.click(
      within(card).getByRole('link', { name: /^Open in builder\s*: Expense claim$/ }),
    );
    expect(await canvas().findByText('Employee name')).toBeInTheDocument();
    expect(canvas().getByText('Required')).toBeInTheDocument();
  });

  it('adds a field after the selected one, selects it, focuses it and announces it', async () => {
    const { user } = renderApp('/templates/new');
    const add = screen.getByRole('button', { name: 'Add Short text' });
    await user.click(add);
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'First');
    await user.click(add);
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Last');
    await user.click(canvas().getByRole('button', { name: /^First/ }));

    await user.click(add);

    const items = canvas().getAllByRole('button', { pressed: true });
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveFocus();
    expect(
      canvas()
        .getAllByRole('button', { name: /Short text/, pressed: false })
        .map((b) => b.textContent),
    ).toEqual([expect.stringMatching(/^First/), expect.stringMatching(/^Last/)]);
    await waitFor(() => {
      expect(screen.getByTestId('live-region')).toHaveTextContent(
        'Short text added at position 2 of 3',
      );
    });
  });

  it('blocks Save and shows the issue when a text field’s min length exceeds its max length', async () => {
    const { user, router } = renderApp('/templates/new');
    await setDetails(user, 'Expense claim');
    await user.click(screen.getByRole('button', { name: 'Add Short text' }));
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Employee name');
    await user.type(screen.getByRole('textbox', { name: 'Maximum characters' }), '40');
    await user.type(screen.getByRole('textbox', { name: 'Minimum characters' }), '50');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByText(/The minimum length is more than the maximum/)).toBeVisible();
    expect(router.state.location.pathname).toBe('/templates/new');
    expect(createRepositories(localStorage).templates.snapshot()).toEqual({
      ok: true,
      value: new Map(),
    });
  });

  it('blocks Save until the form has a title and every field has a label', async () => {
    const { user } = renderApp('/templates/new');
    await user.click(screen.getByRole('button', { name: 'Add Short text' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = screen.getByRole('alert');
    expect(within(summary).getByText('Give the form a title.')).toBeInTheDocument();
    expect(within(summary).getByText(/Give this field a label/)).toBeInTheDocument();

    // Following the title issue opens the details dialog with the problem already shown.
    await user.click(within(summary).getByRole('button', { name: /Title and description/ }));
    const title = within(detailsDialog()).getByRole('textbox', { name: 'Title' });
    expect(title).toHaveFocus();
    expect(title).toHaveAccessibleDescription('Give the form a title.');
  });

  it('keeps the builder’s edits and shows "Storage is full" when saving hits the quota', async () => {
    const { user } = renderApp('/templates/new');
    await setDetails(user, 'Expense claim');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
    expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeInTheDocument();
  });

  describe('title and description', () => {
    it('edits them from the heading, then returns focus to the edit button and announces it', async () => {
      const saved = { ...template([]), title: 'Expense claim', description: '' };
      createRepositories(localStorage).templates.put(saved);
      const { user } = renderApp(`/templates/${saved.id}/edit`);
      const edit = await screen.findByRole('button', { name: 'Edit title and description' });

      await user.click(edit);
      const dialog = within(detailsDialog());
      expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveFocus();
      expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Expense claim');
      await user.type(dialog.getByRole('textbox', { name: 'Title' }), ' (2026)');
      await user.type(dialog.getByRole('textbox', { name: /Description/ }), 'For staff');
      await user.click(dialog.getByRole('button', { name: 'Done' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Expense claim (2026)' }),
      ).toBeInTheDocument();
      expect(screen.getByText('For staff')).toBeInTheDocument();
      expect(edit).toHaveFocus();
      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent(
          'Title and description updated',
        );
      });
    });

    it('shows "Untitled template" until a new template has a title', () => {
      renderApp('/templates/new');

      expect(
        screen.getByRole('heading', { level: 1, name: 'Untitled template' }),
      ).toBeInTheDocument();
    });

    it.each([
      ['Cancel', (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape', (user: UserEvent) => user.keyboard('{Escape}')],
    ])('discards the draft when the author closes the dialog with %s', async (_, close) => {
      const { user } = renderApp('/templates/new');
      await setDetails(user, 'Expense claim');
      const edit = screen.getByRole('button', { name: 'Edit title and description' });

      await user.click(edit);
      await user.type(within(detailsDialog()).getByRole('textbox', { name: 'Title' }), ' draft');
      await close(user);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeInTheDocument();
      expect(edit).toHaveFocus();
      // Opening again starts from the template, not from the discarded draft.
      await user.click(edit);
      expect(within(detailsDialog()).getByRole('textbox', { name: 'Title' })).toHaveValue(
        'Expense claim',
      );
    });

    it('keeps the dialog open and focuses Title when Done is pressed with no title', async () => {
      const { user } = renderApp('/templates/new');
      await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
      const dialog = within(detailsDialog());
      expect(dialog.queryByText('Give the form a title.')).not.toBeInTheDocument();

      await user.click(dialog.getByRole('button', { name: 'Done' }));

      const title = dialog.getByRole('textbox', { name: 'Title' });
      expect(title).toHaveFocus();
      expect(title).toBeInvalid();
      expect(title).toHaveAccessibleDescription('Give the form a title.');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Untitled template' }),
      ).toBeInTheDocument();
    });

    it('refuses a description over 500 characters and says so while typing', async () => {
      const { user } = renderApp('/templates/new');
      await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
      const dialog = within(detailsDialog());
      await user.type(dialog.getByRole('textbox', { name: 'Title' }), 'Expense claim');
      const description = dialog.getByRole('textbox', { name: /Description/ });
      await user.click(description);
      await user.paste('x'.repeat(501));

      expect(description).toBeInvalid();
      expect(description).toHaveAccessibleDescription(/Keep the description to 500 characters/);
      await user.click(dialog.getByRole('button', { name: 'Done' }));
      expect(description).toHaveFocus();
      expect(detailsDialog()).toBeInTheDocument();
    });
  });

  it('removes a field and moves focus to its neighbour', async () => {
    const saved = template([textField('Name'), textField('Email')]);
    createRepositories(localStorage).templates.put(saved);
    const { user } = renderApp(`/templates/${saved.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Remove Name' }));

    expect(canvas().queryByText('Name')).not.toBeInTheDocument();
    expect(canvas().getByRole('button', { name: /^Email/ })).toHaveFocus();
  });

  describe('removing a field others read (D-12)', () => {
    /** Amount, then Receipt number (required when Amount > 50), then Notes, already saved. */
    function expenseClaim() {
      const amount = numberField('Amount');
      const receipt = textField('Receipt number');
      const notes = textField('Notes');
      const onNotes = condition(notes.id, { kind: 'text', op: 'equals', value: 'see attached' });
      receipt.logic.require = group(
        'any',
        condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
        onNotes,
      );
      const saved = template([amount, receipt, notes]);
      createRepositories(localStorage).templates.put(saved);
      return { saved, onNotes };
    }

    function stored(id: FormTemplate['id']) {
      const snapshot = createRepositories(localStorage).templates.snapshot();
      return snapshot.ok ? snapshot.value.get(id) : undefined;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('asks before removing a field others read, naming them', async () => {
      const { saved } = expenseClaim();
      const { user } = renderApp(`/templates/${saved.id}/edit`);

      await user.click(await screen.findByRole('button', { name: 'Remove Amount' }));

      const dialog = within(screen.getByRole('dialog', { name: 'Remove Amount?' }));
      expect(
        dialog.getByText(
          'Other fields have conditions on Amount. Removing it also removes those conditions:',
        ),
      ).toBeVisible();
      expect(dialog.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Receipt number: 1 required condition',
      ]);
      expect(dialog.getByText('Their other conditions stay.')).toBeVisible();
      expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await expectNoAxeViolations(document.body);
    });

    it('keeps the field and returns focus to Remove on Cancel or Escape', async () => {
      const { saved } = expenseClaim();
      const { user } = renderApp(`/templates/${saved.id}/edit`);
      const remove = await screen.findByRole('button', { name: 'Remove Amount' });

      await user.click(remove);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(remove).toHaveFocus();

      await user.click(remove);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(remove).toHaveFocus();
      expect(canvas().getByRole('button', { name: /^Amount/ })).toBeInTheDocument();
    });

    it('removes the field and its conditions on confirm, focuses the neighbour and announces it', async () => {
      startFakeClock();
      const { saved, onNotes } = expenseClaim();
      const { user } = renderApp(`/templates/${saved.id}/edit`, {
        advanceTimers: vi.advanceTimersByTime,
      });

      await user.click(await screen.findByRole('button', { name: 'Remove Amount' }));
      await user.click(screen.getByRole('button', { name: 'Remove field and conditions' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(canvas().queryByRole('button', { name: /^Amount/ })).not.toBeInTheDocument();
      expect(canvas().getByRole('button', { name: /^Receipt number/ })).toHaveFocus();
      await settleAnnouncements();
      expect(screen.getByTestId('live-region')).toHaveTextContent(
        'Removed Amount and 1 condition on Receipt number.',
      );

      // The other condition stays, "any" included, and Save goes through with nothing to fix.
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText(/Last saved/);
      expect(stored(saved.id)?.fields.map((field) => field.logic)).toContainEqual(
        expect.objectContaining({ require: group('any', onNotes) }),
      );
    });

    it('removes a field nothing reads without asking', async () => {
      const { saved } = expenseClaim();
      const { user } = renderApp(`/templates/${saved.id}/edit`);

      await user.click(await screen.findByRole('button', { name: 'Remove Receipt number' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(canvas().getByRole('button', { name: /^Notes/ })).toHaveFocus();
    });
  });

  it('removes an option on confirm, together with the conditions that compare with it', async () => {
    const payment = singleSelectField('Payment', {
      config: { options: options('Card', 'Cash'), display: 'radio' },
    });
    const receipt = textField('Receipt number');
    receipt.logic.require = group(
      'all',
      condition(payment.id, {
        kind: 'choice',
        op: 'equals',
        value: payment.config.options[1]!.id,
      }),
    );
    const saved = template([payment, receipt]);
    createRepositories(localStorage).templates.put(saved);
    const { user } = renderApp(`/templates/${saved.id}/edit`);
    await user.click(await canvas().findByRole('button', { name: /^Payment/ }));

    await user.click(screen.getByRole('button', { name: 'Remove Cash' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Remove Cash?' }));
    expect(dialog.getByRole('listitem')).toHaveTextContent('Receipt number: 1 required condition');
    await user.click(dialog.getByRole('button', { name: 'Remove option and conditions' }));

    expect(screen.getByRole('textbox', { name: 'Option 1 label' })).toHaveFocus();
    await user.click(canvas().getByRole('button', { name: /^Receipt number/ }));
    expect(
      within(screen.getByRole('group', { name: 'Required conditions' })).getByText(
        'No conditions.',
      ),
    ).toBeInTheDocument();
    expect(canvas().getByRole('button', { name: /^Receipt number/ })).not.toHaveAccessibleName(
      /Conditional/,
    );
  });

  describe('warnings', () => {
    const storedUpdatedAt = (id: FormTemplate['id']) => {
      const snapshot = createRepositories(localStorage).templates.snapshot();
      return snapshot.ok ? snapshot.value.get(id)?.updatedAt : undefined;
    };

    /** Notes starts hidden with nothing showing it, and is optional with not-required conditions. */
    function withWarning() {
      const notes = textField('Notes');
      notes.logic.defaultVisible = false;
      const amount = numberField('Amount');
      notes.logic.unrequire = group(
        'all',
        condition(amount.id, { kind: 'number', op: 'lt', value: 10 }),
      );
      const saved = template([amount, notes]);
      createRepositories(localStorage).templates.put(saved);
      return saved;
    }

    it('saves a template whose fields have warnings', async () => {
      const saved = withWarning();
      const { user } = renderApp(`/templates/${saved.id}/edit`);
      await user.click(await canvas().findByRole('button', { name: /^Notes/ }));
      expect(screen.getByText(/respondents never see it/)).toBeVisible();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // An existing template always shows "Last saved", so the write itself is what counts.
      await waitFor(() => {
        expect(storedUpdatedAt(saved.id)).not.toBe(saved.updatedAt);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not count warnings as problems before saving', async () => {
      const saved = withWarning();
      const { user } = renderApp(`/templates/${saved.id}/edit`);

      await user.click(await canvas().findByRole('button', { name: /^Notes/ }));

      expect(canvas().getByRole('button', { name: /^Notes/ })).not.toHaveAccessibleName(
        /Needs attention/,
      );
    });
  });

  it('shows Not found for a template that does not exist', async () => {
    renderApp('/templates/00000000-0000-4000-8000-000000000000/edit');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows Not found for a malformed template ID', async () => {
    renderApp('/templates/not-an-id/edit');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
