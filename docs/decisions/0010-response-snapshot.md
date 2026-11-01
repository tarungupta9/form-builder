# 0010. Store a snapshot of the form with each submitted response

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Templates keep changing after people have filled them in: fields are renamed, reordered, deleted or given new conditions. A submitted response must still read as what the respondent saw, because its PDF can be downloaded again at any time (v0.3) and the spec requires the export to show "all visible field labels and their submitted values" in form order. Hidden fields must not appear in the submitted data at all.

Two smaller questions follow from the same goal: what the form should do when the template changes in another tab while someone is filling it in, and how far stored responses can be trusted when they are read back.

## Options considered

### Store answers only, keyed by field ID, and read labels from the current template

Pros: the smallest record; no duplication. Cons: renaming a field rewrites history; deleting one orphans its answer; reordering changes the PDF. A re-downloaded PDF would no longer match what was submitted.

### Version every template and store the version ID with each response

Pros: no duplication across responses to the same version. Cons: every save creates a version that must be kept forever, deleting a template needs reference counting, and storage gains a second kind of record to migrate. That is a lot of machinery for a `localStorage` app with hundreds of responses at most.

### Store a snapshot with each response

The response holds the title, description and the fields the respondent saw, in form order, next to the answers. Pros: the response is self-contained; the PDF is reproducible from it alone; deleting or editing the template cannot break it. Cons: a field's definition is duplicated in every response (a few hundred bytes each, well inside the quota at the expected scale).

## Decision

**Snapshot (D-10).** At submit, the response stores `{ title, description, fields }`, where `fields` are the **visible** fields only, in form order, and `answers` holds only those fields' non-empty values, taken from the rules engine's effective values. A hidden field therefore appears in neither, which satisfies the spec's rule by construction rather than by a filter in the export.

Three related choices make the snapshot mean "what the respondent saw":

- **The form is fixed when it opens.** The Fill page keeps the template as loaded, even if the builder saves it in another tab meanwhile. Following it live would move or rename fields under the respondent's cursor and drop what they typed into a removed field; the snapshot would then describe a form they never saw. If the template has been deleted by submit time, submit is refused with an explanation and the answers stay on screen, because a response to a deleted template could never be listed.
- **The confirmation replaces the form on the same URL.** A refresh then shows a blank form, which is correct: the response is already stored. Moving to the response's own URL instead would need the read-only response view, which belongs with drafts (v0.10).
- **Stored answers must fit the snapshot.** On read, every answer must belong to a field in its snapshot and be a value that field's plugin accepts (`readValue`). A response edited by hand into an inconsistent shape is quarantined like any other corrupt data (ADR 0004), instead of reaching the PDF.

## Consequences

- Re-downloading a PDF (v0.3) reads the response alone and never the template.
- The response count and the responses list need no template lookup beyond the template ID.
- Responses are larger than they strictly need to be. At the expected scale this is a small part of the 5 MB quota; with more time, identical snapshots could be stored once and shared by hash.
- A submitted response cannot be "upgraded" to a newer template. That is intended: it records what happened.
- A respondent who keeps a form open for a long time submits against the form as it was. Drafts (v0.10) are evaluated against the current template on resume instead, with a notice, because a draft is still being written.
