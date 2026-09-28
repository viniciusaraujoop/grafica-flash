# Orçaly — Component Inventory

Status legend:
- **implemented**: isolated frontend namespace contains a reference implementation;
- **existing**: certified component already exists in Foundation/Growth/Academy and is reused by contract;
- **pattern**: architecture is defined; implementation should be created only when a real consumer appears.

| Component / pattern | Status | Location / note |
| --- | --- | --- |
| DesignSystemRoot | implemented | `components/orcaly-next/design-system/DesignSystem.tsx` |
| AppShell | implemented | `components/orcaly-next/shell/AppShell.tsx` |
| GlobalHeader | implemented inside shell | ecosystem controls |
| ProductSidebar | implemented inside shell | desktop/tablet |
| MobileNav | implemented inside shell | recomposed mobile navigation |
| ProductLauncher | implemented | native `details` reference surface |
| CommandPalette | existing | `components/orcaly-next/command-palette/CommandPalette.tsx` |
| PageHeader | implemented | visual hierarchy + actions |
| SectionHeader | implemented | open section hierarchy |
| Breadcrumbs | implemented inside shell | context bar |
| Button / IconButton | implemented | semantic variants |
| Input / Textarea / Field / FormError | implemented subset | reference form semantics |
| Select / Checkbox / Radio / Switch | pattern | add when product form consumes them |
| Tabs | implemented | navigation pattern |
| SegmentedControl | pattern | only for mutually exclusive local view mode |
| Modal / Drawer / Sheet | pattern | use native dialog / responsive sheet contract |
| Popover / Tooltip / Dropdown | pattern | only when supporting content/actions require |
| Toast / Banner | pattern | existing Foundation state language applies |
| Skeleton | implemented | known-shape loading only |
| EmptyState / ErrorState | implemented as StateView | separate state semantics |
| DataTable | implemented | caption + headers + mobile row summary |
| List | pattern | native lists preferred until abstraction repeats |
| Metric | implemented | open metric, no card required |
| ChartFrame | implemented | plot + exact-value table |
| Timeline | preview pattern | `FrontendSystemPreview` |
| Stepper | preview pattern | wizard archetype |
| Progress | existing | Academy progress patterns |
| Status | implemented | text + dot, not pill-by-default |
| Avatar | pattern | no invented imagery |
| SearchField | preview pattern | visible label |
| FilterBar | pattern | Growth/Academy existing examples |
| ActionMenu | pattern | native/menu implementation when real actions exist |

## Consolidation rule

Do not migrate certified runtime screens merely to increase adoption numbers. The namespace is an integration target. Runtime migration happens separately, per product, with regression coverage.

## Known existing assets

Foundation already provides scoped tokens, StatusPill, StateBlock and DemoBanner. Growth provides analytical/experiment patterns. Academy provides reader/library/notes patterns. Launcher and Command Palette already have keyboard-focused prototypes. This architecture does not duplicate those domains.
