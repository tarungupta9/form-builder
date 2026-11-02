import { act, render, screen } from '@testing-library/react';
import userEvent, { type Options } from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { App } from '../app/App';
import { routes } from '../app/routes';
import { createRepositories } from '../storage/repositories';

const PAGE_LOAD_TIMEOUT_MS = 10_000;

interface RenderAppOptions {
  /** A test on the fake clock (`test/timers.ts`) passes `vi.advanceTimersByTime` here. */
  advanceTimers?: Options['advanceTimers'];
}

/**
 * Renders the real app at `path`, over the test's `localStorage`. Each call creates fresh
 * repositories, so rendering again after `unmount()` behaves like a full page refresh: nothing
 * survives except what was written to storage.
 *
 * It resolves once the page's `<h1>` is on screen and the page's effects have run. Every page
 * and the not-found view has an `<h1>`, and waiting for it lets a test query a lazily loaded
 * route as soon as `renderApp` returns. A page that loads lazily can show its `<h1>` before its
 * effects run, so a test could otherwise act before a listener is attached, as no user could.
 */
export async function renderApp(path = '/', { advanceTimers }: RenderAppOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // `delay: null` types without a timer per keystroke; the flows assert on outcomes, not pacing.
  const user = userEvent.setup({ delay: null, ...(advanceTimers ? { advanceTimers } : {}) });
  const view = render(<App repositories={createRepositories(localStorage)} router={router} />);
  // The first lazy page in a test file is transformed on import, which can outlast the default
  // one-second wait when the whole suite runs in parallel.
  await screen.findByRole('heading', { level: 1 }, { timeout: PAGE_LOAD_TIMEOUT_MS });
  await act(() => Promise.resolve());
  return { ...view, router, user };
}
