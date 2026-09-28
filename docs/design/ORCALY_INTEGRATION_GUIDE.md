# Orçaly — Frontend Integration Guide

This branch is not a production migration. The safe integration unit is deliberately small.

## 1. Preconditions

Before adopting a frontend-system piece:
- preserve the product's domain functions and authorization;
- identify the current navigation source;
- map real loading/empty/error/permission states;
- run the product's current regression suite;
- confirm the page has no dependency on accidental global CSS.

## 2. Recommended order

1. DesignSystemRoot + tokens inside a scoped wrapper.
2. PageHeader / StateView / form/table primitives.
3. Product shell behind one product boundary.
4. Navigation adapter.
5. One representative page per archetype.
6. Mobile and dark QA.
7. Broader migration only after regressions remain green.

## 3. Business

Business currently has legacy navigation and global premium styling. Do not replace both at once. Build an adapter from `lib/panel-modules.ts` into `ShellNavGroup`, mount the new shell around one controlled page, then isolate legacy CSS incrementally.

## 4. Wealth

Adopt product navigation from the existing registry contract. Preserve financial truth and existing Wealth domain functions. Missing/unknown values must never become zero while adapting to Metric/ChartFrame.

## 5. Growth

Reuse Growth domain and experiment components. The new shell/page header can wrap them without changing experiment semantics or data provenance.

## 6. Academy

Keep the certified reader/library domain behavior. Apply shell only outside the editorial reading column. Reader typography and notes must remain content-first.

## 7. Flow / Market / Partners / One

- Flow: canvas is the center; shell should not consume excessive horizontal space.
- Market: search/problem framing is primary.
- Partners: pipeline and commission state must remain explicit.
- One: integrate only with commercial/access presentation; never create an operational sidebar.

## 8. No-go changes during visual integration

Do not combine visual migration with:
- database migration;
- auth rewrite;
- billing/payment change;
- product entitlement rewrite;
- production release;
- new third-party UI dependency.

Those combinations make regression attribution needlessly miserable.

## 9. QA checklist

For every integrated page:
- 320/390/768/1024/1440/1920;
- light/dark;
- keyboard order;
- visible focus;
- reduced motion;
- no horizontal overflow;
- large text/reflow;
- actual loading/empty/error;
- permission/entitlement separation;
- product regression suite;
- typecheck/build/lint;
- Axe if executable.

## 10. Rollback

Because integration is scoped, rollback should remove only the adapter/mount point and leave the domain/data layer intact. Do not delete legacy visual code until the replacement has passed production observation.
