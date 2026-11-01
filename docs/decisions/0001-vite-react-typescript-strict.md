# 0001. Build with Vite, React 19 and TypeScript in strict mode

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The spec fixes React and strictly typed TypeScript, and bans `any`. All data lives in `localStorage`, so there is no server and nothing to render on one. The reviewer reads the types to judge the design ("do your types communicate the design?"), so the compiler settings are part of the deliverable.

## Options considered

### Vite single-page app

A static bundle with a fast dev server. Pros: nothing server-side to explain away; the build runs from any static host. Cons: routing and code-splitting are set up by hand.

### Next.js

Pros: routing and splitting built in. Cons: its main value is server rendering, which cannot read `localStorage`, so every page would opt out of it. More framework for the reviewer to read past.

## Decision

Vite with React 19 and TypeScript `strict`, plus `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals` and `noUnusedParameters`. ESLint runs `typescript-eslint`'s `strictTypeChecked` rules with `switch-exhaustiveness-check`, so every switch over a union must handle every member.

## Consequences

- `noUncheckedIndexedAccess` makes every array and record lookup possibly `undefined`, which forces the "not found" paths the spec's production-readiness rule asks for.
- No `any` is possible without a lint error; values from outside the program (storage, URL params, navigation state) are typed `unknown` and narrowed.
- Routing (ADR 0002) and code-splitting (v1.0) are explicit choices rather than framework defaults.
