import styles from './AppShell.module.css';

/**
 * Shown instead of the whole app when rendering throws. It does not depend on the router or
 * storage, which may be what failed, so it offers a plain reload and a link home.
 */
export function RouteError() {
  return (
    <main className={styles.main}>
      <h1>Something went wrong</h1>
      <p>
        The page could not be shown. Your saved templates are not affected.{' '}
        <a href="./">Go to your templates</a>
      </p>
    </main>
  );
}
