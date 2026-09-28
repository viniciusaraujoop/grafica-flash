# Orçaly — Frontend Architecture

## 1. Boundary

This branch is an **isolated frontend architecture layer**. It does not change business rules, database, auth, billing, payment flows, production routes or existing runtime styles.

Namespaces:
- `lib/orcaly-next/design-system/**`
- `lib/orcaly-next/frontend/**`
- `components/orcaly-next/design-system/**`
- `components/orcaly-next/frontend/**`
- `components/orcaly-next/shell/**`
- `docs/design/**`
- `scripts/test-orcaly-frontend-*.mjs`

## 2. Layering

```
existing product registry / skins
          ↓
design-system tokens + primitives
          ↓
global/product shell
          ↓
page archetypes
          ↓
product-specific composition
          ↓
future controlled runtime integration
```

The visual layer consumes product truth. It does not own product entitlement, data loading or authorization.

## 3. Rendering boundary

Default assumption:
- static layout and data display can remain server-renderable;
- interactive islands become client components only when browser state/event APIs are required;
- do not promote a whole page to client rendering for one popover;
- command palette/complex dialogs are isolated interaction boundaries.

The new reference components intentionally avoid Next.js runtime APIs. This keeps the architecture portable and prevents accidental routing/runtime coupling.

## 4. Shell

`AppShell` separates:
- Global Header: ecosystem identity, command, launcher, notifications, account;
- Product Sidebar: current product navigation;
- Context Bar: breadcrumbs/utility context;
- Page content;
- Mobile navigation: recomposed primary destinations.

Mobile is not “desktop minus sidebar”. Navigation is rebuilt as an accessible bottom surface.

## 5. Page composition

Page headers define title, optional description, context/status and actions. Sections rely first on type and spacing. Side panels exist only when information is genuinely secondary.

## 6. Product adaptation

Skins change accent/density/composition while preserving semantic components and accessibility. Product-specific components should compose shared primitives rather than clone them.

## 7. Data and state

UI accepts already-resolved data/state. It must preserve:
- unknown != zero;
- empty != error;
- permission != entitlement;
- blocked external != unavailable local data;
- sample != real data.

## 8. Future integration

Integration should happen product-by-product:
1. mount the shell behind an existing safe feature boundary;
2. adapt current navigation to the shell contract;
3. migrate one page archetype at a time;
4. preserve domain/data functions;
5. run old and new regression suites;
6. only then remove obsolete visual code.

No big-bang replacement.
