import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce | null>(null);

/** How long to wait for more messages before speaking, so typing never floods a screen reader. */
export const ANNOUNCE_BATCH_MS = 250;

/**
 * One polite live region for the whole app. Messages that arrive close together are joined
 * into one announcement. Repeating the same message still re-announces it, because the region
 * is cleared before each update.
 */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((next) => {
    if (!next) return;
    pending.current.push(next);
    if (timer.current) clearTimeout(timer.current);
    setMessage('');
    timer.current = setTimeout(() => {
      setMessage([...new Set(pending.current)].join('. '));
      pending.current = [];
    }, ANNOUNCE_BATCH_MS);
  }, []);

  // A message still waiting when the app goes away (a route change in tests, a closed tab) is
  // dropped, so the timer never fires into a torn-down page.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
        data-testid="live-region"
      >
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext);
  if (!announce) throw new Error('useAnnounce must be used inside <LiveRegionProvider>');
  return announce;
}
