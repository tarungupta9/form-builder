/**
 * Navigation state for a URL change that is not a new page, such as the builder replacing
 * `/templates/new` with the saved template's own URL. The app shell leaves focus where it is
 * for these, instead of moving it to the page heading.
 */
export const KEEP_FOCUS = { keepFocus: true } as const;

export function keepsFocus(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'keepFocus' in state;
}
