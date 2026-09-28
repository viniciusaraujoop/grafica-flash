# Orçaly — Motion System

Motion exists to explain state and space, never to decorate inactivity.

## Duration bands

| Class | Range | Use |
| --- | --- | --- |
| micro | 120–180ms | hover, pressed, small state acknowledgement |
| UI | 180–260ms | tabs, selection, local surface transitions |
| overlay | 220–320ms | drawer, sheet, modal, launcher |
| section | 250–400ms | page/section continuity when needed |

Tokens live in `lib/orcaly-next/design-system/tokens.ts`.

## Easing

- standard: `cubic-bezier(.2,0,0,1)`
- enter: `cubic-bezier(.16,1,.3,1)`
- exit: `cubic-bezier(.4,0,1,1)`

## Rules

Prefer `transform` and `opacity`. Avoid animating dimensions, expensive blur and scroll-position takeover.

Never:
- bounce as personality;
- delay an available action for visual effect;
- animate every card on page load;
- move layout on hover;
- use scroll-jacking.

## Reduced motion

All frontend-system CSS collapses animation and transition duration under `prefers-reduced-motion: reduce`. State must remain understandable without motion.

## Product nuance

Business is fastest and most functional. Wealth is calmer. Growth may use faster confirmation feedback. Academy uses subtle editorial continuity. Flow may animate only data/path relationships that help explain the graph.

Product nuance cannot override accessibility or interaction latency.
