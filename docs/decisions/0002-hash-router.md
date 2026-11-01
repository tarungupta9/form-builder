# 0002. Route with React Router's hash router

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The spec requires every view to work after a full page refresh. That means each view needs its own URL: the templates list, the builder for a given template, and later Fill mode and the responses list. The app is a static bundle that the reviewer may open from any host, including a sub-path or a plain file server.

## Options considered

### Hand-rolled view state

Keep the current view in React state. Pros: no dependency. Cons: a refresh always lands on the home page and links cannot be shared, which fails the spec.

### React Router with browser history (`/templates/abc/edit`)

Pros: clean URLs. Cons: a refresh on a deep URL needs the server to rewrite every path to `index.html`; on a plain static host it returns 404.

### React Router with hash history (`/#/templates/abc/edit`)

Pros: works on any static host with no server configuration, so a refresh never 404s. Cons: URLs carry a `#`.

## Decision

React Router 7's `createHashRouter`, with the route table in `src/app/routes.tsx`. The same table runs under a memory router in tests, so tests exercise the real routes.

## Consequences

- Deep links and refresh work wherever the build is served (`vite.config.ts` also sets `base: './'`).
- Route params arrive as untrusted strings: `:templateId` is parsed with `parseTemplateId` before use, and a malformed ID shows Not found.
- After each navigation the app shell moves focus to the new page's `<h1>`, because a client-side route change is otherwise silent for screen reader users. A URL change that is not a new page (the builder replacing `/new` with the saved template's URL) passes `KEEP_FOCUS` so focus stays where it is.
- With more time: browser history with a server rewrite, for cleaner URLs.
