# Orçaly — Visual QA Report

Status: **NOT_RUN in this document revision**.

The branch includes a deterministic harness at `scripts/test-orcaly-frontend-visual.mjs`. This report must be updated only from actual execution evidence.

## Required matrix

Viewports:
- 320
- 390
- 768
- 1024
- 1440
- 1920

Themes:
- light
- dark

Checks:
- horizontal overflow;
- clipped/hidden primary actions;
- runtime errors;
- touch targets;
- heading/landmark/name lint;
- focus visibility/order;
- shell/sidebar/mobile navigation behavior;
- table mobile fallback;
- reduced motion;
- command and launcher surfaces;
- 320px large-text reflow.

## Evidence policy

A check not executed is `NOT_RUN`, not PASS. Axe follows the same rule.

## Human anti-template review

Current architecture review: **PARTIAL** until rendered screenshots are inspected.

Structural review completed in source:
- page sections are primarily separated by spacing/type;
- metrics are open rows, not mandatory cards;
- statuses are text + marker, not pill-by-default;
- radii vary by semantic role;
- product compositions differ;
- mobile uses a purpose-built navigation surface;
- no production route or logo redesign was introduced.

Rendered evidence is still required before PASS.
