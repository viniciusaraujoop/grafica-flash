# Growth — Persistence Contract (proposta; NADA aplicado)

**Nenhuma migration, tabela, função ou policy foi criada.** Este documento é o handoff para o owner de migrations (hoje o agente principal). Tipos de origem: `lib/orcaly-next/growth/types.ts`.

## Princípios comuns a todas as tabelas
- **Scope:** `company_id uuid not null` em toda linha. Growth é company-scoped; nunca `user_id` como dono do dado.
- **RLS:** habilitada em todas. Leitura = membro ativo da empresa **e** entitlement `product.growth` ativo **e** permissão `growth.read`. Escrita = `growth.write` (dados/rascunhos) ou `growth.manage` (transições de estado, decisões, invalidação). Seguir o padrão Wealth: `public` INVOKER → `private` DEFINER com `search_path` fixo → auth → entitlement → membership/permissão → CAS → advisory lock quando necessário → recibo idempotente.
- **Sem `service_role` no caminho do usuário.** Cross-product: DENY BY DEFAULT.
- **CAS:** `version bigint not null default 1`; toda mutação envia `expected_version`; conflito → erro de contrato `PT409`.
- **Idempotência:** mutações recebem `idempotency_key uuid`; tabela `growth_idempotency_receipts (company_id, key, operation, response_hash, created_at)` com unique `(company_id, key)`; replay retorna a mesma resposta.
- **Dinheiro/contagens:** `bigint` (centavos/contagens), `check (>= 0)`; **nunca** `numeric` com float nem `double precision` como fonte de verdade. Valores derivados (CTR, CAC…) **não são armazenados** — recalculados pelo domínio.
- **Ausente ≠ zero:** colunas de métrica são `NULL` quando não informadas.
- **Audit:** tabela `growth_audit (id, company_id, actor_id, entity, entity_id, action, before_version, after_version, at, request_id)` — sem valores de negócio completos no log.
- **Retenção:** enquanto a empresa mantiver o produto; após cancelamento, leitura por 90 dias e exclusão lógica (`archived_at`), exclusão física por job após prazo definido pelo jurídico (**não definido — bloqueio**).

## growth_experiments
| Campo | Tipo | Regra |
| --- | --- | --- |
| id | uuid pk | |
| company_id | uuid not null fk companies | scope |
| title | text not null | 3–120 |
| status | text not null | check in (DRAFT, READY, RUNNING, PAUSED, COMPLETED, CANCELLED, INVALIDATED) |
| single_arm | boolean not null default false | |
| status_reason | text null | obrigatório (check) para PAUSED/CANCELLED/INVALIDATED; ≤ 500 |
| started_at / ended_at | timestamptz null | |
| version | bigint not null default 1 | CAS |
| created_by / updated_by | uuid | |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz null | |

Índices: `(company_id, status, updated_at desc)`, `(company_id, updated_at desc)`. Transições **só** via função privada que aplica a mesma máquina de estados de `experiment.ts#transition` (tabela de transições replicada e testada em PG).

## growth_hypotheses (1:1 com experimento)
Campos: `experiment_id uuid pk fk`, `company_id`, `statement text` (10–500), `expected_direction text check in ('increase','decrease')`, `primary_metric text` (check por regex `^(impressions|clicks|leads|conversions|spend_cents|revenue_cents|ctr|cpc|cpl|conversion_rate|cac|roas|custom:[a-z][a-z0-9_]{0,39})$`), `baseline_numerator bigint null`, `baseline_denominator bigint null check (> 0)`, `baseline_window daterange null`, `baseline_source text null`, `criteria_comparator text null`, `criteria_threshold_bps integer null check (abs <= 100000)`, `criteria_min_sample_per_arm integer null check (1..1e9)`, `minimum_duration_days integer not null check (1..365)`, `observation_window daterange null`, `assumptions text[]` (≤ 10 × 280), `risks text[]`, `source text not null`, `version`, timestamps.
Regra: após `RUNNING`, hipótese e critério ficam **imutáveis** (trigger rejeita update) — mudar critério depois de ver dados é p-hacking.

## growth_variants
`id uuid pk`, `experiment_id fk`, `company_id`, `label text`, `role text check in ('control','variant')`, `description text`, `position smallint`. Unique `(experiment_id, label)`; partial unique `(experiment_id) where role='control'` (um controle). Máx. 6 por experimento (trigger). Imutável após RUNNING.

## growth_metrics (métricas acompanhadas)
`experiment_id`, `company_id`, `metric_key text` (mesmo check), `position`. PK `(experiment_id, metric_key)`.

## growth_observations
| Campo | Tipo | Regra |
| --- | --- | --- |
| id | uuid pk | |
| company_id, experiment_id, variant_id | uuid | variant pertence ao experimento (fk composta) |
| window | daterange not null | ≤ 366 dias |
| source_id | text not null | `manual` no MVP |
| provenance | text check in ('DECLARED','MEASURED') | |
| impressions, clicks, leads, conversions, spend_cents, revenue_cents | bigint null check (>= 0 and <= 10^15) | NULL = desconhecido |
| custom | jsonb null | chaves `^[a-z][a-z0-9_]{0,39}$`, ≤ 20, valores inteiros string |
| evidence_url | text null | `https://` apenas (check) |
| recorded_by, recorded_at | | |
| idempotency_key | uuid | |
Checks: `clicks <= impressions` quando ambos não nulos. Índices: `(experiment_id, variant_id, lower(window))`, `(company_id, recorded_at desc)`. Observações só aceitas em RUNNING/PAUSED (trigger). Correção = nova observação + marcação `superseded_by` (append-only; nunca update de valores).

## growth_learnings
`id`, `company_id`, `experiment_id`, `kind text check in ('FACT','INTERPRETATION','DECISION')`, `text` (5–1000), `observation_ids uuid[]`, `limitation text null`, `decision_id uuid null fk growth_decisions`, `created_by`, `created_at`. Checks espelhando `validateLearning`: FACT exige `observation_ids` não vazio e sem `decision_id`; INTERPRETATION exige `limitation`; DECISION exige `decision_id`. Append-only.

## growth_decisions (Decision Receipt persistido)
`id`, `company_id`, `experiment_id`, `action text check in (...)`, `rationale text` (1–1000), `outcome text` (resultado no momento da decisão), `receipt jsonb not null` (snapshot completo do `GrowthDecisionReceipt`: observado, dados usados, período, critério, conclusão permitida, limitações, próximo passo), `decided_by`, `decided_at`, `idempotency_key`.
Regra de servidor: recalcular o resultado **no banco/serviço** e rejeitar `adopt_variant` se o outcome não for `MEETS_DECLARED_CRITERIA` (mesma tabela `PERMITTED_ACTIONS`). Imutável; correção = nova decisão referenciando a anterior.

## Testes exigidos antes de aplicar (PGlite + staging)
RLS owner/cross-tenant/cross-user · entitlement ausente · permissões read/write/manage · CAS/PT409 · idempotência/replay · transições inválidas · imutabilidade após RUNNING · checks de métrica/valor · NULL ≠ 0 · append-only de observações/aprendizados/decisões · bloqueio de adopt sem critério · cleanup.
