import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ANNOUNCE_BATCH_MS, LiveRegionProvider } from './LiveRegion';
import { TOAST_DURATION_MS, ToastProvider, useNotify } from './Toast';
import { startFakeClock } from '../test/timers';

/** Two buttons standing in for a page that confirms successes. */
function Page() {
  const notify = useNotify();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          notify('Template saved');
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          notify('Deleted Travel.');
        }}
      >
        Delete
      </button>
    </>
  );
}

function renderPage() {
  const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
  render(
    <LiveRegionProvider>
      <ToastProvider>
        <Page />
      </ToastProvider>
    </LiveRegionProvider>,
  );
  return user;
}

// The toast is aria-hidden, so it has no role to query by; a test id finds its box.
const toast = () => screen.queryByTestId('toast');

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('Toast', () => {
  beforeEach(startFakeClock);
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message after notify, hidden from assistive technology', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(toast()).toHaveTextContent('Template saved');
    expect(toast()).toBeVisible();
    expect(toast()).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
  });

  it('announces the message once, through the app’s live region', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await advance(ANNOUNCE_BATCH_MS);

    expect(screen.getByTestId('live-region')).toHaveTextContent(/^Template saved$/);
  });

  it('disappears once its time is up', async () => {
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await advance(TOAST_DURATION_MS - 100);
    expect(toast()).toHaveTextContent('Template saved');

    await advance(100);
    expect(toast()).not.toBeInTheDocument();
  });

  it('replaces the current toast with a new one and restarts the timer', async () => {
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await advance(TOAST_DURATION_MS - 100);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getAllByTestId('toast')).toHaveLength(1);
    expect(toast()).toHaveTextContent('Deleted Travel.');
    expect(toast()).not.toHaveTextContent('Template saved');
    await advance(TOAST_DURATION_MS - 100);
    expect(toast()).toHaveTextContent('Deleted Travel.');
    await advance(100);
    expect(toast()).not.toBeInTheDocument();
  });

  it('stays while the pointer is over it and leaves a full timeout after the pointer does', async () => {
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await user.hover(toast()!);
    await advance(TOAST_DURATION_MS * 3);
    expect(toast()).toHaveTextContent('Template saved');

    await user.unhover(toast()!);
    await advance(TOAST_DURATION_MS - 100);
    expect(toast()).toBeInTheDocument();
    await advance(100);
    expect(toast()).not.toBeInTheDocument();
  });

  it('fails clearly when used outside a ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Page />)).toThrow('useNotify must be used inside <ToastProvider>');
  });
});
