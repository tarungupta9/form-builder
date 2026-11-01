import { useEffect } from 'react';

/** Names the browser tab and history entry after the page, as screen readers announce it on load. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} – Form builder`;
  }, [title]);
}
