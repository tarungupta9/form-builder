import { RouterProvider, type createBrowserRouter } from 'react-router';
import { StorageProvider } from '../storage/StorageContext';
import type { Repositories } from '../storage/repositories';
import { LiveRegionProvider } from '../ui/LiveRegion';

interface AppProps {
  repositories: Repositories;
  /** A hash router in the browser, a memory router in tests; both are built from `routes`. */
  router: ReturnType<typeof createBrowserRouter>;
}

/** The app-wide providers. Everything is passed in, so tests run the real app over their own storage. */
export function App({ repositories, router }: AppProps) {
  return (
    <StorageProvider repositories={repositories}>
      <LiveRegionProvider>
        <RouterProvider router={router} />
      </LiveRegionProvider>
    </StorageProvider>
  );
}
