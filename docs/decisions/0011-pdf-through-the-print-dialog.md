# 0011. Export PDFs through the browser's print dialog, from one shared response view

- **Status:** Accepted
- **Date:** 2026-11-01
- **Resolves:** Q-2 (D-30) in the [high-level design](../high-level-design.md#6-pdf-export-q-2)

## Context

The spec asks for each submitted response to download as a PDF that "looks like a real export": the form title, the submission timestamp, and every visible field's label and value in form order. Third-party PDF libraries are banned, so only browser-native APIs are allowed. A re-download must reproduce what was submitted, even after the template has changed (D-10, [ADR 0010](0010-response-snapshot.md)).

Three more forces shape the choice:

- **Field types are plugins** ([ADR 0008](0008-field-types-as-plugins.md)). The export must not switch on field type, and later slices (section headers, long text, choice fields, files, calculations) must plug into it without editing shared export code. `npm run check:seam` fails the gate if they do.
- **v0.10 shows a submitted response on screen** (read-only). Whatever renders the PDF should be able to render that too.
- **Time.** The PDF is one feature among many; the rules engine is weighted more heavily.

## Options considered

### How the PDF is made

**A. A print document in a hidden iframe, then `print()`.** Render the response into an off-screen frame with a print stylesheet and call the frame's `print()`; the user picks "Save as PDF". Pros: real typography, selectable text, full Unicode, layout in CSS; about 150 lines; the model and the view are testable in jsdom. Cons: the print dialog is an extra step, not a one-click download; page-number support differs between browsers.

**B. Hand-written PDF bytes, downloaded as a `Blob`.** Write the PDF object model by hand (catalog, pages, text objects, cross-reference table) with our own line wrapping and pagination. Pros: a true one-click download with a file name we control. Cons: 500+ lines covering text measurement, wrapping, pagination and escaping; only the standard-14 fonts without font embedding, so no emoji, CJK or most non-Latin text; byte output is hard to test beyond its structure.

**C. Print the app page itself with `@media print`.** Pros: no frame. Cons: every screen's chrome must be hidden by print rules; the page must first navigate to, or render, the response; a Re-download from the list would print the list.

### What renders the document

**Separate print and screen views.** Pros: each can be tuned freely. Cons: two code paths that can disagree, and the "what the respondent saw" guarantee would need testing twice.

**Read-only input renderers for the screen** (a `readOnly` prop on every plugin's `Renderer`). Cons: every type slice must implement it; native `readonly` does not apply to radios, checkboxes, `select` or file inputs, so those would need `disabled`, which drops them from the Tab order and greys them out; the screen and the PDF still differ.

**One presentational view for both.** `ResponseDocument` renders an `ExportDocument` with no print assumptions; print-only rules live in the frame's stylesheet.

### The export vocabulary each plugin returns

**`display: string | string[]`** (the first design sketch). Too thin: it cannot express a section heading, an empty answer with its own wording, or a caveat such as the file-contents footnote.

**The parts bin's union** (`text` with `multiline` and `emphasis` flags, a `files` kind, a document-level footnote). Richer than needed: `multiline` is unnecessary when every text value keeps its line breaks; `emphasis` is decorative; `files` adds a shape the view must know about only for one type.

**A small closed set of presentation shapes**, chosen by the owner: `ExportValue = empty{text?} | text | list` and `ExportBlock = section{text, level 2–6} | answer{label, value, note?}`.

## Decision

**Option A, rendered by one shared view, with the small vocabulary.** The spec rewards output that looks like a real export, and A gives a better document than B at a fraction of the cost and risk. One view means the screen and the PDF cannot disagree. A small, closed vocabulary keeps the seam stable: each later type maps its value onto it inside its own folder.

How the pieces fit:

- **`toExportModel(response)`** is pure. It builds the `ExportDocument` from the response's snapshot alone, asking each field's plugin for its block (`toExport`). Hidden fields are already absent from the snapshot, so they are absent from the PDF.
- **`ResponseDocument`** renders it: an `<article>` with the title as its `<h1>`, the description, a `<dl>` with "Submitted" and "Response ID", then the blocks. Consecutive answers form one `<dl>`; a section closes it and becomes `<h2>`–`<h6>` from its `level`; a `list` is a `<ul>`; a `note` is a paragraph under its answer; `empty` reads "Not answered" unless the plugin gives better words. Text keeps its line breaks (`white-space: pre-wrap`). The view makes no print assumptions, so v0.10 can show it on screen as it is.
- **The full vocabulary ships now**, although only Short text produces answers today (G-1). Every shape is rendered and tested with hand-built documents, so v0.4 (sections, long text), v0.5 (lists) and v0.9 (files as a `list` plus a `note`, a calculation's own empty text) need no edit to the view. These branches are the seam, not dead code.
- **Files become a `list` plus a `note`** (G-2), not a `files` kind with a document footnote: one shape fewer in shared code, and the caveat sits beside the answer it explains, owned by the file plugin.
- **`printDocument(doc)`** mounts the view in an off-screen frame (`srcdoc`, A4-sized, `aria-hidden`, `tabindex="-1"`; not `display: none`, which Safari prints blank), copies the page's stylesheets into it (CSS Modules put them in the page's head), adds `print.css`, waits for stylesheets and fonts, then calls the frame's `print()`.

The lifecycle, so the busy state never sticks and the frame is never removed too early (G-6):

| Moment                                           | What happens                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button pressed                                   | The button shows `busy` (focus stays on it); further presses on any PDF button on the page are ignored until this one settles.                        |
| `print()` throws, or the frame has no window     | The promise rejects, the frame is removed, and an alert says "Couldn’t open the print dialog".                                                        |
| `afterprint` fires, or `print()` returns + 0.5 s | Whichever is first ends the busy state and restores the page title. No success message: a saved PDF and a cancelled dialog look the same to the page. |
| `afterprint`, or one minute later                | The frame is removed. Removing it as soon as `print()` returns would print a blank page in browsers that do not block on `print()`.                   |

Details decided with the owner:

- **File name** (G-5): browsers suggest it from the document title, some from the frame's and some from the page's, so both are set to `Expense claim – response 2026-11-01 0905` (local time, sortable) and the page's title is restored afterwards.
- **Response ID** (G-3): the full UUID, labelled, in small monospace. It is the only key that matches storage and the v0.10 URL; a shortened one could collide.
- **"Submitted …"** (G-4): the viewer's local time zone, with its name ("1 November 2026 at 09:05 GMT"), so a re-download in another zone is unambiguous.
- **Page numbers** (G-8): `@page { @bottom-center { content: "Page " counter(page) " of " counter(pages) } }`. Chromium supports margin boxes; where a browser does not, its own "Headers and footers" print option adds page numbers. This is checked by hand in the demo's Safari step and recorded in the README.
- **Where Download PDF appears** (G-7): on the confirmation after submit, and as Re-download PDF on each row of the responses list. Never before submit, since only submitted responses carry a submission timestamp (D-23).

## Consequences

- The PDF is never a single click: the print dialog is part of it. The README records this as a known trade-off, and a hand-written PDF byte generator (option B) is the first item under "With more time".
- Print output differs between browsers (page numbers, margins, default headers). The demo checks Chrome and Safari by hand; jsdom cannot print, so `printDocument`'s tests cover what jsdom can show (the frame's content and attributes, the title, cleanup, failure) and mock the dialog.
- A new field type exports by returning one of five shapes from `toExport`. A type that needs a genuinely new shape would edit the view, and `check:seam` would flag it; that is the point at which to extend the vocabulary deliberately.
- v0.10's read-only view of a submitted response is `ResponseDocument` inside the page, so `RendererProps` never gains `readOnly` and renderers stay input-only.
- The stylesheets are copied into the frame on every export. If routes are code-split later (v1.0), the export view's CSS must be loaded before printing; Vite loads a chunk's CSS before the chunk resolves, so this holds as long as the view is imported, not rendered lazily inside the frame.
