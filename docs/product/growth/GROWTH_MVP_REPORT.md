# Orçaly Growth — MVP Report

Branch `claude/orcaly-growth-mvp` · base `claude/orcaly-ux-foundation@0db9b5b` · 2026-09-27

**Status:** domínio + UI + testes + evidência prontos, **isolados**. Nenhuma rota publicada, nenhuma migration, nenhum dado real, nenhuma integração externa, nenhuma IA.

## 1. O que existe agora

### Domínio (`lib/orcaly-next/growth/`, TypeScript puro, sem I/O)
| Arquivo | Responsabilidade |
| --- | --- |
| `types.ts` | GrowthExperiment, Hypothesis, Variant, Metric, Observation, Result, Learning, Decision, Source, Evidence, TimeWindow; 7 status; 5 resultados (sem WINNER/LOSER); proveniência DECLARED/MEASURED/CALCULATED/UNKNOWN |
| `exact.ts` | BigInt: contagens, centavos pt-BR, divisão com arredondamento, variação relativa em bps. Sem float como verdade; testado acima de `Number.MAX_SAFE_INTEGER` |
| `metrics.ts` | Catálogo + CTR, CPC, CPL, taxa de conversão, CAC, ROAS — só com numerador e denominador presentes e denominador ≠ 0; senão `UNKNOWN` com motivo |
| `experiment.ts` | Validação de hipótese, prontidão para RUNNING, máquina de estados com CAS (`VERSION_CONFLICT`) e motivo obrigatório |
| `results.ts` | Avaliação contra o critério **declarado**; `INSUFFICIENT_DATA` por amostra/duração/métrica ausente; `confidence.method = NONE` sempre; frases de conclusão permitidas |
| `decision.ts` | Learning Log (FACT/INTERPRETATION/DECISION) e Growth Decision Receipt; `adopt_variant` bloqueado sem critério atingido |
| `suggestions.ts` | Motor determinístico com 13 regras nomeadas (`R01…R13`), incluindo anti-"peeking" (R13) |
| `manual-input.ts` | Parser de observações manuais: campos permitidos, limites, datas, links `https` apenas, proteção de protótipo |
| `setup.ts` | Formulário → rascunho + checklist de prontidão |
| `workspace.ts` | Board, Home (Observe → Understand → Act), rotas futuras |
| `providers.ts` | Contratos Meta/Google Ads/GA/TikTok — todos `NOT_CONFIGURED` |
| `demo-data.ts` | **DEMO / SAMPLE DATA**, títulos "DEMO ·", empresa `demo-company`; resultados gerados pelo avaliador real |

### UI (`components/orcaly-next/growth/`, Foundation + skin `growth`)
GrowthShell · **GrowthHome** · **ExperimentBoard** · **ExperimentCard** · **HypothesisCard** · **ExperimentDetail** · **ExperimentSetup** (client) · **MetricCard** · **ResultComparison** (barras decorativas + tabela acessível) · **LearningLog** · **DecisionReceipt** · **SourceStatus** · **GrowthEmptyState** · SuggestionList · GrowthPages (views prontas para as rotas).

### Rotas futuras (não publicadas)
| Rota | Componente |
| --- | --- |
| `/apps/growth` | `GrowthHome` |
| `/apps/growth/experimentos` | `GrowthExperimentsPage` (+ `GrowthSetupPage` para novo) |
| `/apps/growth/experimentos/[id]` | `ExperimentDetail` |
| `/apps/growth/aprendizados` | `GrowthLearningsPage` |
| `/apps/growth/fontes` | `GrowthSourcesPage` |
Montagem: layout do produto chama `requireEcosystemIdentity` + avaliação de entitlement `product.growth` (company) e passa dados do read model. `experimentHref()` valida ids.

## 2. Testes

| Suíte | Resultado |
| --- | --- |
| `node --test scripts/test-orcaly-growth-domain.mjs` | **14/14 PASS** — hipótese inválida, sem critério, transições inválidas, CAS, divisão por zero, centavos exatos > MAX_SAFE_INTEGER, métricas ausentes, UNKNOWN vs zero, dados insuficientes, classificação de aprendizados, Decision Receipt, sugestões determinísticas, links inseguros, entrada limitada, dados malformados, fontes, setup |
| Teste de mutação manual (5 bugs injetados) | **5/5 detectados** (div/0→0, adotar com sinal direcional, links http, somas parciais, CAS removido) |
| `node scripts/test-orcaly-growth-visual.mjs` | **259/259 PASS** |
| Regressão Foundation (`orcaly-next-visual-qa`) | **112/112 PASS** |
| Regressão registry (`test-orcaly-next-registry`) | **17/17 PASS** |
| TypeScript strict (ES2017, `noUnusedLocals`) — lib | PASS |
| TypeScript strict — componentes (shim React/Next local) | PASS |

Visual QA cobre: Home, Board, Detail (running, completed com receipt, draft sem hipótese, invalidated), Learnings, Sources (NOT_CONFIGURED), Setup, Empty — em 320/390/768/1024/1440/1920; sem overflow; alvos ≥ 44 px; zero erros de runtime; lint estático de a11y (nomes, ids, hierarquia de títulos, `h1` único, tabelas com caption/scope, `aria-describedby` válido, UNKNOWN nunca como zero); teclado no board (todos os cards alcançáveis, anel de foco, 5 colunas vs lista); setup (foco no primeiro inválido, erro anunciado, checklist, NOT_CONFIGURED honesto); reduced motion; dark (OS e forçado) incluindo superfícies de acento; ausência de linguagem de vencedor e de totais de vaidade.

**Defeitos encontrados e corrigidos pelo QA:** barras invisíveis (span inline), linha de proveniência com estilo de valor, tabela de observações espremida, checklist quebrando "ok" em 390 px, formulário vazio sinalizando só 2 campos, e **bug na Foundation**: variáveis de skin inline sobrescreviam o tema escuro (afetava também Hub/landings da branch anterior).

## 3. Evidência visual
`docs/product/growth/evidence/` — `GROWTH_VISUAL_QA.json` + capturas: home 390/1440/dark, board 390/1440/foco, detail 390/1440/dark, draft, setup preenchido 390, sources 768, empty 1024, learnings 1440.

## 4. Restrições respeitadas
Sem migration · sem banco · sem Supabase · sem rota · sem `package.json` · sem CSS global · sem Wealth/Business/Admin/auth/billing/entitlement runtime · sem WhatsApp · sem provider externo · sem IA · sem dado real.

**Arquivos existentes modificados (2, justificados):** `lib/orcaly-next/skins.ts` e `components/orcaly-next/foundation/foundation.module.css` — ambos da própria Foundation desta linha de branches; correção do bug de tema escuro descrito acima. Paridade de cores, contrastes e os 112 checks da Foundation continuam passando.

## 5. Lacunas conhecidas
- **Sem teste estatístico.** Por design nesta fase: resultado compara com critério declarado e diz explicitamente que não prova causalidade. Próximo passo seria um método explícito (ex.: intervalo para diferença de proporções) com `confidence.method` ≠ NONE.
- **Sem persistência:** ações de estado são exibidas, não executadas; `ExperimentSetup` mostra `NOT_CONFIGURED` ao salvar.
- **Baseline no formulário:** não editável no setup (só via dados); entrar em V2.
- **Multivariante:** domínio suporta até 6 braços; UI de setup cria controle + 1 variante.
- **Axe:** indisponível nesta sessão (registro npm bloqueado); harness aceita `ORCALY_QA_AXE` e deve rodar com Axe na integração.
- **ESLint** dos arquivos novos não executado (mesmo motivo).
- Retenção após cancelamento: prazo jurídico não definido.

## 6. Handoff de persistência
Ver `GROWTH_PERSISTENCE_CONTRACT.md` (7 tabelas + idempotência + audit; RLS/CAS/append-only; imutabilidade de hipótese após RUNNING) e `GROWTH_API_CONTRACT.md` (13 operações, erros, permissões). Owner de migrations deve implementar e testar em PGlite + staging antes de conectar UI.

## 7. Próximos passos recomendados
1. Integrar branch Foundation e esta branch (só arquivos novos + 2 da Foundation).
2. Rodar ESLint + Axe na integração.
3. Owner de migrations implementa `GROWTH_PERSISTENCE_CONTRACT` em staging.
4. Server Actions conforme `GROWTH_API_CONTRACT`, reutilizando o domínio sem duplicar regras.
5. Montar rotas `/apps/growth/**` atrás de `ecosystem.growth`.
6. Só então: integrações (começar por Google Ads ou Meta, com contrato de health real).
