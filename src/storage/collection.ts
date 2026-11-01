import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import { type Result, type StorageError, err, ok } from './result';

/**
 * One `localStorage` key holding every item of one kind, keyed by ID:
 *
 *     formBuilder:v1:templates → { schemaVersion: 1, items: { [id]: item } }
 *
 * Reads are parsed once and cached, so `snapshot()` is cheap and referentially stable (what
 * `useSyncExternalStore` needs). The cache is dropped on every write and whenever another tab
 * changes the key. Nothing is ever silently overwritten or wiped (ADR 0012):
 *
 * - An item that fails validation is **set aside**: the stored value is first copied to a
 *   quarantine key, then the item is dropped from the collection, and the valid items load.
 *   `setAside()` reports how many and where the copy is, so the screen can say so.
 * - A key that cannot be read at all (not JSON, no envelope), or whose bad items cannot be
 *   backed up, is copied to a quarantine key if possible and reported as an error, and writes
 *   are refused, because writing would destroy the only copy.
 */
export interface Collection<Id extends string, T> {
  snapshot: () => CollectionSnapshot<Id, T>;
  /** Every time this tab set unreadable items aside, oldest first. Stable until the next one. */
  setAside: () => readonly SetAside[];
  put: (item: T) => Result<void, StorageError>;
  remove: (ids: readonly Id[]) => Result<void, StorageError>;
  /** Starts over with an empty collection. Only offered after the old data has been backed up. */
  reset: () => Result<void, StorageError>;
  subscribe: (listener: () => void) => () => void;
}

export type CollectionSnapshot<Id extends string, T> = Result<ReadonlyMap<Id, T>, StorageError>;

/** Items that failed validation and were moved out of the collection, and where their copy is. */
export interface SetAside {
  count: number;
  /** Holds the key's whole stored value from before the items were removed. */
  backupKey: string;
}

interface CollectionOptions<Id extends string, T> {
  storage: Storage | null;
  key: string;
  itemSchema: z.ZodType<T>;
  idOf: (item: T) => Id;
  /** Injected so tests can pin the quarantine key. */
  now?: () => Date;
}

export const QUARANTINE_PREFIX = 'formBuilder:quarantine:';

export function createCollection<Id extends string, T>(
  options: CollectionOptions<Id, T>,
): Collection<Id, T> {
  const { storage, key, itemSchema, idOf, now = () => new Date() } = options;
  // Items are checked one by one below, so one bad item never hides the others.
  const envelopeSchema = z.object({ items: z.record(z.string(), z.unknown()) });
  const listeners = new Set<() => void>();
  let cached: CollectionSnapshot<Id, T> | null = null;
  let setAsideLog: readonly SetAside[] = [];

  const notify = () => {
    cached = null;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const quarantine = (raw: string): string | null => {
    const backupKey = `${QUARANTINE_PREFIX}${key}:${now().toISOString()}`;
    try {
      storage?.setItem(backupKey, raw);
      return backupKey;
    } catch {
      return null;
    }
  };

  const read = (): CollectionSnapshot<Id, T> => {
    if (!storage) return err({ kind: 'unavailable' });
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return err({ kind: 'unavailable' });
    }
    if (raw === null) return ok(new Map());

    const corrupt = (): CollectionSnapshot<Id, T> =>
      err({ kind: 'corrupt', key, backupKey: quarantine(raw) });
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return corrupt();
    }
    const migrated = migrate(json);
    if (migrated.status === 'newer')
      return err({ kind: 'newerVersion', key, version: migrated.version });
    if (migrated.status === 'invalid') return corrupt();

    const parsed = envelopeSchema.safeParse(migrated.envelope);
    if (!parsed.success) return corrupt();
    const items = new Map<Id, T>();
    let rejected = 0;
    for (const [storedKey, stored] of Object.entries(parsed.data.items)) {
      const item = itemSchema.safeParse(stored);
      // A record whose key disagrees with its own ID would be unreachable by lookup.
      if (item.success && idOf(item.data) === storedKey) items.set(idOf(item.data), item.data);
      else rejected += 1;
    }
    if (rejected === 0) return ok(items);

    // Copy first, then drop: if the copy cannot be made, nothing may be removed.
    const backupKey = quarantine(raw);
    if (backupKey === null) return err({ kind: 'corrupt', key, backupKey: null });
    setAsideLog = [...setAsideLog, { count: rejected, backupKey }];
    // Store the valid items alone, so the next read (or another tab) does not set them aside again.
    // If this write fails, the next successful write drops them instead; the copy exists either way.
    // No `notify()`: this runs while a snapshot is being read, and the cache below is current.
    writeItems(items);
    return ok(items);
  };

  const snapshot = (): CollectionSnapshot<Id, T> => {
    cached ??= read();
    return cached;
  };

  function writeItems(items: ReadonlyMap<Id, T>): Result<void, StorageError> {
    if (!storage) return err({ kind: 'unavailable' });
    const envelope = { schemaVersion: CURRENT_SCHEMA_VERSION, items: Object.fromEntries(items) };
    try {
      storage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
      return err(isQuotaError(error) ? { kind: 'quota' } : { kind: 'unavailable' });
    }
    return ok(undefined);
  }

  const write = (items: ReadonlyMap<Id, T>): Result<void, StorageError> => {
    const written = writeItems(items);
    if (written.ok) notify();
    return written;
  };

  const update = (change: (items: Map<Id, T>) => void): Result<void, StorageError> => {
    // Never write over data we could not read: that would destroy it.
    const current = snapshot();
    if (!current.ok) return current;
    const next = new Map(current.value);
    change(next);
    return write(next);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === key || event.key === null) notify();
    });
  }

  return {
    snapshot,
    setAside: () => setAsideLog,
    put: (item) =>
      update((items) => {
        items.set(idOf(item), item);
      }),
    remove: (ids) =>
      update((items) => {
        ids.forEach((id) => items.delete(id));
      }),
    reset: () => write(new Map()),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
