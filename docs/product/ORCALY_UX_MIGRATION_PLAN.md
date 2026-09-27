# Orçaly — UX Migration Plan (incremental, sem big-bang)

Princípio: cada etapa é um PR independente, atrás de flag quando muda UI visível, com rollback por revert simples. Wealth certificado só muda depois do agente principal fechar sua fila (Alerts → … → Regulatory) ou com coordenação explícita.

Legenda de dificuldade de integração: **B**aixa · **M**édia · **A**lta.

| # | Etapa | Arquivos impactados | Risco | Depende de | Rollback | Validação | Dif. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | **Esta branch** (isolada) | só novos: `lib/orcaly-next/**`, `components/orcaly-next/**`, `docs/product/**`, 2 scripts | Nenhum no runtime | — | não mergear | 17 testes unit + 112 checks visuais | B |
| 1 | **Foundation tokens** disponíveis | `components/orcaly-next/foundation/*` promovido a `components/ui-foundation/*`; `app/globals.css` **não** muda | Baixo (escopado em `.root`) | 0 | revert | build + visual QA | B |
| 2 | **Breakpoints + tokens no Tailwind** | `app/globals.css` (`@theme` com breakpoints/spacing) | Médio — CSS global | 1 | revert | diff visual em Business/Hub/Wealth nas 6 larguras antes/depois | M |
| 3 | **Product Registry v2** | `lib/ecosystem/products.ts` passa a derivar de `lib/orcaly-next/product-registry.ts` (mesma API pública); `package.json` `test:ecosystem` += teste do registry | Médio — consumido por Hub, landings, Wealth layout, access | 0 | revert (API idêntica) | paridade já testada; `scripts/test-ecosystem.mjs` sem alteração deve passar | M |
| 4 | **Skins** aplicados via `FoundationRoot` | `app/apps/wealth/layout.tsx` (troca `productTheme` por `skinStyle` — mesmas cores), `app/apps/layout.tsx` | Baixo-médio (layout Wealth) | 1, 3 | revert | hosted QA Wealth completo (matriz existente) | M |
| 5 | **Hub 2** | `app/apps/page.tsx` renderiza `Hub2Prototype` atrás de flag `ecosystem.hub2`; snapshots reais substituem consultas diretas (A19) | Médio | 3, 4 + snapshots por produto | flag off | E2E Hub com conta real staging: 8 estados, sem vazamento cross-product | M |
| 6 | **Launcher** no header | `components/ecosystem/EcosystemHeader.tsx` (remove link fixo "Planos Business", A19/A16) | Baixo | 5 | flag | harness + E2E teclado | B |
| 7 | **Command Palette** | header do Hub e dos apps (`app/apps/layout.tsx`, depois painel) | Baixo | 3, 6 | flag | harness + E2E; teste de não-vazamento com statuses reais | B |
| 8 | **Product Landings** | `app/produtos/[slug]/page.tsx` usa `ProductLanding` por produto (flag por slug); `generateMetadata` inalterado | Baixo | 3 | flag por produto | SEO snapshot, visual QA, revisão de conteúdo pelo dono | B |
| 9 | **Auth neutro (Orçaly ID)** | `app/login`, `app/mfa`, `lib/ecosystem/server.ts` (deep link, A21) | **Alto** — auth core | coordenação com agente principal | revert + flag | E2E auth existente (`e2e:auth`) + deep link + MFA | A |
| 10 | **Migração por produto** | Partners → `/apps/partners`; Business → `ProductShell` + adaptador de `panel-modules`; depois `/apps/business` com redirects 308 | **Alto** (Business é produção) | 1–9 | redirects reversíveis; manter rotas antigas por ≥ 1 ciclo | suíte Business completa + hosted QA por grupo de módulos | A |

## Paralelo contínuo (baixo risco, a qualquer momento após 1)
- Consolidação de primitives C1 → C2 → C3 → C12 → C7 (ver `ORCALY_COMPONENT_CONSOLIDATION.md`), um componente por PR.
- `loading.tsx`/`error.tsx` por grupo de rotas do Business e Admin (A4).
- ConfirmDialog substituindo `alert/confirm` por área (A12).

## Coordenação necessária (não fazer sem o agente principal)
`package.json`, `app/globals.css`, `lib/ecosystem/*`, `app/apps/layout.tsx`, `app/apps/wealth/layout.tsx`, auth (`lib/ecosystem/server.ts`, `/login`, `/mfa`), `app/painel/premium.css`, limpeza de backups (A6).

## O que NÃO entra neste plano
Billing multi-produto, Entitlements efetivos, Consent Fabric, One comercial, Intelligence runtime — são fases próprias do roadmap; este plano só prepara a UI para consumi-las.
