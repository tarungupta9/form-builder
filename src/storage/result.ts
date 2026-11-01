export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Why a read or write failed, in terms the UI can explain to the user. */
export type StorageError =
  /** `localStorage` is disabled or missing (private mode in some browsers, blocked cookies). */
  | { kind: 'unavailable' }
  /** The browser's storage quota is used up. Nothing was written. */
  | { kind: 'quota' }
  /** Stored data failed validation. The raw value was copied to `backupKey` before anything else happened. */
  | { kind: 'corrupt'; key: string; backupKey: string | null }
  /** Data saved by a newer version of the app, which this version must not overwrite. */
  | { kind: 'newerVersion'; key: string; version: number };
