# Handoff — Claude · UX Foundation / Product Registry / Hub prototypes

STATUS: READY_FOR_REVIEW (frente paralela isolada). Não mergeado, não promovido, sem alteração de runtime.

| Item | Valor |
| --- | --- |
| BRANCH | `claude/orcaly-ux-foundation` |
| BASE SHA | `9a2c66dbb2e6bf00c484b1791103b2bccd15becd` (HEAD de `codex/orcaly-ecosystem` em 2026-09-27; trabalho iniciado em `9d8c0a7`, rebaseado sem conflito — upstream só alterou workflow/E2E do briefing) |
| HEAD | ver `git log -1` da branch (commit único desta entrega) |
| MIGRATIONS | NONE |
| DATABASE CHANGES | NONE (Supabase usado só para leitura de metadados na sessão; nenhuma query de dados) |
| DEPENDENCIES | NONE (`package.json`/`package-lock.json` intactos) |
| GLOBAL RUNTIME CHANGES | NONE |
| SHARED FILES TOUCHED | NONE — todos os arquivos são novos |

## Arquivos criados
Código isolado (nenhum importado por rota existente):
- `lib/orcaly-next/product-status.ts` — 8 estados do Hub, release × conta, precedência
- `lib/orcaly-next/product-registry.ts` — registry v2 + `validateRegistry` + destinos
- `lib/orcaly-next/skins.ts` — contratos de skin + contraste WCAG
- `lib/orcaly-next/command-index.ts` — índice + ranking determinístico
- `lib/orcaly-next/hub-model.ts` — read model do Hub
- `lib/orcaly-next/landing-content.ts` — contratos de conteúdo das 7 landings
- `lib/orcaly-next/navigation.ts` — estado ativo de navegação
- `lib/orcaly-next/demo-data.ts` — dados de demonstração rotulados
- `components/orcaly-next/foundation/{primitives.tsx,foundation.module.css}`
- `components/orcaly-next/launcher/{UniversalLauncher.tsx,launcher.module.css}`
- `components/orcaly-next/command-palette/{CommandPalette.tsx,palette.module.css}`
- `components/orcaly-next/hub/{Hub2Prototype.tsx,hub.module.css}`
- `components/orcaly-next/product-landing/{ProductLanding.tsx,landing.module.css}`

Testes/QA:
- `scripts/test-orcaly-next-registry.mjs` (node:test)
- `scripts/orcaly-next-visual-qa.mjs` (harness esbuild + Playwright fora do Next)

Documentação (`docs/product/`): `ORCALY_CURRENT_FRONTEND_AUDIT.md`, `ORCALY_COMPONENT_CONSOLIDATION.md`, `ORCALY_PRODUCT_UX_SPEC_V1.md`, `ORCALY_UX_FOUNDATION_V1.md`, `ORCALY_PRODUCT_SKINS_V1.md`, `ORCALY_PRODUCT_REGISTRY_SPEC.md`, `ORCALY_HUB_LAUNCHER_PALETTE.md`, `ORCALY_ROUTING_INFORMATION_ARCHITECTURE.md`, `ORCALY_PWA_ARCHITECTURE.md`, `ORCALY_INTELLIGENCE_UX_CONTRACT.md`, `ORCALY_UX_MIGRATION_PLAN.md`, `evidence/orcaly-next/*` (JSON + 12 capturas). Este handoff.

## FILES MODIFIED
NONE.

## Testes executados
| Teste | Resultado |
| --- | --- |
| `node --test scripts/test-orcaly-next-registry.mjs` | **17/17 PASS** |
| `node --test scripts/test-ecosystem.mjs` (existente, regressão) | **51/51 PASS** |
| `scripts/orcaly-next-visual-qa.mjs` (2 execuções seguidas) | **112/112 PASS** ambas |
| TypeScript strict (`noUnusedLocals`) — `lib/orcaly-next/**` | PASS (tsc 6.0.3) |
| TypeScript strict — `components/orcaly-next/**` | PASS **contra shim local de React/Next** (ver limitações) |

Harness cobre: sem overflow horizontal em 320/390/768/1024/1440/1920 (Hub + 3 landings), alvos ≥ 44px, zero erros de runtime, lint estático de a11y (nomes acessíveis, ids duplicados, hierarquia de títulos, `h1` único), banner de demo, 8 estados na galeria, destino subscribed→app/unsubscribed→landing, launcher (foco inicial, 2/3 colunas, setas/Home/End, Esc devolve foco, clique fora, opacidade assentada), palette (Ctrl+K, combobox/activedescendant, ranking sem acento, não vaza rotas sem direito, vazio + contagem live, Esc devolve foco, Enter navega), reduced motion, dark mode.

Defeitos encontrados **pelo próprio QA** e corrigidos antes da entrega: overflow de landings em 320/390 (trilhas de grid `auto`), link de marca abaixo de 44px, `id` duplicado no Hub, cor de nome no launcher por ordem de CSS. Um falso positivo do harness (foco checado antes do evento assíncrono `close` do `<dialog>`) foi corrigido no teste, não no produto.

## TYPECHECK / LINT / BUILD
| Gate | Estado | Motivo |
| --- | --- | --- |
| `npm run typecheck` completo | **NOT RUN nesta sessão** | registro npm bloqueado pela política de rede da sessão (HTTP 403 em `registry.npmjs.org`); `node_modules` não pôde ser instalado |
| ESLint escopado | **NOT RUN** | idem (eslint indisponível). Código escrito para as regras React Compiler do projeto (sem setState síncrono em effect, sem mutação em render) |
| `next build` | **NOT RUN localmente** | idem. O push da branch dispara build de Preview na Vercel — **esse é o primeiro gate real de typecheck+build**; conferir antes de integrar |
| Axe | NOT RUN | pacote indisponível; substituído por lint estático no harness. Integração deve rodar a matriz hospedada padrão (com Axe) |

## Decisões arquiteturais
- **D1 — Registry sucessor, não edição.** `lib/ecosystem/products.ts` é runtime certificado; o v2 vive ao lado com teste de paridade. Adoção = etapa 3 do Migration Plan.
- **D2 — Release × conta.** Os 8 estados derivam de `ReleaseStatus × AccountSignal × externalBlocked`; o registry nunca autoriza.
- **D3 — Tokens escopados em `.root`.** Nada em `:root`/`globals.css`; zero risco de vazamento.
- **D4 — Identidade preservada.** Cores = registry vivo (testado); fonte base Arial mantida; logos ausentes = wordmark texto.
- **D5 — `<dialog>` nativo** para modais (focus trap/Esc/inert da plataforma, sem dependência).
- **D6 — Palette sem IA e sem dados.** Só navegação/ações; ranking determinístico testado.
- **D7 — Landing canônica continua `/produtos/<slug>`** (conflito de `/<produto>` com rotas de tenant).
- **D8 — Partners mapeado para scope `personal`** (registry vivo usa `partner`) — **a confirmar** com o dono do programa.
- **D9 — Sem rota nova.** Protótipos renderizados fora do Next para evidência; nada publicado.

## Conflitos potenciais
- Nenhum com a branch principal hoje (apenas arquivos novos; diff upstream sem sobreposição).
- Futuros: etapa 3 (trocar `lib/ecosystem/products.ts`), etapa 2 (`globals.css`), etapa 4 (`app/apps/wealth/layout.tsx`) — exigem coordenação.
- `components/orcaly-next/**` é `.tsx` e entra no `tsc` do build (tsconfig inclui `**/*.tsx`) — se o build da Vercel acusar erro de tipo, a causa estará isolada nesses arquivos.

## Achados que exigem o agente principal (não alterados aqui)
A2 `premium.css` global · A6 205 backups/scripts/zips versionados · A21 deep link perdido em `requireEcosystemIdentity` (auth) · divergência `planLabel` basico→Essencial vs Básico (rótulo comercial).

## Ordem de integração recomendada
1. Conferir build de Preview desta branch na Vercel.
2. Revisar docs (Audit + Spec) com o dono do produto; aceitar/ajustar marcações [PROPOSTA].
3. Mergear esta branch em `codex/orcaly-ecosystem` **como está** (só arquivos novos) + adicionar o teste do registry a `test:ecosystem` (tocar `package.json` pelo owner).
4. Seguir `ORCALY_UX_MIGRATION_PLAN.md` etapas 1 → 8; 9–10 só após Wealth COMPLETE.

## Blockers
- Registro npm inacessível nesta sessão (typecheck/lint/build completos dependem da Vercel ou de outra máquina).
- Decisões comerciais ausentes: preços, trial, composição do One (renderizados como `NOT_PUBLISHED`/`NOT_CONFIGURED`/`UNDECIDED`).
- Ativos de marca ausentes para Business/Flow/Market/Partners/One.

## Próxima unidade segura
**Consolidação C1 (StatusPill) + C2 (StateBlock) + C3 (LoadingState)** promovendo `components/orcaly-next/foundation` para uso real, começando por telas **não certificadas** do Admin (sem tocar Wealth nem runtime crítico do Business), com visual QA antes/depois.

## Reproduzir QA
```bash
node --test scripts/test-orcaly-next-registry.mjs
ORCALY_QA_ESBUILD=<esbuild> ORCALY_QA_PLAYWRIGHT=<playwright> ORCALY_QA_NODE_PATH=<node_modules com react> \
  node scripts/orcaly-next-visual-qa.mjs
```
