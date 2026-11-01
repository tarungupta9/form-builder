# 0003. Hold builder state in a reducer and stored data in an external store

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Two kinds of state exist. The builder edits one template in memory until the author presses Save. Saved templates (and later responses) live in `localStorage`, can change in another tab, and are read by several screens. The rules that govern editing (where a new field goes, what removing the selected field does) are what most needs tests.

## Options considered

### A global store (Redux Toolkit or Zustand)

Pros: one familiar pattern for everything, devtools. Cons: a dependency and a layer of indirection for an app with one editor and one persisted collection; the editing rules still need to be written as pure functions to be testable.

### `useReducer` for the builder, `useSyncExternalStore` over the storage repositories

Pros: no dependency. The reducer is a pure function, so every editing rule is a plain unit test. Storage becomes an external store with a stable, cached snapshot, so every screen re-renders when data changes, in this tab or another. Cons: two patterns to learn rather than one.

## Decision

`builderReducer` (pure, in `features/builder/`) holds the template being edited and the selection. `useBuilder` adds the derived config issues and Save. Stored data is read with `useCollection`, a thin wrapper over `useSyncExternalStore`.

## Consequences

- Actions carry finished values: a new field arrives already created with its fresh ID, so the reducer has no randomness or clock and its tests are deterministic.
- Derived values (config issues, the dirty flag from v0.8) are computed, never stored, so they cannot drift from the template.
- Repositories are created once and passed through context, never imported as singletons, so each test runs the real app over its own storage.
