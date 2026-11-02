/**
 * A fake clock for tests that wait on the app's own timers: the settle wait before Fill speaks
 * a change, and the live region's batch window. Advancing it is instant, so those waits cost no
 * real time and cannot run out under a loaded machine.
 *
 * Only `setTimeout` and `clearTimeout` are faked. React's scheduler and `Date` stay real, so
 * rendering and timestamps behave as in the browser. `shouldAdvanceTime` keeps the fake clock
 * moving with real time as well: Testing Library only recognises Jest's fake timers, so its
 * `findBy*` and `waitFor` poll with `setTimeout` and would otherwise never get a tick.
 *
 * Pair it with `renderApp(path, { advanceTimers: vi.advanceTimersByTime })`, so user-event's
 * own delays move the same clock, and restore real timers in `afterEach`.
 */
import { act } from '@testing-library/react';
import { SETTLE_MS } from '../features/fill/useVisibilityAnnouncements';
import { ANNOUNCE_BATCH_MS } from '../ui/LiveRegion';

export function startFakeClock(): void {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
}

/** Runs out Fill's settle wait and the live region's batch window, so the message is spoken. */
export async function settleAnnouncements(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS + ANNOUNCE_BATCH_MS));
}
