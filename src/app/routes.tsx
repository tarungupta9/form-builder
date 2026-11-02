import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { TemplatesPage } from '../features/templates-list/TemplatesPage';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

/*
 * The landing page loads with the app, so it never shows a loading state. The other pages each
 * load on first visit (ADR 0017): dnd-kit comes only with the builder, and Fill only with a
 * response. A chunk that fails to load throws while rendering, and `RouteError` offers a reload.
 */
const BuilderPage = lazy(() =>
  import('../features/builder/BuilderPage').then((module) => ({ default: module.BuilderPage })),
);
const FillPage = lazy(() =>
  import('../features/fill/FillPage').then((module) => ({ default: module.FillPage })),
);
const ResponsesPage = lazy(() =>
  import('../features/responses/ResponsesPage').then((module) => ({
    default: module.ResponsesPage,
  })),
);

/** Every view has a URL, so each one survives a full page refresh. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <TemplatesPage /> },
      { path: 'templates/new', element: <BuilderPage /> },
      { path: 'templates/:templateId/edit', element: <BuilderPage /> },
      { path: 'templates/:templateId/respond', element: <FillPage /> },
      { path: 'templates/:templateId/responses', element: <ResponsesPage /> },
      // The same page as `respond`, so the first input can move a new response to its own URL
      // without remounting the form (D-23). A submitted response opens read-only here.
      { path: 'templates/:templateId/responses/:responseId', element: <FillPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
