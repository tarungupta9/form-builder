/**
 * The v0.2 demo script (docs/implementation-plan.md), run end to end through the real app.
 * Only the VoiceOver checks stay manual.
 */
import { screen, waitFor, within } from '@testing-library/react';
import type { FormResponse } from '../../domain/response';
import { createRepositories } from '../../storage/repositories';
import { template, textField } from '../fixtures';
import { chooseCardAction } from '../cardMenu';
import { renderApp } from '../renderApp';

const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);

function storedResponses(): FormResponse[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

describe('v0.2 demo: fill and submit', () => {
  it('fills in a form, recovers from a failed submit, submits, and keeps the snapshot after an edit', async () => {
    const name = textField('Employee name');
    name.logic.defaultRequired = true;
    const claim = template([name, textField('Notes')], 'Expense claim');
    createRepositories(localStorage).templates.put(claim);
    const { user } = await renderApp('/');

    // 1. Open "Expense claim" → New response. Submit empty: the error summary takes focus.
    await user.click(await card('Expense claim').findByRole('link', { name: /^New response/ }));
    await user.click(await screen.findByRole('button', { name: 'Submit response' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveFocus();
    });

    // 2. Follow the error link: focus lands on the field. Type a value: the error clears.
    await user.click(screen.getByRole('button', { name: 'Enter an answer for Employee name' }));
    const answer = screen.getByRole('textbox', { name: /Employee name/ });
    expect(answer).toHaveFocus();
    await user.type(answer, 'Ada Lovelace');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // 3. Submit: a confirmation appears. Home shows "1 response".
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'All templates' }));
    expect(await card('Expense claim').findByText('1 response')).toBeInTheDocument();

    // 4. Rename the field in the builder and save: the earlier response keeps the old label.
    await chooseCardAction(user, 'Expense claim', 'Open in builder');
    await user.click(await screen.findByRole('button', { name: /^Employee name/ }));
    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'Full name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    const [response] = storedResponses();
    expect(response?.status === 'submitted' && response.snapshot.fields[0]?.label).toBe(
      'Employee name',
    );
  });

  it('disables New response, with the reason, for a template with no fields', async () => {
    createRepositories(localStorage).templates.put(template([], 'Empty form'));

    await renderApp('/');

    const button = await card('Empty form').findByRole('button', { name: /^New response/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Add a field in the builder to collect responses.');
  });
});
