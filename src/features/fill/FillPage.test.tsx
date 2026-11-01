import { screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { newTemplateId } from '../../domain/ids';
import type { FormResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { template, textField } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

function saveTemplate(form: FormTemplate): FormTemplate {
  createRepositories(localStorage).templates.put(form);
  return form;
}

function storedResponses(): FormResponse[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

/** Another tab writes to storage: the change lands, then the browser fires `storage` here. */
function changeInAnotherTab(write: () => void) {
  write();
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.templates }));
}

const expenseClaim = () => {
  const name = textField('Employee name');
  name.logic.defaultRequired = true;
  const purpose = textField('Purpose');
  purpose.logic.defaultRequired = true;
  const notes = textField('Notes');
  return {
    form: { ...template([name, purpose, notes], 'Expense claim'), description: 'Travel only.' },
    name,
  };
};

describe('Fill page', () => {
  it('shows the form’s title, description and every field', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);

    renderApp(`/templates/${form.id}/respond`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible();
    expect(screen.getByText('Travel only.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Employee name/ })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Notes' })).not.toBeRequired();
  });

  it('blocks submit and focuses the error summary when a required field is empty', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);

    await user.click(await screen.findByRole('button', { name: 'Submit response' }));

    const summary = await screen.findByRole('alert');
    await waitFor(() => {
      expect(summary).toHaveFocus();
    });
    expect(
      within(summary).getByRole('heading', { name: 'Fix 2 problems before submitting' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Employee name/ })).toHaveAccessibleDescription(
      'Error: Enter an answer for Employee name',
    );
    expect(storedResponses()).toEqual([]);
  });

  it('moves focus to the field when its error link is followed', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('button', { name: 'Submit response' }));

    await user.click(screen.getByRole('button', { name: 'Enter an answer for Purpose' }));

    expect(screen.getByRole('textbox', { name: /Purpose/ })).toHaveFocus();
  });

  it('clears an error as soon as the field is fixed after a failed submit', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('button', { name: 'Submit response' }));
    const name = screen.getByRole('textbox', { name: /Employee name/ });

    await user.type(name, 'A');

    expect(name).not.toHaveAccessibleDescription(/Error/);
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('heading', { name: 'Fix 1 problem before submitting' })).toBeVisible();
  });

  it('does not show errors while the respondent is still typing, before any submit', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);

    await user.type(await screen.findByRole('textbox', { name: /Notes/ }), 'Hi');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('submits, stores a snapshot of the form, and confirms with focus on the outcome', async () => {
    const { form, name } = expenseClaim();
    saveTemplate(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.type(await screen.findByRole('textbox', { name: /Employee name/ }), 'Ada');
    await user.type(screen.getByRole('textbox', { name: /Purpose/ }), 'Conference');

    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toHaveFocus();
    const [response] = storedResponses();
    expect(response).toMatchObject({
      status: 'submitted',
      templateId: form.id,
      snapshot: { title: 'Expense claim', description: 'Travel only.', fields: form.fields },
    });
    expect(response?.status === 'submitted' && response.answers[name.id]).toEqual({
      kind: 'text',
      value: 'Ada',
    });
  });

  it('starts a fresh, empty form after “Fill in another response”', async () => {
    const notes = textField('Notes');
    const form = saveTemplate(template([notes]));
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.type(await screen.findByRole('textbox', { name: 'Notes' }), 'First');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    await user.click(await screen.findByRole('button', { name: 'Fill in another response' }));

    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('keeps the answers and shows "Storage is full" when submitting hits the quota', async () => {
    const notes = textField('Notes');
    const form = saveTemplate(template([notes]));
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.type(await screen.findByRole('textbox', { name: 'Notes' }), 'Keep me');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Keep me');
  });

  it('keeps the form as it was opened when the template is changed in another tab', async () => {
    const notes = textField('Notes');
    const form = saveTemplate(template([notes]));
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.type(await screen.findByRole('textbox', { name: 'Notes' }), 'Typed');

    changeInAnotherTab(() => {
      saveTemplate({ ...form, fields: [{ ...notes, label: 'Comments' }] });
    });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toBeVisible();
    const [response] = storedResponses();
    expect(response?.status === 'submitted' && response.snapshot.fields[0]?.label).toBe('Notes');
  });

  it('refuses to submit, keeping the answers, when the template was deleted in another tab', async () => {
    const notes = textField('Notes');
    const form = saveTemplate(template([notes]));
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.type(await screen.findByRole('textbox', { name: 'Notes' }), 'Typed');

    changeInAnotherTab(() => {
      createRepositories(localStorage).templates.remove([form.id]);
    });
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This form was deleted');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Typed');
    expect(storedResponses()).toEqual([]);
  });

  it('explains that a template with no fields cannot be filled in yet', async () => {
    const form = saveTemplate(template([]));

    renderApp(`/templates/${form.id}/respond`);

    expect(
      await screen.findByRole('heading', { name: 'This form has no fields yet' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in builder' })).toHaveAttribute(
      'href',
      `/templates/${form.id}/edit`,
    );
  });

  it('shows Not found for a template that does not exist', async () => {
    renderApp(`/templates/${newTemplateId()}/respond`);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('shows Not found for a malformed template ID', async () => {
    renderApp('/templates/not-an-id/respond');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('names the page after the form', async () => {
    const form = saveTemplate(template([textField('Notes')], 'Expense claim'));

    renderApp(`/templates/${form.id}/respond`);

    await waitFor(() => {
      expect(document.title).toBe('New response: Expense claim – Form builder');
    });
  });

  it('has no axe violations in its empty, failed-submit and submitted states', async () => {
    const { form } = expenseClaim();
    saveTemplate(form);
    const { user, container } = renderApp(`/templates/${form.id}/respond`);
    // jsdom does no layout, so contrast is checked by hand against the tokens instead.
    const violations = async () =>
      (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations;

    await screen.findByRole('button', { name: 'Submit response' });
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await violations()).toEqual([]);

    await user.type(screen.getByRole('textbox', { name: /Employee name/ }), 'Ada');
    await user.type(screen.getByRole('textbox', { name: /Purpose/ }), 'Conference');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });
    expect(await violations()).toEqual([]);
  });
});
