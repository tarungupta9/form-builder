# 0006. Test with Vitest and Testing Library, by user scenario

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The rules engine invariants and the builder's editing rules must each be pinned by a test that goes red when they break. UI tests should prove accessibility as a side effect: if a test can find a control by its role and label, so can a screen reader.

## Options considered

### Jest

Pros: the most familiar runner. Cons: needs Babel or `ts-jest` and separate module-resolution config to match Vite; slower.

### Vitest with Testing Library and user-event

Pros: reuses Vite's config and transforms, so tests run the same code the app does; Jest-compatible API. Testing Library queries by role and label, the way users find things. Cons: jsdom is not a browser (see Consequences).

### Playwright for everything

Pros: a real browser. Cons: slow feedback for pure logic; too heavy as the main suite for a take-home.

## Decision

Vitest with jsdom, Testing Library and user-event. Pure modules (reducer, config issues, plugin definitions, storage) get unit tests; screens get feature tests that render the real app over the real routes and `localStorage` (`test/renderApp.tsx`). Tests are named by the scenario a user experiences. One Playwright smoke test is optional at v1.0.

## Consequences

- A "full page refresh" is tested by unmounting and rendering again with fresh repositories: only what reached `localStorage` survives.
- jsdom differs from browsers in small ways that tests must not encode. Two found so far: Node's `Request` rejects jsdom's `AbortSignal`, which breaks React Router navigation (worked around in `test/setup.ts`), and jsdom adds a space before inline hidden text in accessible names (the matchers tolerate it).
- Accessibility checks call `axe-core` directly (`axe.run` on the rendered container) instead of adding `vitest-axe`: one fewer dependency, and the assertion `expect(violations).toEqual([])` prints each violation in full. Colour contrast is disabled there, because jsdom does no layout; it is checked by hand against the tokens. From v0.3, the second caller, the call lives in one helper, `src/test/axe.ts` (`expectNoAxeViolations(container)`).
- Before sign-off, a sample of tests is checked by breaking the behaviour they name and watching them fail.
