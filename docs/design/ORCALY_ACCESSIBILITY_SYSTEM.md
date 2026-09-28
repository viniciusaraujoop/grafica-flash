# Orçaly — Accessibility System

Target: practical WCAG 2.2 AA behavior for the frontend architecture.

## Semantics

- one meaningful `main` per shell;
- one page `h1`;
- labelled navigation landmarks;
- page and section headings without arbitrary jumps;
- captions and scoped headers in tables;
- native links for navigation and buttons for actions;
- article/aside semantics for editorial layouts.

## Keyboard

- first-class skip link;
- visible `:focus-visible` ring;
- all actions reachable without pointer;
- no focusable decorative elements;
- command/launcher patterns must return focus when closed in their interactive implementations;
- Escape closes modal, drawer, popover and command surfaces where applicable.

## Forms

- visible labels, never placeholder-only;
- helper/error text connected through `aria-describedby`;
- `aria-invalid` when error exists;
- required/optional semantics are explicit;
- disabled and read-only states remain visually distinct;
- submit progress must prevent accidental duplicate action.

## Status and feedback

- error: alert where immediate announcement is appropriate;
- loading/progress: status/live region where appropriate;
- color never carries status alone;
- empty, error, no permission, no entitlement, offline and unavailable use distinct copy and affordances.

## Touch and zoom

- 44×44px target baseline;
- no page-level horizontal overflow at 320px;
- UI must reflow at 200% zoom and large text;
- mobile navigation respects safe areas.

## Motion

`prefers-reduced-motion` is implemented in both design-system and shell layers. Function cannot depend on animation.

## Charts

Visual charts must expose exact values in text/table form. Shape/labels accompany color.

## Axe

Axe is a gate **only if actually run**. A missing executable or environment is recorded as `NOT_RUN`, never PASS.

## Manual checks still required before production integration

- VoiceOver/NVDA traversal;
- high zoom with actual authenticated runtime;
- focus trap and restoration in final modal implementations;
- dynamic live-region wording with real server actions;
- color contrast after brand assets or themes change.
