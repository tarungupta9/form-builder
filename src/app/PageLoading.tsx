import styles from './AppShell.module.css';

/**
 * Shown while a page's code loads. It is a status, so a screen reader hears it; the text fades
 * in only after a moment, so a fast load does not flash it on screen.
 */
export function PageLoading() {
  return (
    <p role="status" className={styles.loading}>
      Loading the page…
    </p>
  );
}
