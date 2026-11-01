import type { IsoDateTime } from '../domain/ids';

/** "1 field", "3 fields". */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** A stored instant in the user's locale and time zone, such as "1 Nov 2026, 14:05". */
export function formatDateTime(value: IsoDateTime): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * When a response was submitted, for its record and PDF: "1 November 2026 at 09:30 GMT". The
 * viewer's own time zone, named, so a re-download in another zone is still unambiguous.
 * (`Intl` refuses `dateStyle` together with `timeZoneName`, hence the separate parts.)
 */
export function formatSubmittedAt(value: IsoDateTime): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}
