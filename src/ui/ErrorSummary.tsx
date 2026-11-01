import type { ReactNode, RefObject } from 'react';
import styles from './ErrorSummary.module.css';

export interface ErrorSummaryItem {
  key: string;
  label: ReactNode;
  /** Takes the user to the thing to fix. */
  onSelect: () => void;
}

interface ErrorSummaryProps {
  /** For focusing the summary by ID (`useFocusRequest`) or by ref. */
  id?: string;
  ref?: RefObject<HTMLDivElement | null>;
  title: string;
  items: readonly ErrorSummaryItem[];
}

/**
 * Every problem that blocked an action, each one a way to the thing to fix (the GOV.UK error
 * summary pattern). The caller focuses it once it appears, so the user hears why nothing
 * happened. The items are buttons, not `#id` links: the hash router owns the URL fragment.
 */
export function ErrorSummary({ id, ref, title, items }: ErrorSummaryProps) {
  return (
    <div id={id} ref={ref} role="alert" tabIndex={-1} className={styles.box}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key}>
            <button type="button" className={styles.link} onClick={item.onSelect}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An action that failed for a reason outside the user's input, such as full storage. */
export function FailureAlert({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className={styles.box}>
      <h2 className={styles.title}>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
