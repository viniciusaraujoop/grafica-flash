# Orçaly — Responsive System

## Required viewports

Visual QA contract:
**320 / 390 / 768 / 1024 / 1440 / 1920px**.

Canonical layout breakpoints:
- base: 0
- md: 768
- lg: 1024
- xl: 1440
- wide QA boundary: 1920

Do not create one-off breakpoint folklore per product.

## Containers and gutters

Shell content uses:
- 14px mobile working gutter;
- 20–28px tablet/small desktop;
- wide content capped around 1320px;
- editorial content uses much narrower readable measures.

## Shell behavior

### Desktop ≥ 1024
- global header: 64px;
- persistent product sidebar;
- context/breadcrumb bar;
- content area independent from sidebar;
- command, launcher, notifications and account in global header.

### Tablet 768–1023
- sidebar remains present but narrows;
- command surface collapses to icon trigger;
- content gutter reduces;
- multi-column content collapses before text becomes cramped.

### Mobile ≤ 767
The sidebar is not merely hidden. Navigation is recomposed:
- product identity stays in compact global header;
- primary destinations become a five-slot bottom navigation;
- launcher becomes viewport-bound;
- content becomes single-column;
- analytical sidebars move into document order;
- tables become labelled row summaries;
- workflow canvas becomes a vertical sequence;
- reader TOC moves above article content.

## Safe areas

Bottom navigation uses `env(safe-area-inset-bottom)`; horizontal fixed surfaces respect safe-area left/right.

## Touch

Interactive targets are 44px minimum. Density does not shrink targets.

## Reflow

320px must work without page-level horizontal overflow. At large text/zoom, secondary columns must collapse rather than crop.

## Modals and drawers

At mobile widths, large modal content should become a sheet/full-height surface. Desktop floating dimensions are not reused blindly.

## Charts

Charts reduce series density before labels become unreadable. Exact-value alternatives remain accessible regardless of viewport.
