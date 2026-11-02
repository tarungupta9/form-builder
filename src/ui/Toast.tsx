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
import { Icon } from './icons';
import { useAnnounce } from './LiveRegion';
import styles from './Toast.module.css';

type Notify = (message: string) => void;

const NotifyContext = createContext<Notify | null>(null);

/** How long a toast stays on screen once the pointer is not over it. */
export const TOAST_DURATION_MS = 4000;

interface ShownToast {
  /** Changes on every notify, so a replacing toast remounts and replays its entrance. */
  id: number;
  message: string;
}

/**
 * Confirms a success to sighted users with a short-lived toast (ADR 0022). Screen readers hear
 * the same message once, through the app's one live region; the toast itself is `aria-hidden`
 * and holds no controls, so it never takes focus and its timeout hides nothing anyone needs:
 * the page keeps a lasting record ("Last saved", the card gone from the list).
 *
 * Mount it inside `LiveRegionProvider` and around the router, so a toast outlives navigation.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const announce = useAnnounce();
  const [toast, setToast] = useState<ShownToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);

  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timer.current = setTimeout(() => {
      hovered.current = false;
      setToast(null);
    }, TOAST_DURATION_MS);
  }, [stopTimer]);

  const notify = useCallback<Notify>(
    (message) => {
      if (!message) return;
      announce(message);
      setToast((current) => ({ id: (current?.id ?? 0) + 1, message }));
      // A toast that replaces one under the pointer waits for the pointer to leave, like the first.
      if (hovered.current) stopTimer();
      else startTimer();
    },
    [announce, startTimer, stopTimer],
  );

  useEffect(() => stopTimer, [stopTimer]);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      {toast && (
        <div className={styles.viewport}>
          {/* Hover pauses the timer, so a slow reader can stop the toast leaving mid-sentence. */}
          <div
            aria-hidden="true"
            className={styles.toast}
            data-testid="toast"
            onPointerEnter={() => {
              hovered.current = true;
              stopTimer();
            }}
            onPointerLeave={() => {
              hovered.current = false;
              startTimer();
            }}
          >
            <div key={toast.id} className={styles.content}>
              <Icon name="check" className={styles.icon} />
              <span>{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  );
}

/** Confirms a success: announces `message` and shows it as a toast. Errors stay inline alerts. */
export function useNotify(): Notify {
  const notify = useContext(NotifyContext);
  if (!notify) throw new Error('useNotify must be used inside <ToastProvider>');
  return notify;
}
