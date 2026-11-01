import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { App } from '../app/App';
import { routes } from '../app/routes';
import { createRepositories } from '../storage/repositories';

/**
 * Renders the real app at `path`, over the test's `localStorage`. Each call creates fresh
 * repositories, so rendering again after `unmount()` behaves like a full page refresh: nothing
 * survives except what was written to storage.
 */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const view = render(<App repositories={createRepositories(localStorage)} router={router} />);
  return { ...view, router, user };
}
