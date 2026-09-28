# Orçaly — Frontend Performance

A polished frontend that delays work is a failed frontend.

## Render boundaries

- Keep structural components server-safe where possible.
- Client boundaries belong around actual interaction: command palette, modal, local editor behavior.
- Do not add `use client` to a shell just because one child is interactive.
- Prefer native details/dialog semantics where they meet the interaction contract.

## JavaScript cost

No dependency was added for motion, components or layout. The reference layer is React + scoped CSS and reuses existing registry/skin modules.

Avoid:
- framework-sized UI libraries for a handful of controls;
- per-card observers/listeners;
- global scroll listeners;
- re-rendering full data tables for hover/local state;
- duplicated client state already represented by URL/server data.

## CSS/motion cost

Prefer opacity/transform. Avoid broad `backdrop-filter`, large blur stacks and animated layout properties. Skeleton animation is isolated and removed under reduced-motion.

## Images

Use product/brand assets only when approved and available. Future runtime integration should use the existing Next image strategy where it materially improves LCP and layout stability. Do not invent large decorative hero imagery for application screens.

## Lazy behavior

Lazy-load expensive secondary content, not the primary task. An analytical chart below the fold may be deferred; the page title and current status may not.

## Perceived performance

- show specific loading language;
- retain shell/context while content loads;
- use skeleton only when final geometry is known;
- avoid blank transitions between sibling product pages;
- optimistic feedback only where server semantics make it safe.

## Layout stability

Reserve predictable space for stable controls and media. Hover/focus must not move surrounding layout.

## Measurement targets for integration

Before production adoption measure at least:
- route JS delta;
- LCP/INP/CLS on representative mobile and desktop;
- table interaction cost for large datasets;
- command-palette open latency;
- modal/drawer interaction latency.

This architecture defines cost controls; it does not claim runtime Web Vitals until measured against the integrated app.
