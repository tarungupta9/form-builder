import type { RouteObject } from 'react-router';
import { BuilderPage } from '../features/builder/BuilderPage';
import { TemplatesPage } from '../features/templates-list/TemplatesPage';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

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
      { path: '*', element: <NotFound /> },
    ],
  },
];
