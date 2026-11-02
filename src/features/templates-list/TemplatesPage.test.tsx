import { screen, waitFor, within } from '@testing-library/react';
import type { FormTemplate } from '../../domain/template';
import { QUARANTINE_PREFIX } from '../../storage/collection';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { renderApp } from '../../test/renderApp';
import { settleAnnouncements, startFakeClock } from '../../test/timers';
import { submittedResponse, template, textField } from '../../test/fixtures';
import { toIsoDateTime } from '../../domain/ids';

describe('Templates page', () => {
  it('shows the empty state when there are no templates', async () => {
    await renderApp('/');

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

    await renderApp('/');

    const card = (await screen.findByRole('heading', { name: 'Expense claim' })).closest('li')!;
    const scope = within(card);
    expect(scope.getByText('Claim back what you spent on company business.')).toBeInTheDocument();
    expect(scope.getByText('2 fields')).toBeInTheDocument();
    expect(scope.getByText(/Last edited/)).toBeInTheDocument();
    expect(
      scope.getByRole('link', { name: /^Open in builder\s*: Expense claim$/ }),
    ).toHaveAttribute('href', `/templates/${saved.id}/edit`);
  });

  it('links each card to its responses page, even before it has any', async () => {
    const saved = template([textField('Name')], 'Expense claim');
    createRepositories(localStorage).templates.put(saved);

    await renderApp('/');

    expect(
      await screen.findByRole('link', { name: /^View responses\s*: Expense claim$/ }),
    ).toHaveAttribute('href', `/templates/${saved.id}/responses`);
  });

  it('lists the most recently edited template first', async () => {
    const repositories = createRepositories(localStorage);
    const older = { ...template([], 'Older'), updatedAt: toIsoDateTime(new Date('2026-10-01')) };
    const newer = { ...template([], 'Newer'), updatedAt: toIsoDateTime(new Date('2026-10-30')) };
    repositories.templates.put(older);
    repositories.templates.put(newer);

    await renderApp('/');

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Newer', 'Older']);
  });

  it('shows an error naming the backup key when stored templates are corrupt, and does not overwrite them', async () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{bad');

    await renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Your saved data could not be read' }),
    ).toBeInTheDocument();
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(QUARANTINE_PREFIX))!;
    expect(screen.getByText(backupKey)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe('{bad');
    expect(localStorage.getItem(backupKey)).toBe('{bad');
  });

  it('lists the readable templates and says how many were set aside, naming the backup key', async () => {
    const good = template([textField('Name')], 'Expense claim');
    const raw = JSON.stringify({
      schemaVersion: 1,
      items: { [good.id]: good, broken: { title: 7 } },
    });
    localStorage.setItem(STORAGE_KEYS.templates, raw);

    await renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Expense claim' })).toBeVisible();
    const notice = screen.getByRole('region', { name: '1 saved template could not be read' });
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(QUARANTINE_PREFIX))!;
    expect(within(notice).getByText(backupKey)).toBeVisible();
    expect(localStorage.getItem(backupKey)).toBe(raw);
  });

  it('says how many responses were set aside, and still counts the readable ones', async () => {
    const claim = template([textField('Name')], 'Expense claim');
    const kept = submittedResponse(claim);
    createRepositories(localStorage).templates.put(claim);
    localStorage.setItem(
      STORAGE_KEYS.responses,
      JSON.stringify({ schemaVersion: 1, items: { [kept.id]: kept, a: null, b: 'x' } }),
    );

    await renderApp('/');

    expect(
      await screen.findByRole('region', { name: '2 saved responses could not be read' }),
    ).toBeVisible();
    const card = within(screen.getByRole('heading', { name: 'Expense claim' }).closest('li')!);
    expect(card.getByText('1 response')).toBeVisible();
  });

  it('starts again with an empty list once the corrupt data is backed up, keeping the backup', async () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{bad');
    const { user } = await renderApp('/');

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

    await renderApp('/');

    const card = (name: string) => within(screen.getByRole('heading', { name }).closest('li')!);
    await screen.findByRole('heading', { name: 'Expense claim' });
    expect(card('Expense claim').getByText('2 responses')).toBeInTheDocument();
    expect(card('Leave request').getByText('0 responses')).toBeInTheDocument();
  });

  it('opens a new response from the card', async () => {
    const saved = template([textField('Name')], 'Expense claim');
    createRepositories(localStorage).templates.put(saved);

    const { user } = await renderApp('/');
    await user.click(await screen.findByRole('link', { name: /^New response\s*: Expense claim$/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Expense claim' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeVisible();
  });

  it('disables New response with a reason for a template with no fields', async () => {
    createRepositories(localStorage).templates.put(template([], 'Empty form'));

    await renderApp('/');

    const button = await screen.findByRole('button', { name: /^New response\s*: Empty form$/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Add a field in the builder to collect responses.');
  });

  it('shows an error naming the backup key when stored responses are corrupt, and does not overwrite them', async () => {
    createRepositories(localStorage).templates.put(template([textField('Name')]));
    localStorage.setItem(STORAGE_KEYS.responses, '{bad');

    await renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Your saved data could not be read' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again with no responses' })).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEYS.responses)).toBe('{bad');
  });
});

describe('Deleting a template (D-22)', () => {
  const repositories = () => createRepositories(localStorage);
  const deleteDialog = (title: string) =>
    within(screen.getByRole('dialog', { name: `Delete ${title}?` }));
  const deleteButton = (title: string) =>
    screen.getByRole('button', { name: new RegExp(`^Delete\\s*: ${title}$`) });

  /** Cards are listed most recently edited first, so the hour sets the order: Travel, Office, Books. */
  function seed(responsesForTravel: number) {
    const at = (hour: number) => toIsoDateTime(new Date(`2026-11-01T${hour}:00:00Z`));
    const make = (title: string, hour: number): FormTemplate => ({
      ...template([textField('Name')], title),
      updatedAt: at(hour),
    });
    const [travel, office, books] = [make('Travel', 12), make('Office', 11), make('Books', 10)];
    [travel, office, books].forEach((form) => repositories().templates.put(form));
    for (let i = 0; i < responsesForTravel; i += 1)
      repositories().responses.put(submittedResponse(travel));
    repositories().responses.put(submittedResponse(office));
    return { travel, office, books };
  }

  const storedTitles = () => {
    const snapshot = repositories().templates.snapshot();
    return snapshot.ok ? [...snapshot.value.values()].map((form) => form.title).sort() : null;
  };
  const storedResponseCount = () => {
    const snapshot = repositories().responses.snapshot();
    return snapshot.ok ? snapshot.value.size : null;
  };

  it('asks first, stating how many responses go with it', async () => {
    seed(3);
    const { user } = await renderApp('/');

    await user.click(deleteButton('Travel'));

    const dialog = deleteDialog('Travel');
    expect(
      dialog.getByText('Its 3 responses will be deleted too. This can’t be undone.'),
    ).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Delete template and 3 responses' })).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('says so when a template has no responses', async () => {
    seed(0);
    const { user } = await renderApp('/');

    await user.click(deleteButton('Books'));

    const dialog = deleteDialog('Books');
    expect(dialog.getByText('It has no responses. This can’t be undone.')).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Delete template' })).toBeVisible();
  });

  it('keeps the template after Cancel, and returns focus to Delete', async () => {
    seed(3);
    const { user } = await renderApp('/');
    await user.click(deleteButton('Travel'));

    await user.click(deleteDialog('Travel').getByRole('button', { name: 'Cancel' }));

    expect(storedTitles()).toEqual(['Books', 'Office', 'Travel']);
    expect(storedResponseCount()).toBe(4);
    await waitFor(() => {
      expect(deleteButton('Travel')).toHaveFocus();
    });
  });

  it('removes the card and its responses, announces it, and focuses the next card’s title', async () => {
    startFakeClock();
    seed(3);
    const { user } = await renderApp('/', { advanceTimers: vi.advanceTimersByTime });
    await user.click(deleteButton('Travel'));

    await user.click(
      deleteDialog('Travel').getByRole('button', { name: 'Delete template and 3 responses' }),
    );

    expect(screen.queryByRole('heading', { name: 'Travel' })).not.toBeInTheDocument();
    expect(storedTitles()).toEqual(['Books', 'Office']);
    expect(storedResponseCount()).toBe(1);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Office' })).toHaveFocus();
    });
    await settleAnnouncements();
    expect(screen.getByTestId('live-region')).toHaveTextContent(
      'Deleted Travel and its 3 responses.',
    );
    vi.useRealTimers();
  });

  it('focuses the previous card’s title after deleting the last card in the list', async () => {
    seed(0);
    const { user } = await renderApp('/');
    await user.click(deleteButton('Books'));

    await user.click(deleteDialog('Books').getByRole('button', { name: 'Delete template' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Office' })).toHaveFocus();
    });
  });

  it('focuses "Create your first template" after deleting the only template', async () => {
    const only = template([textField('Name')], 'Only');
    repositories().templates.put(only);
    const { user } = await renderApp('/');
    await user.click(deleteButton('Only'));

    await user.click(deleteDialog('Only').getByRole('button', { name: 'Delete template' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create your first template' })).toHaveFocus();
    });
  });

  it('shows the storage error and keeps the card when the deletion cannot be written', async () => {
    seed(3);
    const { user } = await renderApp('/');
    await user.click(deleteButton('Travel'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    await user.click(
      deleteDialog('Travel').getByRole('button', { name: 'Delete template and 3 responses' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/storage is full/i);
    expect(screen.getByRole('heading', { name: 'Travel' })).toBeInTheDocument();
    expect(screen.getByTestId('live-region')).not.toHaveTextContent('Deleted');
  });
});
