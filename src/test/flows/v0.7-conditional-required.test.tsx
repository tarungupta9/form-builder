/**
 * The v0.7 demo script (docs/implementation-plan.md), run through the real app in three parts:
 * build "Receipt number is required when Amount > 50" and keep it after a refresh; submit with
 * 60 and with 40; then remove Amount, see the dialog name Receipt number, and find its
 * condition gone. Each part seeds what it needs, and the announcements run on a fake clock
 * (`test/timers.ts`), so waiting for them costs no real time.
 *
 * Manual only: building the condition by keyboard alone, VoiceOver reading the summary
 * sentence, the warnings and the dialog, and the dialog's real modal focus trap in Chrome and
 * Safari (jsdom's `showModal` stand-in does not make the page behind it inert).
 */
import { screen, within } from '@testing-library/react';
import type { FormResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { createRepositories } from '../../storage/repositories';
import { condition, group, numberField, template, textField } from '../fixtures';
import { renderApp } from '../renderApp';
import { settleAnnouncements, startFakeClock } from '../timers';

const repositories = () => createRepositories(localStorage);
const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const requireGroup = () => within(screen.getByRole('group', { name: 'Required conditions' }));
const requiredSection = () => screen.getByRole('region', { name: 'Required' });
const spoken = () => screen.getByTestId('live-region');
const receiptBox = () => screen.getByRole('textbox', { name: /^Receipt number/ });
const amountBox = () => screen.getByRole('textbox', { name: /^Amount/ });

function storedTemplates(): FormTemplate[] {
  const snapshot = repositories().templates.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

function storedResponses(): FormResponse[] {
  const snapshot = repositories().responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

/** The claim before and after step 1: Amount, then Receipt number, optional unless over 50. */
function expenseClaim({ withCondition }: { withCondition: boolean }) {
  const amount = numberField('Amount');
  const receipt = textField('Receipt number');
  if (withCondition) {
    receipt.logic.require = group(
      'all',
      condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
    );
  }
  const form = template([amount, receipt], 'Expense claim');
  repositories().templates.put(form);
  return { form, amount, receipt };
}

describe('v0.7 demo: conditional required and safe editing', () => {
  beforeEach(() => {
    startFakeClock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds "Receipt number is required when Amount > 50", and keeps it after a refresh', async () => {
    const { form, amount } = expenseClaim({ withCondition: false });
    const { user, unmount } = renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });

    await user.click(await canvas().findByRole('button', { name: /^Receipt number/ }));
    expect(requiredSection()).toHaveAccessibleDescription('Optional.');
    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));
    expect(
      requireGroup().getByRole('combobox', { name: 'Required condition 1: field' }),
    ).toHaveDisplayValue('Field 1, Amount');
    await user.selectOptions(
      requireGroup().getByRole('combobox', { name: 'Required condition 1: operator' }),
      'is greater than',
    );
    await user.type(
      requireGroup().getByRole('textbox', { name: 'Required condition 1: value' }),
      '50',
    );
    expect(requiredSection()).toHaveAccessibleDescription(
      'Optional, and required when all of its required conditions match.',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    // A full refresh: what was saved is exactly the condition the other parts run on.
    unmount();
    const { user: author } = renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    await author.click(await canvas().findByRole('button', { name: /^Receipt number/ }));
    expect(requiredSection()).toHaveAccessibleDescription(
      'Optional, and required when all of its required conditions match.',
    );
    const [saved] = storedTemplates();
    expect(saved?.fields[1]?.logic).toMatchObject({
      defaultRequired: false,
      require: {
        match: 'all',
        conditions: [
          { targetFieldId: amount.id, predicate: { kind: 'number', op: 'gt', value: 50 } },
        ],
      },
    });
  });

  it('requires Receipt number at 60 and not at 40 (demo submit)', async () => {
    const { form, amount, receipt } = expenseClaim({ withCondition: true });
    const { user } = renderApp(`/templates/${form.id}/respond`, {
      advanceTimers: vi.advanceTimersByTime,
    });

    await user.type(await screen.findByRole('textbox', { name: /^Amount/ }), '60');
    await settleAnnouncements();
    expect(receiptBox()).toBeRequired();
    expect(spoken()).toHaveTextContent('Receipt number is now required.');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter an answer for Receipt number',
    );

    await user.clear(amountBox());
    await user.type(amountBox(), '40');
    await settleAnnouncements();
    expect(receiptBox()).not.toBeRequired();
    expect(spoken()).toHaveTextContent('Receipt number is no longer required.');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });

    const [response] = storedResponses();
    expect(response?.status === 'submitted' && response.answers).toEqual({
      [amount.id]: { kind: 'number', input: '40' },
    });
    expect(response?.status === 'submitted' && response.answers[receipt.id]).toBeFalsy();
  });

  it('removing Amount names Receipt number, and its condition is gone afterwards (demo delete)', async () => {
    const { form } = expenseClaim({ withCondition: true });
    const { user } = renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    const remove = await screen.findByRole('button', { name: 'Remove Amount' });

    await user.click(remove);
    const dialog = within(screen.getByRole('dialog', { name: 'Remove Amount?' }));
    expect(dialog.getByRole('listitem')).toHaveTextContent('Receipt number: 1 required condition');
    expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(canvas().getByRole('button', { name: /^Amount/ })).toBeInTheDocument();
    expect(remove).toHaveFocus();

    await user.click(remove);
    await user.click(screen.getByRole('button', { name: 'Remove field and conditions' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const receiptItem = canvas().getByRole('button', { name: /^Receipt number/ });
    expect(receiptItem).toHaveFocus();
    await settleAnnouncements();
    expect(spoken()).toHaveTextContent('Removed Amount and 1 condition on Receipt number.');

    await user.click(receiptItem);
    expect(requireGroup().getByText('No conditions.')).toBeInTheDocument();
    expect(requiredSection()).toHaveAccessibleDescription('Optional.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const [saved] = storedTemplates();
    expect(saved?.fields.map((field) => field.label)).toEqual(['Receipt number']);
    expect(saved?.fields[0]?.logic).toMatchObject({ require: { match: 'all', conditions: [] } });
  });
});
