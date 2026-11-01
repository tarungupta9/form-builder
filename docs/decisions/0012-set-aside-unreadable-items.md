# 0012. Set aside unreadable stored items one by one, not the whole collection

- **Status:** Accepted
- **Date:** 2026-11-01
- **Supersedes:** the "Data fails to parse or validate" row of [ADR 0007](0007-localstorage-schema.md), for failures of a single item

## Context

ADR 0007 stores each kind of entity as one `localStorage` key holding a versioned envelope of items. Until v0.3, if **any** item failed validation, the whole key was copied to a quarantine key, the screen showed an error, and writes were refused until the user chose to start again with an empty collection.

That is safe but disproportionate. One hand-edited template, or one response written by a buggy build, hid every other template or response, and the only way forward ("Start again") emptied the collection. The cost of one bad item was all of the user's visible data. As the app gains field types, the chance that an older build wrote something a newer one rejects (or the reverse, after a rollback) only grows.

The non-negotiable rule from ADR 0007 still holds: user data is never silently overwritten or wiped.

## Options considered

### Keep quarantining the whole collection

Pros: one simple rule; nothing changes on disk until the user acts. Cons: one bad item hides everything; recovering means starting again with nothing.

### Skip invalid items silently

Load the valid items and ignore the rest. Pros: simplest for the user. Cons: data disappears without a word, and the next save overwrites the key without the skipped items, which wipes them. This breaks the rule.

### Set each invalid item aside, with a backup and a notice

Validate items one by one. Copy the stored value to a quarantine key **before** anything is removed, drop the invalid items from the collection, load the valid ones, and tell the user how many were set aside and where the copy is. Pros: one bad item costs only itself; nothing is lost; the user is told. Cons: the stored key is rewritten on read (once), and the notice is held in memory, so it shows for the session in which the items were set aside.

## Decision

**Set each invalid item aside, with a backup and a notice.** It keeps the "never silently wipe" rule while making a bad item cost only itself.

| Situation                                                            | What happens                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Some items fail validation (or sit under a key that is not their ID) | The key's whole stored value is copied to `formBuilder:quarantine:<key>:<timestamp>`. Then the key is rewritten with the valid items only, and they load. The screen says "2 saved responses could not be read", that nothing was deleted, and names the backup key. Writes carry on as normal. A reload finds only valid items and makes no new backup. |
| The backup cannot be made (for example, storage is full)             | Nothing is removed. The whole key is reported as unreadable and writes are refused, as before, because removing the items would destroy the only copy.                                                                                                                                                                                                   |
| The key cannot be read at all (not JSON, no envelope, no items)      | Unchanged from ADR 0007: the raw value is copied to a quarantine key, the error names it, writes are refused, and the user can start again, keeping the backup.                                                                                                                                                                                          |

Details:

- **The backup is the key's whole stored value**, byte for byte, not just the invalid items. It is the only copy guaranteed to be exactly what was stored, whatever migrations run on read, and restoring from it is one `setItem`.
- **The rewrite on read happens once.** Without it, every reload (and every other tab) would set the same items aside again and pile up backups. If the rewrite itself fails, the next successful save drops the items instead; the backup exists either way.
- **The notice is per tab, in memory** (`Collection.setAside()`, read with `useSetAside`). It shows on the templates page for both collections and on a template's responses page for responses, until the tab is closed.
- Validation per item includes the invariants the types cannot express: a template whose field has a condition on itself, or a response whose answer does not fit its snapshot's field, is set aside on its own.

## Consequences

- One bad template or response no longer hides the others, and recovering no longer requires starting again.
- The notice is not persistent: a user who closes the tab without reading it will not see it again, though the backup key stays in storage. Listing existing quarantine keys on start-up (with a way to dismiss them) would make it persistent; that is noted under "With more time" in the README.
- A response whose template was set aside still loads, but nothing lists it until the template is restored. That is acceptable: it is not lost, and restoring the template brings it back.
- The storage tests pin the new behaviour: they fail if one invalid item hides the valid ones, if an item is dropped without a backup, or if a reload sets the same item aside twice.
