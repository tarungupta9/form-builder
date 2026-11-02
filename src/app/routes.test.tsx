import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../test/renderApp';

describe('routing', () => {
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

  it('moves focus to the new page’s heading after navigating', async () => {
    const { user } = await renderApp('/');

    await user.click((await screen.findAllByRole('link', { name: 'New template' }))[0]!);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Untitled template' }),
    ).toHaveFocus();
  });
});
