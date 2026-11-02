import { RouterProvider, type createBrowserRouter } from 'react-router';
import { StorageProvider } from '../storage/StorageContext';
import type { Repositories } from '../storage/repositories';
import { LiveRegionProvider } from '../ui/LiveRegion';
import { ToastProvider } from '../ui/Toast';

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
        {/* Outside the router, so a toast survives the redirect after saving a new template. */}
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LiveRegionProvider>
    </StorageProvider>
  );
}
