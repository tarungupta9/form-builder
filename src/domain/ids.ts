/**
 * Branded identifiers and timestamps.
 *
 * A brand is a property that exists only in the type checker, so a `FieldId` cannot be passed
 * where an `OptionId` is expected even though both are UUID strings at runtime. Branded values
 * are only minted here (fresh IDs, today's date) or by a parser that has checked the shape, so
 * an unchecked string from a URL or from storage cannot be used until it has been parsed.
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TemplateId = Brand<string, 'TemplateId'>;
export type FieldId = Brand<string, 'FieldId'>;
export type OptionId = Brand<string, 'OptionId'>;
export type ConditionId = Brand<string, 'ConditionId'>;
export type ResponseId = Brand<string, 'ResponseId'>;
/** A calendar date, `YYYY-MM-DD`, in the user's local time zone (D-16). */
export type IsoDate = Brand<string, 'IsoDate'>;
/** An instant, full ISO-8601 in UTC, as produced by `Date.prototype.toISOString`. */
export type IsoDateTime = Brand<string, 'IsoDateTime'>;

// The module's one cast: every exported constructor below checks the shape before calling it.
function asBrand<B extends string>(value: string): Brand<string, B> {
  return value as Brand<string, B>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export const isUuid = (value: string): boolean => UUID.test(value);

export const newTemplateId = (): TemplateId => asBrand(crypto.randomUUID());
export const newFieldId = (): FieldId => asBrand(crypto.randomUUID());
export const newOptionId = (): OptionId => asBrand(crypto.randomUUID());
export const newConditionId = (): ConditionId => asBrand(crypto.randomUUID());
export const newResponseId = (): ResponseId => asBrand(crypto.randomUUID());

export const parseTemplateId = (raw: string): TemplateId | null =>
  isUuid(raw) ? asBrand(raw) : null;
export const parseFieldId = (raw: string): FieldId | null => (isUuid(raw) ? asBrand(raw) : null);
export const parseOptionId = (raw: string): OptionId | null => (isUuid(raw) ? asBrand(raw) : null);
export const parseConditionId = (raw: string): ConditionId | null =>
  isUuid(raw) ? asBrand(raw) : null;
export const parseResponseId = (raw: string): ResponseId | null =>
  isUuid(raw) ? asBrand(raw) : null;

/** Accepts `YYYY-MM-DD` only when it names a real calendar day (so not `2026-02-30`). */
export function parseIsoDate(raw: string): IsoDate | null {
  if (!ISO_DATE.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number) as [number, number, number];
  // Not `new Date(year, month - 1, day)`: that constructor reads years 0-99 as 1900-1999, so the
  // check below would reject "0002-03-15", which Chrome emits while a year is typed digit by
  // digit, and the controlled date input would wipe what the user typed. `setFullYear` takes the
  // year literally.
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month - 1, day);
  const isRealDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDay ? asBrand(raw) : null;
}

export function parseIsoDateTime(raw: string): IsoDateTime | null {
  return ISO_DATE_TIME.test(raw) && !Number.isNaN(Date.parse(raw)) ? asBrand(raw) : null;
}

/**
 * The local calendar date of `date`. Never `toISOString().slice(0, 10)`: that is the UTC date,
 * which is a day out for anyone east or west of UTC around midnight (D-16).
 */
export function toIsoDate(date: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return asBrand(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

export const toIsoDateTime = (date: Date): IsoDateTime => asBrand(date.toISOString());
