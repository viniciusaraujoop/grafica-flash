# Orçaly — Auditoria do Frontend Atual

Branch de análise: `claude/orcaly-ux-foundation` · Base: `codex/orcaly-ecosystem@9d8c0a7c26b6db5851a6a6624a16eca3b8063e39` · Data: 2026-09-27

> Auditoria somente-leitura. Nenhum arquivo auditado foi alterado. Números abaixo foram medidos com `find`/`grep` sobre `app/` e `components/` nesse SHA; comandos reproduzíveis no apêndice.

## 1. Inventário

| Área | Rotas (`page.tsx`) | Layout próprio | loading/error | Sistema de estilo |
| --- | --- | --- | --- | --- |
| Público/marketing (`/`, `/business`, `/produtos/[slug]`, `/solucoes/[slug]`) | ~8 | root | root `error.tsx`, `global-error.tsx` | `MainSitePremium.module.css` (1125 linhas) + `ecosystem.module.css` |
| Business (`/painel/**`) | 85 diretórios, ~110 páginas | `app/painel/layout.tsx` + `PanelAuthenticatedLayout` | 1 `loading.tsx`, 1 `error.tsx` para toda a área (+ assinatura) | `premium.css` **global** (1935 linhas) + 3 CSS modules (~1180 linhas) + Tailwind inline |
| Hub (`/apps`) | 2 | `app/apps/layout.tsx` | nenhum | `ecosystem.module.css` (21 linhas minificadas) |
| Wealth (`/apps/wealth/**`) | 24 | `app/apps/wealth/layout.tsx` (só tema) | 12 `loading` + 12 `error` | `ecosystem.module.css` + 2 CSS modules mínimos |
| Partners (`/parceiros/**`) | 8 | 3 layouts | nenhum | Tailwind inline (componentes de 8952 linhas) |
| Admin (`/admin/**`) | 35 | `app/admin/layout.tsx` + `AdminShellV2` | nenhum | Tailwind inline |
| Tenant público (`/site`, `/loja`, `/pedido`, `/proposta`, `/cliente`, `/checkout`) | ~20 | root | root | Tailwind + `public-site/*` |

Totais: 376 arquivos `.tsx` em `app/`+`components/`, 202 `page.tsx`, 8 `layout.tsx`, 14 arquivos CSS (6109 linhas).

**Fonte de verdade de produto já existente:** `lib/ecosystem/products.ts` (8 produtos, 98 linhas) + `lib/ecosystem/experience.ts` (tema → CSS vars) + `lib/ecosystem/access.ts` (decisão de acesso pura). É uma base boa e deve ser **evoluída**, não substituída (ver Decisão D1 no handoff).

## 2. Achados

Severidade: **CRÍTICA** (bloqueia a arquitetura multi-produto) · **ALTA** (afeta consistência/a11y em escala) · **MÉDIA** · **BAIXA**.

### A1 — Três "sistemas de design" paralelos sem tokens compartilhados — ALTA
- **Arquivos:** `app/painel/premium.css` (vars `--orcaly-panel-*`), `components/ecosystem/ecosystem.module.css` (vars `--ink/--muted/--line/--accent`), `app/MainSitePremium.module.css`, Tailwind default em Partners/Admin, `app/globals.css` (só `--background/--foreground`).
- **Evidência:** 2217 hex codes em `.tsx` (105 distintos) + 614 em CSS (393 distintos). O mesmo "ink" aparece como `#12223d`, `#10213c` e `#171717`.
- **Impacto:** cada produto novo tende a copiar um dos três; skins viram "clones mudando cor".
- **Recomendação:** camada de tokens semânticos `--ox-*` escopada (não global) — ver `ORCALY_UX_FOUNDATION_V1.md` §2. Mapear os três conjuntos existentes para ela via aliases antes de migrar telas.
- **Risco de integração:** baixo se escopado por classe; alto se injetado em `:root`.

### A2 — CSS global do Business vaza escopo — ALTA
- **Arquivos:** `app/painel/premium.css` (importado em `app/painel/layout.tsx` **e** em `app/parceiros/demo/layout.tsx`).
- **Evidência:** declara `:root { --orcaly-panel-* }` e seletores globais `.panel-premium-*`. Por ser CSS não-module importado em layout, o stylesheet pode permanecer no documento após navegação client-side para outras áreas (comportamento a confirmar com teste de navegação `/painel → /apps` antes de corrigir).
- **Impacto:** regras do Business podem atingir Hub/Wealth após navegação SPA; demo de parceiros acoplada ao Business.
- **Recomendação:** não tocar agora (runtime protegido). Na migração, mover para CSS module ou escopar tudo sob `.orcaly-panel-premium`.
- **Risco:** médio — muitos componentes usam as classes globais.

### A3 — Breakpoints inconsistentes — MÉDIA
- **Evidência:** ecosystem usa 760/1050/1500; painel usa 520/760/1023/1024/1180; Tailwind usa sm/md/lg (640/768/1024).
- **Recomendação:** Foundation define 5 breakpoints canônicos (§4 da Foundation) e os mapeia para Tailwind 4 `@theme`.

### A4 — Cobertura de loading/error muito desigual — ALTA
- **Evidência:** Wealth tem 12/24 rotas com `loading`+`error` dedicados. Business tem 1 `loading`/1 `error` para ~110 páginas. Admin, Partners e Hub: zero.
- **Inconsistência interna:** `app/apps/wealth/impostos/loading.tsx` não tem `role="status"` (os outros 11 têm).
- **Recomendação:** primitives `LoadingState` / `ErrorState` da Foundation; checklist de rota nova exige ambos.
- **Risco:** baixo (arquivos novos por rota).

### A5 — Primitives duplicados com comportamento divergente — ALTA
Detalhado em `ORCALY_COMPONENT_CONSOLIDATION.md`. Destaques:
- `StatusBadge`/`statusBadge`/`Badge`: 9 implementações (`components/panel-ui`, `food/food-shared`, `subscription/SubscriptionManager`, `app/painel/produtos/page.tsx`, `food/DeliveriesManager`, `painel/MarketplacePaymentsPanel`, `painel/PanelSegmentSidebar`, `admin/OwnerBackofficeClient`, `app/admin/indicacoes/page.tsx`).
- `EmptyState`/`Empty`: 6 implementações.
- `planLabel()` duplicado com **mapeamento divergente**: `PanelSidebar.tsx` mapeia `basico → 'Essencial'`; `PanelSegmentSidebar.tsx` mapeia `basico → 'Básico'`. Mesmo plano, rótulos diferentes.
- `components/panel-ui/index.tsx` já tem 25 primitives (Modal, Drawer, Table, Skeleton, Toast…) mas só **2 arquivos** o importam.

### A6 — Código morto no caminho de navegação — MÉDIA
- `components/painel/PanelSegmentSidebar.tsx` e `components/painel/PanelAdaptiveOverview.tsx`: 0 importadores.
- 205 arquivos `*.backup*` versionados (ex.: 10 backups de `lib/panel-modules.ts`, 7 de `current-company-client.ts`).
- Raiz do repo: 205 scripts `.ps1`, 13 logs/txt, 7 `.zip` (~15 MB).
- **Recomendação:** limpeza em PR separado, coordenado com o agente principal (fora do escopo desta branch — não removido aqui).

### A7 — Quatro fontes de navegação para o Business — ALTA
- `lib/panel-modules.ts` (1450 linhas, 64 hrefs), `lib/segment-modules.ts` (1395, 66), `lib/business-types.ts` (500, 29), `lib/operations-experience.ts` (55). `PanelSidebar` combina três delas.
- **Impacto:** Product Registry não pode simplesmente "adotar" a navegação do Business; precisa de um adaptador.
- **Recomendação:** Registry expõe `navigation.source: 'registry' | 'legacy-adapter'`; Business declara `legacy-adapter` e continua usando `panel-modules` até a migração (ver Registry spec).

### A8 — Hardcode de rotas/produtos fora do registry — MÉDIA
- `'/painel/inicio'` em 11 arquivos; `'/apps/wealth'` em 11; `'/parceiros/painel'` em 3.
- `app/apps/page.tsx` monta um `Record<string, {href,label}>` à mão para business/partners/wealth (duplica `startUrl` do registry).
- `app/produtos/[slug]/page.tsx`: CTA decide destino com ternário `product.id === 'business' ? '/business' : '/parceiros'`, e bloco especial `product.id === 'wealth'`.
- Strings "Orçaly Wealth" hardcoded em 8 páginas Wealth.
- **Recomendação:** `resolveProductDestination()` e `landing` no novo registry (implementados isoladamente nesta branch).

### A9 — `startUrl` apontando para rotas inexistentes — MÉDIA
- `lib/ecosystem/products.ts`: `growth → /apps/growth`, `flow → /apps/flow`, `academy → /apps/academy`, `market → /apps/market`, `one → /apps/one`. Nenhuma dessas rotas existe em `app/`.
- Mitigado hoje porque `status: 'planned'` bloqueia o acesso, mas o dado é enganoso para qualquer consumidor novo (launcher, palette, PWA).
- **Recomendação:** registry novo exige `routeStatus: 'LIVE' | 'NOT_BUILT'` e testes impedem rota `NOT_BUILT` sem `COMING_SOON`.

### A10 — Status de produto com vocabulário insuficiente — ALTA
- Hoje: `available | preview | planned` (catálogo) e `AccessDecision.reason` (acesso). Não há representação para TRIAL, PAYMENT_PENDING, SUSPENDED, BLOCKED_EXTERNAL.
- **Recomendação:** separar *release status* (do produto) de *user status* (da conta), e derivar os 8 estados do Hub a partir dos dois. Implementado em `lib/orcaly-next/product-status.ts`.

### A11 — Wealth sem navegação de produto — ALTA
- `app/apps/wealth/page.tsx`: acesso aos 14 módulos é uma pilha de 7+ `Link.textButton` no topo da página. Sem nav persistente, sem indicação de seção ativa, sem mobile nav.
- `app/apps/wealth/layout.tsx` só aplica tema.
- **Recomendação:** `ProductShell` com navegação declarada no registry (Wealth: 5 grupos). Não alterado nesta branch (rota certificada).

### A12 — Diálogos nativos — MÉDIA
- 28 chamadas `alert()`/`confirm()` em 25 arquivos. Bloqueiam a thread, não seguem tema, não são testáveis por Playwright sem handlers.
- **Recomendação:** `ConfirmDialog` da Foundation; ações destrutivas/financeiras seguem o contrato de confirmação (`ORCALY_INTELLIGENCE_UX_CONTRACT.md` §9).

### A13 — Tabelas sem semântica completa — MÉDIA
- 21 arquivos com `<table>`; 7 com `<caption>`; 4 com `scope="col"`.
- **Recomendação:** `DataTable` primitive com caption obrigatória (visível ou `sr-only`) e `scope`.

### A14 — Foco visível inconsistente — MÉDIA
- Apenas 8 arquivos definem `focus-visible`. Ecosystem usa outline 3px `#0c67ce` offset 5px; painel usa outros valores; Tailwind usa default do navegador.
- **Recomendação:** um único anel de foco (`--ox-focus-ring`) na Foundation.

### A15 — Tipografia sem escala — MÉDIA
- Toda a UI usa `Arial, Helvetica, sans-serif` (globals, ecosystem, `experience.font`). Tamanhos ad-hoc: 8px, 9px, 10px, 11px aparecem no Hub/ProductCard (`.orbitCenter small{font-size:8px}`, `.status{font-size:9px}`).
- **Impacto:** texto < 12px falha legibilidade em mobile; 8–9px está abaixo de qualquer mínimo razoável.
- **Recomendação:** escala base com mínimo 12px; "display typography" é o ponto de personalidade por skin. Manter Arial como fallback — a bíblia pede não trocar identidade sem orientação.

### A16 — Header do ecossistema em telas estreitas — MÉDIA
- `EcosystemHeader`: logo 140px + 3 itens de nav com `gap:30px` + padding 48px. A regra `@media(max-width:760px)` reduz padding, mas o nav não colapsa. Verificação visual a 320px fica pendente de ambiente autenticado (Hub exige login).
- **Recomendação:** launcher substitui links de produto no header; nav colapsa em ≤ 767px.

### A17 — Estado de consent/privacidade tem boa base — POSITIVO
- `app/apps/privacidade`, `RevokeConsent.tsx`, `permitsContextTransfer()` puro e testado. Hub já diz "nenhum dado pessoal é transferido automaticamente". Manter esse tom em todos os protótipos.

### A18 — Reduced motion razoavelmente coberto — POSITIVO
- 33 arquivos tratam `prefers-reduced-motion`; `aria-live`/`role=status` em 74 arquivos; nenhum `<img>` sem `alt`. Base de a11y é melhor que a média; o problema é consistência, não ausência.

### A19 — Suposições Business-específicas na UI global — MÉDIA
- `EcosystemHeader` tem link fixo "Planos Business" no nav principal do ecossistema.
- `app/apps/page.tsx` consulta `companies` e `affiliate_profiles` diretamente no Hub.
- **Recomendação:** Hub consome um *read model* por produto (`HubProductSnapshot`), e o header não privilegia um produto.

### A20 — Logos de produto incompletos — BAIXA (documentado)
- `public/brand/README.md`: Business/Flow/Market/Partners/One sem logo primário limpo nem favicon/PWA icon (`ASSET_MISSING`). Protótipos usam wordmark em texto, nunca logo inventado.

### A21 — Deep link perdido no login/MFA do ecossistema — MÉDIA
- **Arquivo:** `lib/ecosystem/server.ts#requireEcosystemIdentity` — `redirect('/login?next=%2Fapps')` e `redirect('/mfa?next=%2Fapps')` fixos.
- **Impacto:** um link para `/apps/wealth/metas/<id>` (e-mail, notificação, Pulse) leva ao Hub após login, não ao destino.
- **Recomendação:** receber o path atual e validar com `safeNextPath` (já existe em `lib/auth-navigation.ts`).
- **Risco:** auth runtime — **não alterado nesta branch**; coordenar com o agente principal.

## 3. Ordem de correção sugerida

| # | Achado | Tipo | Depende de |
| --- | --- | --- | --- |
| 1 | A10, A9, A8 | Registry isolado (feito nesta branch) | — |
| 2 | A1, A3, A14, A15 | Tokens da Foundation escopados (feito como `orcaly-next/foundation`) | — |
| 3 | A5, A12, A13, A4 | Primitives + adoção incremental | 2 |
| 4 | A11, A16, A19 | ProductShell + Launcher no header | 1, 3 |
| 5 | A7 | Adaptador de navegação Business | 1, 4 |
| 6 | A2, A21 | Escopar `premium.css`; preservar deep link no login | coordenação com Business / auth |
| 7 | A6 | Limpeza de backups/scripts | coordenação com agente principal |

## Apêndice — comandos

```bash
find app components -name '*.tsx' | wc -l                       # 376
grep -rhoE '#[0-9a-fA-F]{6}\b' app components --include=*.tsx | wc -l   # 2217
grep -rlE 'window\.(confirm|alert)\(|[^.a-zA-Z](confirm|alert)\(' app components --include=*.tsx | wc -l  # 25
grep -rl '<table' app components | wc -l; grep -rl '<caption' app components | wc -l  # 21 / 7
find . -path ./node_modules -prune -o -name '*.backup*' -print | wc -l   # 205
```
