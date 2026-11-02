import { Suspense, useLayoutEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import styles from './AppShell.module.css';
import { keepsFocus } from './navigation';
import { PageLoading } from './PageLoading';

/**
 * The frame around every page: a skip link, the header and the main landmark.
 *
 * A client-side navigation does not move focus or tell a screen reader anything, so after
 * each one focus goes to the new page's `<h1>`. That reads the page name and puts keyboard
 * users at the top of the new content. The first render is left alone: on a fresh page load
 * the browser's own behaviour is the expected one.
 *
 * Pages other than the home page load on first visit (ADR 0017). The router applies each
 * navigation in a transition, so in the app the old page stays until the new one is ready and
 * its `<h1>` exists to take focus; the loading status shows only on a cold load or refresh.
 */
export function AppShell() {
  const location = useLocation();
  const { pathname } = location;
  // Navigation state is whatever the caller passed, so it is narrowed before use.
  const state: unknown = location.state;
  const main = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // A layout effect, so focus moves in the same commit as the new page and never lands after
  // the user (or a test) has started typing in it, which a lazily loaded page made possible.
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (keepsFocus(state)) return;
    main.current?.querySelector<HTMLElement>('h1')?.focus();
    // Only a new path is a new page; `state` is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Form builder
        </Link>
      </header>
      <main id="main" ref={main} className={styles.main}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
