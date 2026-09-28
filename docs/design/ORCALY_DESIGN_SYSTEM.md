# Orçaly — Design System

Implementation:
- `lib/orcaly-next/design-system/tokens.ts`
- `components/orcaly-next/design-system/DesignSystem.tsx`
- `components/orcaly-next/design-system/design-system.module.css`

Everything is scoped. No `:root`, no global stylesheet and no dependency was added.

## Tokens

### Typography

| Role | Size | Leading | Weight |
| --- | ---: | ---: | ---: |
| display | 48px reference | 1.05 | 600 |
| h1 | 36px | 1.12 | 600 |
| h2 | 28px | 1.18 | 600 |
| h3 | 22px | 1.25 | 600 |
| body | 16px | 1.6 | 400 |
| small | 14px | 1.5 | 400 |
| caption | 12px | 1.4 | 500 |
| mono/data | 13px | 1.5 | 500 |
| label | 14px | 1.35 | 600 |
| button | 14px | 1.0 | 700 |

Readable body width: 72ch. Academy reader narrows further.

### Spacing

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px.

### Radius

- subtle 6px
- control 10px
- panel 14px
- modal 18px
- floating 22px
- pill only for true capsule semantics

Radius is semantic, not decorative.

### Surfaces

`canvas`, `surface`, `elevated`, `subtle`, `interactive`, `selected`, `overlay`.

### Borders

Borders are intentionally rare. The system exposes a subtle line and a strong line. Prefer space/type/alignment first.

### Elevation

Two restrained shadow levels:
- raised: local lifted surface;
- floating: launcher/dialog/command surface.

### Density

- compact: Business/technical operation;
- comfortable: general product UI;
- editorial: reading and calm financial context.

Density never reduces accessible target size.

## Core primitives implemented

- DesignSystemRoot
- DemoNotice
- Button / IconButton
- Status
- Field / TextareaField
- PageHeader / SectionHeader
- Metric
- StateView
- DataTable
- ChartFrame
- Tabs
- Skeleton

These are intentionally not a full component-library checklist. A new abstraction is created only after a recurring pattern exists.

## State language

Important states remain distinct:
`empty`, `error`, `loading`, `offline`, `unavailable`, `no_permission`, `no_entitlement`.

No-data must never look like a server error. Permission is not entitlement. Unavailable is not zero.

## Tables

Desktop keeps actual table semantics. Mobile switches rows to labelled summaries while preserving the underlying table. Captions and scoped headers are mandatory.

## Charts

`ChartFrame` always pairs the visual plot with exact values in a semantic table. Color is never the sole data channel. No missing value is converted to zero.

## Dark mode

Dark mode uses separate surface hierarchy, text, line and state pairs. It is not a color inversion and does not use universal pure black.
