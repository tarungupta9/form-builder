# 0021. Fit the builder to the viewport and scroll each panel on its own

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

The builder shows three panels side by side: the palette (_Add a field_), the canvas (_Fields_) and the config panel (_Field settings_). Until now it sat in the same centred, 1280 px column as every other page, and the whole page scrolled.

This record covers three linked layout questions: how the builder scrolls, how wide pages are, and how the builder's three columns share that width.

### Scrolling

The config panel is the long one. A Single select with its options, required conditions and visibility conditions runs to well over a screen, so an author working down its settings scrolls the page, and the field list and the palette scroll away with it. To check which field they are editing, or pick the next one, they scroll back up: the panel they are working in takes the context of the other two with it. The owner asked for the builder to use more of a wide screen, and for the field list and the settings to scroll on their own, so the author stays inside the viewport.

Constraints:

- Below 1001 px the builder already stacks the panels in one column. One column has nothing to keep beside it, so the page should scroll there as it always has.
- A panel that scrolls on its own needs enough height to show something useful. On a short window (a laptop with the browser zoomed, a landscape tablet) three short scrolling boxes are worse than one long page.
- Focus moves inside these panels in code: adding a field focuses its new canvas item, and the issue summary's links focus a control in the config panel. Those must still bring the target into view.
- Drag and drop (ADR 0016) must keep working in a canvas that scrolls, including dragging past the visible edge.
- The other pages (templates list, Fill, responses) are reading pages; their content keeps its own narrower measure inside the page frame.

### Page width

A first version lifted the builder's width cap entirely (`max-width: none`) while every other page stayed at 1280 px. Measured in a browser, that left the builder unbounded: at a 3440 px viewport the canvas column was 2672 px wide, a field card stretched far past a comfortable reading line, and the builder's edges no longer lined up with the templates list it is opened from.

### Column sizes

The first columns were `minmax(200px, 240px) minmax(0, 1fr) minmax(340px, 440px)`. Grid sizing grows every non-flexible track to its maximum before a `fr` track gets any of the free space, so the config panel sat at 440 px at every width and the canvas took all of the shrinking. Measured (viewport: palette / canvas / config): 1001 px: 240 / 233 / 440; 1280 px: 240 / 512 / 440; 1920 px: 240 / 1152 / 440. At the narrowest workspace width the canvas, the panel the author works in most, was half as wide as the settings beside it. The fallback for short windows had a second, different definition (`minmax(180px, 220px) minmax(0, 1fr) minmax(280px, 380px)`) that could drift from the first.

## Options considered

### Scrolling

#### A: Page scroll, as before

Keep one scrolling page. Nothing to build, and the layout every other page uses. But it is the problem the owner reported: the long panel scrolls the short ones out of view.

#### B: Sticky side panels

Keep page scroll, and make the palette and canvas `position: sticky` below the header, so only the config panel's length scrolls the page. Little code. But it only helps while the canvas fits in the viewport: a template with more fields than fit is clipped at the bottom of a sticky canvas with no way to reach the rest until the page scrolls past the end. It also makes the config panel the only one that may be long, which is true today but not a rule.

#### C: A viewport-height workspace where each panel scrolls on its own (chosen)

On builder routes the main area takes the viewport's height below the sticky header. The page heading and any alert sit at the top; the three-panel row takes the rest, and each panel is its own scroll container (`overflow-y: auto`, with `overscroll-behavior: contain` so reaching a panel's end does not scroll anything else). Each panel's title is sticky inside its panel, so a scrolled panel still says what it is. Any panel can be long, and none moves the others.

### Page width

#### D: Cap the builder at 1280 px, like every other page

The simplest frame, and the edges line up. But on a 1920 px screen the builder then leaves 640 px empty while its three panels compete for 1232 px; the owner asked for the builder to use more of a wide screen.

#### E: A wider cap for the builder only

Gives the builder room. But the templates list and the builder then have different edges, so moving between them shifts the page's left edge, and two widths have to be kept in step by hand.

#### F: One shared page frame of 1600 px for every page (chosen)

Below 1600 px every page uses the whole screen (1280 px stays 1280 px, 1440 px stays 1440 px); above it every page is centred in the same 1600 px frame, so the templates list, the builder, Fill and responses all share their left and right edges. The figure fits a 1680 px screen with a small margin and keeps the builder's canvas under 800 px, about the widest a field card reads comfortably at.

### Column sizes

#### G: Leave the config panel fixed

The config panel's two-column rows always get their 440 px. But the canvas pays for it: 233 px at 1001 px, which squeezes field cards to a label and a few words a line.

#### H: Canvas and config share the width 3 : 2 (chosen)

`minmax(180px, 220px) minmax(0, 3fr) minmax(340px, 2fr)`: both flexible tracks grow and shrink together, and the config panel never drops below 340 px.

## Decision

**C, F and H.** C is the only scrolling option where a long panel of any kind leaves the other two where they are, which is what the owner asked for. F gives the builder room without letting it run unbounded or breaking the line with the other pages. H keeps the canvas at least as wide as the config panel at every width where they sit side by side.

How it is wired:

- **The route asks for it.** The two builder routes carry `handle: { layout: 'workspace' }` (`src/app/pageLayout.ts`). `AppShell` reads the matched routes with `useMatches()`, narrows each `handle` (React Router types it `unknown`) and puts `data-layout="workspace"` or `"document"` on `<main>`. The layout is a fact about the route, declared next to it in `routes.tsx`, so a future page opts in with one line. The alternatives were weaker: matching the path in the shell repeats the route table and breaks silently when a path changes, and `main:has(.builder)` in CSS hides the dependency in a selector, depends on the page's class names and reads layout from the content instead of the route.
- **Only where it fits:** `@media (min-width: 1001px) and (min-height: 600px)`. The width matches the builder's own breakpoint for one column. The height keeps each panel at least a few hundred pixels tall; below it the builder falls back to the ordinary scrolling page. The media query appears in both stylesheets, because CSS has no shared named media queries without a build step.
- **Page frame.** `--page-max-width: 1600px` in `tokens.css`, applied to `<main>` on every page; the workspace rule keeps it. The cap is the border box of `<main>` (box-sizing is border-box throughout), so it includes the 24 px side padding and the content is 1552 px wide. The frame is then the outer edge of the page, the same figure on every page whatever its padding.
- **Sizes.** The main area is `100dvh` minus the header (`dvh`, so mobile browser toolbars do not hide the bottom). The panel row is a flex child with `min-height: 0` so it can shrink, and a floor of 360 px so a tall issue summary cannot crush it; past that floor the main area's own `overflow: auto` takes the extra, as a safety net. Columns are one definition, `minmax(180px, 220px) minmax(0, 3fr) minmax(340px, 2fr)`, for the workspace and the short-window fallback alike. The palette's buttons need no more than 220 px. The config floor of 340 px is measured, not guessed: the settings' two-column rows (a Number field's minimum and maximum, prefix and suffix) wrap below `2 × 140 px + 12 px` of content, which with the panel's padding is 332 px; at 340 px they sit side by side at 144 px each, and a condition's _within range_ inputs fit beside each other with the word _and_. Measured after the change (viewport: palette / canvas / config): 1001: 220 / 353 / 340; 1280: 220 / 583 / 389; 1440: 220 / 679 / 453; 1600 and wider: 220 / 775 / 517.
- **Focus.** `focus()` scrolls every scrolling ancestor, so a new canvas item and an issue's config control come into view inside their panel without new code. Each panel sets `scroll-padding-top` to the height of its sticky title, so a focused item stops below the title instead of under it (WCAG 2.4.11, Focus Not Obscured).
- **Positioned content.** The panels and the main area are `position: relative`. Visually hidden text is absolutely positioned; without a positioned ancestor its containing block is the page, so a label scrolled out of a panel stretched the page and brought back the page scroll the workspace removes.

## Consequences

- The author keeps the field list, the palette and the settings in view together; a long settings panel scrolls alone.
- Every page shares one frame, so on a wide screen the edges stay put when moving between the templates list, the builder and Fill. The header bar stays full width, and its brand sits at the screen's edge rather than the frame's; the reading pages keep their own narrower content (Fill 720 px, responses 880 px), so on a 1920 px screen their heading actions sit at the frame's right edge, well apart from the content.
- At 1001 px the config panel is 100 px narrower than before (340 instead of 440). Its two-column rows still fit; prose such as _Show this field when … of these match_ wraps to a second line.
- Three scroll areas instead of one. Each holds focusable controls, so keyboard users scroll them by moving focus, and a mouse wheel scrolls the panel under the pointer. A screen-reader user is not affected: the panels keep their headings and section landmarks.
- dnd-kit auto-scrolls the canvas while an item is dragged near its edge, as it scrolled the page before. Held at the edge, it keeps scrolling past the last field, because the dragged item's own transform extends the scroll area. The page did the same before this change; restricting the drag to the list would fix both and is left for later.
- The workspace layout is tested where tests can see it: the route sets `data-layout`, and `pageLayoutOf` is unit-tested. jsdom has no layout, so the scrolling, the sticky titles and the focus scroll were checked in a browser at 1440×900, 1920×1080 and the 900 px fallback. The frame and column widths were measured at 1001, 1100, 1280, 1440, 1680, 1920, 2560 and 3440 px wide, with no horizontal page scroll at any of them, and the short-window fallback at 1280×560.
- With more time: one shared definition of the breakpoint (a custom media query through PostCSS).
