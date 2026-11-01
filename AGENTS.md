# AGENTS.md

This repo is a senior frontend engineer take-home: a browser-based **form builder** (Builder mode designs templates, Fill mode completes and exports them as PDF). An interviewer, the **reviewer**, judges it against the criteria in [What the reviewer weighs](#what-the-reviewer-weighs), plus readability, accessibility, and the reasoning documented behind each major decision. Write every file and doc for that reviewer.

## Sources of truth

- `docs/spec.md` is the assignment, transcribed from the PDF. Read the relevant section before building or changing any feature, field type, or export behaviour.
- `docs/high-level-design.md` is the design: data model, module interfaces, and the gap decisions (`D-n`). Read it before adding a module or a field type, or before deciding something the spec leaves open.

## Hard constraints

The spec fixes these; they are not open to trade-offs.

- **React + TypeScript, strictly typed.** Types carry the design: discriminated unions, exhaustive switches ending in `never`, and `unknown` narrowed at boundaries. The spec bans `any`.
- **`localStorage` is the only persistence.** Every view is reachable by URL and works after a full page refresh.
- **PDF export uses browser-native APIs only.** The spec bans third-party PDF libraries.

## What the reviewer weighs

The spec's own rule is **correctness and judgment over completeness**: a correct core with documented decisions beats broader, shakier coverage.

- **Field types are plugins.** A field type is one folder registered through the plugin contract (high-level design §5.1). Adding an 11th type means a new folder, registry lines, and a union member. If a change to one type edits shared Builder, Fill, or PDF code, the seam is leaking: fix the seam.
- **Rules engine invariants.** Each one is pinned by a test that goes red when it breaks:
  - A hidden field is never validated as required.
  - A hidden field's value is absent from the submitted record and the PDF.
  - A field cannot hold a condition on itself.
  - A calculation's sources are Number fields only, never another calculation.
  - Conditions resolve through chains (A → B → C), and conditional visibility and calculations update in real time as the user types.
  - Single select's selection and required validation behave identically across radio, dropdown, and tiles.
- **The PDF reads like a real export**: form title, submission timestamp, and every visible field's label and value in form order. File uploads appear as metadata (name, size, type), since contents cannot be embedded.
- **Product thinking.** See [Gaps in the spec](#gaps-in-the-spec).

## Gaps in the spec

The spec tells the candidate to decide ambiguities themselves rather than ask the interviewer, and grades the decisions. When the spec is silent:

1. Check high-level design §2 for an existing `D-n` decision and follow it.
2. If none covers the case, propose a decision with its reasoning to the user, who owns the assessment.
3. Record the agreed decision as an ADR when it is major (see [Decision records](#decision-records)), and summarise it in the README's decisions section with a link to the ADR.

The spec explicitly requires the README to state the AND / OR rule for fields with multiple conditions.

## Code

- Write for a **reviewer** reading each file once, top to bottom: names carry the intent, comments explain _why_, and each file has one job.
- Keep components small and single-purpose. Split **presentational** components (props in, markup out) from logic, which lives in hooks or plain modules so it can be tested without rendering.
- Follow the patterns already in the repo. Introducing a new pattern is a major decision (see [Decision records](#decision-records)).
- **Production-ready** means: every data-driven view handles loading, empty, and error states; input is validated at the boundary; and only intentional code ships, with debug logging and commented-out code removed.

## Accessibility

Target **WCAG 2.2 AA**.

- Reach for semantic HTML first; add ARIA only where no native element fits.
- Every interaction works by keyboard alone, with a visible focus indicator. Drag-and-drop reordering has a keyboard equivalent.
- Every control has a programmatic label. Dynamic changes the user needs to know about are announced through a live region.

## Testing

Tests are **use-case** driven. Each test names a scenario a user or caller experiences ("shows an error when the search request fails") and asserts on observable behaviour: rendered output, accessible roles, emitted callbacks. Choose tests by scenario; coverage follows from that.

- For each unit, cover the happy path, the edge cases (empty, boundary, invalid input), and the failure paths.
- Query the DOM by role and label, the way a user finds things. This doubles as an accessibility check.
- A test earns its place by going **red** when the behaviour it names breaks.

## Decision records

Record each major decision as an **ADR** in `docs/decisions/`. The reviewer reads these to judge the candidate's reasoning, so they are a deliverable, not a by-product.

A decision is **major** when you chose between viable alternatives, or when a reviewer would ask "why this?". Examples: a library or state-management choice, the folder structure, the `localStorage` schema, the PDF technique, a trade-off accepted for time.

Writing an ADR: copy `docs/decisions/0000-template.md` to the next number, fill every section, and add its line to `docs/README.md`. Write it in the same change as the code it explains, while the alternatives are still fresh.

## Submission deliverables

- **`README.md`** covers: how to run locally; the `localStorage` schema and the reasoning behind it; key architectural decisions and trade-offs, especially conditional logic and component structure (summaries linking to ADRs); and what you would improve with more time. Update it in the same change as anything it describes.
- **AI usage log** (`docs/ai-usage-log.md`) records significant prompts, what was verified before using the output, output rejected or significantly changed and why, and at least one plausible-but-incorrect output. Quality over volume: about five well-described entries. When the user rejects or substantially corrects your output, offer a draft entry.

## Done

A change is done when:

- every new use-case has a passing test,
- any new UI works by keyboard and screen reader,
- every major decision in it has an ADR and an index line,
- the README reflects any schema, decision, or run-step it changed,
- lint, type-check, and tests pass.
