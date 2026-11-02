import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { createRepositories } from '../storage/repositories';
import { template, textField } from '../test/fixtures';
import { renderApp } from '../test/renderApp';
import { App } from './App';
import { routes } from './routes';

describe('routing', () => {
  // First in the file: each lazy page loads once per test file, and only its first render waits.
  it('shows a loading status while a page’s code loads, then the page', async () => {
    const form = template([textField('Name')], 'Travel');
    const repositories = createRepositories(localStorage);
    repositories.templates.put(form);
    const router = createMemoryRouter(routes, {
      initialEntries: [`/templates/${form.id}/responses`],
    });

    render(<App repositories={repositories} router={router} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading the page…');
    expect(await screen.findByRole('heading', { level: 1, name: /Travel/ })).toBeInTheDocument();
    expect(screen.queryByText('Loading the page…')).not.toBeInTheDocument();
  });

  it('shows Not found for an unknown URL, with a way back', async () => {
    await renderApp('/nowhere');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your templates' })).toHaveAttribute('href', '/');
  });

  it('names the page in the document title', async () => {
    await renderApp('/templates/new');

    await waitFor(() => {
      expect(document.title).toBe('New template – Form builder');
    });
  });

  it('lays the builder out as a workspace and other pages as documents (ADR 0021)', async () => {
    const { user } = await renderApp('/');
    expect(screen.getByRole('main')).toHaveAttribute('data-layout', 'document');

    await user.click((await screen.findAllByRole('link', { name: 'New template' }))[0]!);

    await screen.findByRole('heading', { level: 1, name: 'Untitled template' });
    expect(screen.getByRole('main')).toHaveAttribute('data-layout', 'workspace');
  });

  it('moves focus to the new page’s heading after navigating', async () => {
    const { user } = await renderApp('/');

    await user.click((await screen.findAllByRole('link', { name: 'New template' }))[0]!);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Untitled template' }),
    ).toHaveFocus();
  });
});
