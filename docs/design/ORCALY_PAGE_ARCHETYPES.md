# Orçaly — Page Archetypes

Registry: `lib/orcaly-next/frontend/archetypes.ts`. Reference rendering: `components/orcaly-next/frontend/FrontendSystemPreview.tsx`.

Every archetype must survive desktop, tablet, mobile, loading, empty/error where relevant, disabled controls, keyboard focus and dark mode.

| Archetype | Primary task | Default density | Mobile transformation |
| --- | --- | --- | --- |
| Dashboard | prioritize | comfortable | metrics collapse; priority content first |
| Data List | scan + act | compact | table rows become labelled summaries |
| Detail | understand + act | comfortable | side activity moves below main data |
| Analytics | compare | comfortable | plot stacks; exact table remains |
| Settings | configure | comfortable | single column; save action stays explicit |
| Editor | create | comfortable | outline becomes horizontal/inline navigation |
| Wizard | complete steps | comfortable | steps scroll horizontally; content single column |
| Checkout | confirm | comfortable | one decision stream, no side-by-side squeeze |
| Reader | read | editorial | TOC enters document flow before article |
| Search | find | comfortable | full-width field, compact result summaries |
| Empty State | recover empty | comfortable | copy/action remain left-aligned |
| Error State | recover failure | comfortable | recovery action remains primary |
| Onboarding | orient | editorial | one task per viewport segment |
| Command Surface | navigate fast | compact | near-full-width surface |
| Timeline | trace | comfortable | narrower time rail |
| Workflow Canvas | compose flow | compact | nodes become vertical sequence / pan surface |
| Marketplace Discovery | discover + compare | comfortable | result grid becomes list |
| Financial Overview | understand money | comfortable | headline values stack, context stays adjacent |

## Reference product prototypes

The preview also includes:
- Hub shell;
- Business dashboard and list;
- Wealth overview;
- Growth analytics;
- Academy reader;
- Flow canvas;
- Market discovery;
- Partners performance;
- Settings;
- Command surface;
- Product launcher;
- Mobile shell.

All sample values are explicitly demo content. The preview does not create application routes.
