import { render } from '@testing-library/react';
import userEvent, { type Options } from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { App } from '../app/App';
import { routes } from '../app/routes';
import { createRepositories } from '../storage/repositories';

interface RenderAppOptions {
  /** A test on the fake clock (`test/timers.ts`) passes `vi.advanceTimersByTime` here. */
  advanceTimers?: Options['advanceTimers'];
}

/**
 * Renders the real app at `path`, over the test's `localStorage`. Each call creates fresh
 * repositories, so rendering again after `unmount()` behaves like a full page refresh: nothing
 * survives except what was written to storage.
 */
export function renderApp(path = '/', { advanceTimers }: RenderAppOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // `delay: null` types without a timer per keystroke; the flows assert on outcomes, not pacing.
  const user = userEvent.setup({ delay: null, ...(advanceTimers ? { advanceTimers } : {}) });
  const view = render(<App repositories={createRepositories(localStorage)} router={router} />);
  return { ...view, router, user };
}
