import { type ReactNode, createContext, useContext, useSyncExternalStore } from 'react';
import type { Collection, CollectionSnapshot, SetAside } from './collection';
import type { Repositories } from './repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

/** Repositories are created once per app (or per test) and handed down, never imported as singletons. */
export function StorageProvider({
  repositories,
  children,
}: {
  repositories: Repositories;
  children: ReactNode;
}) {
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  );
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('useRepositories must be used inside <StorageProvider>');
  return repositories;
}

/** Re-renders when the collection changes, in this tab or another one. */
export function useCollection<Id extends string, T>(
  collection: Collection<Id, T>,
): CollectionSnapshot<Id, T> {
  return useSyncExternalStore(collection.subscribe, collection.snapshot);
}

/** What the collection has set aside as unreadable in this tab, so a screen can say so. */
export function useSetAside<Id extends string, T>(
  collection: Collection<Id, T>,
): readonly SetAside[] {
  return useSyncExternalStore(collection.subscribe, () => {
    // Items are set aside while the collection is read, so read it first.
    collection.snapshot();
    return collection.setAside();
  });
}
