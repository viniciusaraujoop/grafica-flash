# Orçaly.com.br — Main Site Visual Redesign Baseline

Starting commit before redesign branch: `8bd23d1f79417eebf709f73d6aa900231ee66ba5`

Visual baseline deployed immediately before this redesign: `65620215c0106a90b5e4e454e04704169edf07bd` / `dpl_6oCk97pyezUSFkUE3z2vxrh3SxNu` (READY).

## Scope lock

Visual-only redesign. Do not change product copy, plan data, pricing, href destinations, CTA semantics, forms/contracts, authentication, assistant API, analytics/referral tracking, SEO metadata, JSON-LD, sitemap, robots, backend or database.

## Current route/components

- `/` → `app/page.tsx` (Server Component, metadata + SoftwareApplication JSON-LD)
- `components/marketing/MainSiteV2.tsx` → public homepage composition
- `components/marketing/ProductDemoTabs.tsx` → interactive product demo tabs
- `components/marketing/PlanSelector.tsx` → interactive plan selector
- `components/marketing/ReferralBridge.tsx` → affiliate/referral persistence and tracking
- `components/home/HomeAiChat.tsx` → public assistant
- `lib/marketing/main-site.ts` → canonical plans, pricing, solutions, features and FAQ

## Section inventory

1. Sticky header / desktop navigation / mobile navigation
2. Hero + primary/secondary CTAs + product visual
3. Product flow + ProductDemoTabs
4. Segment solutions grid
5. Product resources/features
6. Own-site showcase
7. WhatsApp workflow
8. Pricing + PlanSelector
9. How it works
10. Trust/security disclosures
11. FAQ
12. Contact block
13. Final CTA
14. Footer
15. Public Assistant launcher/window

## Functional lock

Required destinations/interactions remain unchanged:

- `#produto`
- `#segmentos`
- `#planos`
- `#recursos`
- `#contato`
- `/cadastro`
- `/login`
- `/parceiros`
- `/suporte`
- `/solucoes/<slug>`
- plan-specific signup URLs from `marketingPlanSignupHref`
- `mailto:orcalybr@gmail.com`
- ProductDemoTabs keyboard semantics
- PlanSelector CTA contract
- ReferralBridge tracking contract
- HomeAiChat API/function contract

## Pricing lock

- Básico — R$ 49,90/mês
- Intermediário — R$ 99,90/mês
- Premium — R$ 149,90/mês

## SEO/function preservation

`app/page.tsx`, `lib/marketing/main-site.ts`, sitemap and robots are content/contract locked for this redesign unless a purely presentational type import becomes technically necessary. No intentional metadata or structured-data change is allowed.
