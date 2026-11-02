import type { UIMatch } from 'react-router';

/**
 * How the app shell lays out a page. `document` is the default: a centred column that scrolls
 * with the window. `workspace` fills the viewport, and the page scrolls its own panels instead
 * (ADR 0021); the builder uses it so the field list stays in view while a long settings panel
 * scrolls.
 */
export type PageLayout = 'document' | 'workspace';

/** What a route may put in its `handle`. React Router types `handle` as `unknown`. */
export interface RouteHandle {
  layout: PageLayout;
}

export const WORKSPACE_ROUTE: RouteHandle = { layout: 'workspace' };

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'layout' in handle &&
    (handle.layout === 'document' || handle.layout === 'workspace')
  );
}

/** The deepest matched route that names a layout wins, so a child can override its parent. */
export function pageLayoutOf(matches: readonly Pick<UIMatch, 'handle'>[]): PageLayout {
  for (let index = matches.length - 1; index >= 0; index--) {
    const handle = matches[index]?.handle;
    if (isRouteHandle(handle)) return handle.layout;
  }
  return 'document';
}
