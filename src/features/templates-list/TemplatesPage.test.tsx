import { screen, within } from '@testing-library/react';
import { QUARANTINE_PREFIX } from '../../storage/collection';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { renderApp } from '../../test/renderApp';
import { submittedResponse, template, textField } from '../../test/fixtures';
import { toIsoDateTime } from '../../domain/ids';

describe('Templates page', () => {
  it('shows the empty state when there are no templates', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Create your first template' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New template' })[0]).toHaveAttribute(
      'href',
      '/templates/new',
    );
  });

  it('shows each template with its title, description, field count and last edit', async () => {
    const saved = {
      ...template([textField('Name'), textField('Email')], 'Expense claim'),
      description: 'Claim back what you spent on company business.',
    };
    createRepositories(localStorage).templates.put(saved);

    renderApp('/');

    const card = (await screen.findByRole('heading', { name: 'Expense claim' })).closest('li')!;
    const scope = within(card);
    expect(scope.getByText('Claim back what you spent on company business.')).toBeInTheDocument();
    expect(scope.getByText('2 fields')).toBeInTheDocument();
    expect(scope.getByText(/Last edited/)).toBeInTheDocument();
    expect(
      scope.getByRole('link', { name: /^Open in builder\s*: Expense claim$/ }),
    ).toHaveAttribute('href', `/templates/${saved.id}/edit`);
  });

  it('lists the most recently edited template first', async () => {
    const repositories = createRepositories(localStorage);
    const older = { ...template([], 'Older'), updatedAt: toIsoDateTime(new Date('2026-10-01')) };
    const newer = { ...template([], 'Newer'), updatedAt: toIsoDateTime(new Date('2026-10-30')) };
    repositories.templates.put(older);
    repositories.templates.put(newer);

    renderApp('/');

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Newer', 'Older']);
  });

  it('shows an error naming the backup key when stored templates are corrupt, and does not overwrite them', async () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{bad');

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Your saved data could not be read' }),
    ).toBeInTheDocument();
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(QUARANTINE_PREFIX))!;
    expect(screen.getByText(backupKey)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe('{bad');
    expect(localStorage.getItem(backupKey)).toBe('{bad');
  });

  it('starts again with an empty list once the corrupt data is backed up, keeping the backup', async () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{bad');
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Start again with no templates' }));

    expect(
      await screen.findByRole('heading', { name: 'Create your first template' }),
    ).toBeInTheDocument();
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(QUARANTINE_PREFIX))!;
    expect(localStorage.getItem(backupKey)).toBe('{bad');
  });

  it('counts each template’s submitted responses on its card', async () => {
    const repositories = createRepositories(localStorage);
    const claim = template([textField('Name')], 'Expense claim');
    const leave = template([textField('Dates')], 'Leave request');
    repositories.templates.put(claim);
    repositories.templates.put(leave);
    repositories.responses.put(submittedResponse(claim));
    repositories.responses.put(submittedResponse(claim));

    renderApp('/');

    const card = (name: string) => within(screen.getByRole('heading', { name }).closest('li')!);
    await screen.findByRole('heading', { name: 'Expense claim' });
    expect(card('Expense claim').getByText('2 responses')).toBeInTheDocument();
    expect(card('Leave request').getByText('0 responses')).toBeInTheDocument();
  });

  it('opens a new response from the card', async () => {
    const saved = template([textField('Name')], 'Expense claim');
    createRepositories(localStorage).templates.put(saved);

    const { user } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: /^New response\s*: Expense claim$/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Expense claim' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeVisible();
  });

  it('disables New response with a reason for a template with no fields', async () => {
    createRepositories(localStorage).templates.put(template([], 'Empty form'));

    renderApp('/');

    const button = await screen.findByRole('button', { name: /^New response\s*: Empty form$/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Add a field in the builder to collect responses.');
  });

  it('shows an error naming the backup key when stored responses are corrupt, and does not overwrite them', async () => {
    createRepositories(localStorage).templates.put(template([textField('Name')]));
    localStorage.setItem(STORAGE_KEYS.responses, '{bad');

    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Your saved data could not be read' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again with no responses' })).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEYS.responses)).toBe('{bad');
  });
});
