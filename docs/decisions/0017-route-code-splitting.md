# 0017. Split the code by route with `React.lazy`, and load the print view on export

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

v0.7 left one JavaScript chunk of 504.77 kB (157 kB gzip), past Vite's 500 kB warning, and v0.8 adds dnd-kit (about 49 kB minified). The HLD (§8) planned route code-splitting for v1.0; the owner pulled it into v0.8. Done means `npm run build` prints no chunk-size warning **without** raising `chunkSizeWarningLimit`, which would hide the problem rather than fix it.

Measured by package, the bundle is mostly vendor code every page needs: `react-dom` 209 kB, `zod` 94 kB (storage parses at start-up), `react-router` 91 kB. The app's own builder (27 kB plus conditions), fields (23 kB), Fill (7 kB) and export (5 kB) are small, but dnd-kit and the print view are needed only on some pages.

Two facts constrain the approach:

- The home page is where everyone lands. A loading state there would be a flash on every visit.
- The tests render the real route table. A lazy route renders a fallback first, so tests that query straight after `renderApp` would fail.

## Options considered

### How routes load

- **A: `React.lazy` per page**, with a `<Suspense>` fallback around the shell's `<Outlet>`. `routes.tsx` stays a plain list. React Router applies navigations inside `startTransition`, so in the app the old page stays until the new one is ready and the fallback shows only on a cold load or refresh.
- **B: the route `lazy` property.** The router loads the module before it navigates, so nothing suspends during render. A first load needs a `hydrateFallbackElement` (the router warns without one), and the route table becomes module loaders rather than elements.
- **C: no splitting; `manualChunks` for vendors.** Moving `react-dom` to its own chunk clears the warning but does not shrink the first load at all, since every page needs it.

### Which boundaries

Everything lazy except the shell; or the landing page eager and the rest lazy; or finer splits inside pages.

### Tests

- **A: an async `renderApp`** that waits for the page's `<h1>` (every page and the not-found view has one), with `await` at every call site.
- **B: eager routes under test only**, through a test-specific route table. Tests would no longer cover the route configuration that ships.

## Decision

**A, landing page eager, and test option A.**

- `TemplatesPage` loads with the app, so the home page never shows a loading state. `BuilderPage`, `FillPage` and `ResponsesPage` load on first visit through `React.lazy`. dnd-kit and the condition editors therefore load only with the builder; `FillForm` and the field renderers form a chunk that Fill and the builder's Preview share.
- The print view loads on the first export: `usePdfDownload` calls `await import('./printDocument')`. A failed import lands in its existing `catch` and shows the same alert as a print dialog that will not open.
- `NO_FIELDS_REASON` moved from `fill/notices.tsx` to `fill/noFieldsReason.ts`. The card imported it from a module that imports the PDF download hook, which pulled Fill's notices into the home chunk.
- The fallback is `<p role="status">Loading the page…</p>`. A screen reader hears it at once; on screen it fades in after 300 ms, so a fast load does not flash it.
- A chunk that fails to load (offline, or a redeploy removed it) throws while rendering, and the route's `errorElement` offers a reload.
- AppShell moves focus to the new page's `<h1>` in a layout effect, not a passive one. A lazy page commits after the navigation's own work is done, and a passive effect could then move focus after the user had started typing in the page.
- `renderApp` resolves once the `<h1>` is on screen and the page's effects have run, as its own first commit ("test: renderApp waits for the page"). Waiting for effects matters: a lazily loaded page can show its `<h1>` before its listeners are attached, and a test could then act sooner than any user can.

The deciding reason: per-page `React.lazy` takes the code a page does not need off the first load, which `manualChunks` alone cannot, and keeps the route table and the tests the same shape.

**Result** (`npm run build`, minified / gzip):

| Chunk            | Contents                                                                                                   |                Size |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------------: |
| `index` (entry)  | React, React DOM, React Router, zod, storage, domain, field definitions, UI kit, app shell, templates list | 446.3 kB / 140.0 kB |
| `BuilderPage`    | builder, condition editors, dnd-kit                                                                        |   85.5 kB / 28.4 kB |
| `FillForm`       | `FillForm`, `FillField`, field renderers (shared by Fill and Preview)                                      |    28.2 kB / 9.3 kB |
| `printDocument`  | print view (`ResponseDocument`, print CSS)                                                                 |     4.5 kB / 2.1 kB |
| `ResponsesPage`  | responses list                                                                                             |     2.8 kB / 1.3 kB |
| `FillPage`       | Fill route                                                                                                 |     2.3 kB / 1.1 kB |
| `usePdfDownload` | download hook, shared by Fill and Responses                                                                |     1.3 kB / 0.8 kB |

No warning is printed. The first load drops from 505 kB to 446 kB.

## Consequences

- The entry has about 54 kB of headroom under the warning, and v0.9 (two field plugins) and v0.10 (drafts) add to it. It is measured at every gate. If it passes about 480 kB, the next lever is `build.rollupOptions.output.manualChunks` for `react-dom`: that clears the warning and caches well across deploys, but it does **not** shrink the first load, since every page needs `react-dom`.
- The first visit to the builder, Fill or the responses page costs one extra request. In the app this is hidden by the router's transition; on a cold load or refresh the loading status shows.
- `vi.mock('…/printDocument')` in the tests applies to the dynamic import too, so the export tests are unchanged.
- Revisit with more time: preload the builder chunk when the pointer rests on _Open in builder_ or _New template_, and split `zod` so only the schemas storage needs at start-up load with the entry.
