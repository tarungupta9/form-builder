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
