# 0005. Style with CSS Modules and design tokens

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The reviewer reads the JSX to judge component structure and accessibility. Styling should not crowd that out, and contrast and focus styles must be checked once, not per component. The print stylesheet for PDF export (v0.3) must be plain CSS.

## Options considered

### Tailwind

Pros: fast to write, consistent spacing. Cons: long class strings in every element make the JSX, which is what the reviewer reads, much noisier; a build plugin to configure.

### CSS-in-JS (styled-components, Emotion)

Pros: co-located styles. Cons: a runtime cost, a dependency, and awkward for print styles.

### CSS Modules plus custom-property tokens

Pros: scoped class names with no runtime, built into Vite. Colours, spacing, radii and focus styles are tokens in `styles/tokens.css`, so contrast is checked in one place. Cons: styles live in a second file per component.

## Decision

CSS Modules for component styles, with every colour, space and radius read from tokens in `styles/tokens.css`. Global rules (reset, focus ring, `.visually-hidden`, reduced motion) are in `styles/base.css`.

## Consequences

- The focus indicator is defined once (`:focus-visible` in `base.css`) and meets WCAG 2.4.13's contrast on every surface.
- `prefers-reduced-motion` is honoured globally.
- Tests use non-scoped class names (`vite.config.ts`), but they query by role and label, not class.
