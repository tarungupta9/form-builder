# 0007. Store one versioned collection per entity kind in `localStorage`

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

`localStorage` is the only persistence the spec allows. It is a synchronous string store of about 5 MB per origin. The app stores templates now, and responses and drafts in later slices. Data must survive refreshes and app upgrades, and must never be silently lost: not to a hand edit, a bug, a full quota or another tab.

## Options considered

### One key per entity (`template:<id>`)

Pros: small writes. Cons: listing templates means scanning every key; counting responses per template means reading every response; no single place to version.

### One key for everything

Pros: one read, one version. Cons: saving a template re-serialises every response.

### One key per entity kind, holding a versioned envelope

`formBuilder:v1:templates → { schemaVersion: 1, items: { [id]: template } }`. Pros: listing is one read; a write touches only its own kind; the envelope's version lets old shapes be upgraded on read. Cons: each save rewrites the whole collection, which is cheap at the expected scale (tens of templates, hundreds of responses).

## Decision

One key per entity kind, with a `schemaVersion` envelope and items in a `Record` keyed by ID. v0.1 has `formBuilder:v1:templates`; v0.2 adds `formBuilder:v1:responses`. Each read is migrated, validated with zod (ADR 0004) and cached. Writes return a `Result` instead of throwing.

| Situation                       | What happens                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data fails to parse or validate | The raw value is copied to `formBuilder:quarantine:<key>:<timestamp>`, the screen explains what happened and names the backup key, and writes to that key are refused. The user can then start again, which empties the collection but keeps the backup. |
| Data from a newer app version   | Reported and left untouched; this version cannot know what it would lose by rewriting it.                                                                                                                                                                |
| Quota exceeded on save          | "Storage is full" is shown and the edits stay on screen.                                                                                                                                                                                                 |
| Another tab writes              | The `storage` event drops the cache and every screen re-renders.                                                                                                                                                                                         |
| `localStorage` unavailable      | A plain explanation; nothing is attempted.                                                                                                                                                                                                               |

## Consequences

- The stored shape is final from v0.1: templates are saved with their full condition logic (empty groups), so no migration is needed between slices.
- A record whose key disagrees with its own ID is treated as corrupt, because lookup by ID would never find it.
- The repository interface hides the key layout, so moving to IndexedDB later swaps the adapter, not the screens.
- Last write wins across tabs for now; v0.6 warns before saving over a newer copy.
