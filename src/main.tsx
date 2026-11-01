import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { App } from './app/App';
import { routes } from './app/routes';
import { browserStorage, createRepositories } from './storage/repositories';
import './styles/tokens.css';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <App repositories={createRepositories(browserStorage())} router={createHashRouter(routes)} />
  </StrictMode>,
);
