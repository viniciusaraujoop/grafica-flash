# ORÇALY — M1 Shared Foundation — Agent 2 Architecture Challenge

**Agent:** Agent 2 — Senior Architecture / Complex Systems Challenge
**Data:** 2026-09-29
**Target revisado:** `reconcile/m1-shared-foundation-design` @ `2ad113837a25a6ed3e04f00453bec3ac45a9e960` (verificado; sem drift)
**Canonical main:** `2da6a56cf7edc67a1598c18302d73dfdfecbea97` (verificado)
**Documento desafiado:** `docs/migrations/ORCALY_M1_SHARED_FOUNDATION_MIGRATION_DESIGN.md` (1.720 linhas)

**Natureza:** challenge arquitetural. **Não autoriza implementação.** Nenhuma migration, SQL executável, mutação de DB/staging/produção ou alteração de código foi feita. Os fragmentos DDL abaixo são **ilustrativos de contrato**, não arquivos de migration.

---

## 0. Resumo executivo

O design do Agent 1 está **correto na direção**: reusar em vez de substituir, sem segundo event bus, sem segunda fila, sem tabela de Action Registry, com specialist logs preservados e sem inferir entitlement ou consent. Aceito esses princípios integralmente.

O challenge encontrou **cinco problemas que mudam a implementação**. Todos foram verificados em produção e staging por leitura:

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| C1 | **`ecosystem_product_entitlements` não suporta "union de fontes".** Há índices únicos `(user_id, product_id)` e `(company_id, product_id)`, então só cabe **uma** linha por sujeito e produto. Assinatura individual + One + trial simultâneos são impossíveis, e cancelar uma fonte exige apagar ou reescrever a única linha. | staging: `ecosystem_entitlement_user_product`, `ecosystem_entitlement_company_product` | **Bloqueia M1C como proposto.** Precisa virar uma linha por fonte (grant) |
| C2 | **O backfill de M1D é determinístico mas semanticamente errado.** Os 21 `source_id` de produção são referências a **registros internos** criados pelo `refresh_customer_directory`: `order:<uuid>` (18), `proposal:<uuid>` (2), `crm:<uuid>` (1). Não são identidades de origem externa. | prod: `split_part(source_id,':',1)` | Criaria "identity links" que duplicam FKs internas (`orders.customer_profile_id`). **Rejeitar o backfill; adiar M1D** |
| C3 | **`ecosystem_audit_events` hoje é um log de mudança de linha**, alimentado por **~20 triggers** em tabelas Wealth e nas tabelas de entitlement/consent. Estendê-lo como "shared action audit" sem discriminador mistura duas semânticas e dois volumes. | staging: triggers `ecosystem_audit`, `portfolio_audit`, `wealth_*_audit`… | M1B aceito só com discriminador de tipo de registro e uma regra de roteamento |
| C4 | **O inbox atual já não isola usuário nem estado de leitura.** `GET /api/notifications` lista todas as notificações da empresa, inclusive as que têm `user_id`, e o `PATCH` marca como lidas para a empresa inteira. Generalizar para escopo pessoal sobre essa base herda o problema. | `app/api/notifications/route.ts` (main) | M1E precisa ser dividido. Escopo pessoal fica adiado. Achado vai para o Agent 4 |
| C5 | **O outbox está vazio só por acaso.** Os triggers de `orders`/`proposals` estão ativos desde 2026-09-07, mas o último pedido é de 2026-08-09. O primeiro pedido ou proposta nova passa a acumular linhas **sem consumidor e sem retenção**. | prod: `transactional_outbox`=0, `max(orders.created_at)`=2026-08-09 | "Backfill zero" é verdadeiro hoje, mas não é propriedade do sistema. Exige decisão de retenção |

Além disso:
- **M1F deve ser dissolvido.** Cada boundary leva suas próprias constraints e sua própria etapa de validação.
- **A ordem muda.** M1B e M1C não dependem de M1A no nível de DB. M1D sai de M1 e passa a ser pré-requisito do Import Engine.
- **A promoção dos objetos `ecosystem_*` para produção fica condicionada ao primeiro consumidor em produção.**

---

## 1. Tabela de decisões

| Boundary | Decisão | Síntese |
|---|---|---|
| **M1A** Event contract | **ACCEPT_WITH_CHANGE** | Dispatch = relay outbox → `background_jobs` (fan-out por consumidor). Sem colunas de lock no outbox. `dedupe_key` + `correlation_id` em `background_jobs` são **obrigatórios**, não opcionais. `event_idempotency` sem alteração |
| **M1B** Audit | **ACCEPT_WITH_CHANGE** | Estender `ecosystem_audit_events` com `record_kind` (`row_change`/`action`) e regra de roteamento. Criação em produção só junto com o primeiro consumidor |
| **M1C** Entitlement + Consent | **SPLIT** → M1C1 (entitlement) + M1C2 (consent) | M1C1: uma linha por fonte (C1), status derivado do tempo, revogação em vez de DELETE, `one` fora de `product_id`. M1C2: sujeito company vs personal, revogação via RPC, versão de política. M1C2 **HOLD** até decisões de produto |
| **M1D** Customer identity links | **DEFER** (+ **REJECT** do backfill) | Sem produtor real de identidades não-provider hoje. Nasce com o Import Engine. Boundary com `integration_mappings` definido abaixo |
| **M1E** Notification inbox | **SPLIT** → M1E-a (aditivo company-scope) **ACCEPT_WITH_CHANGE**; M1E-b (escopo pessoal) **DEFER** + **NEEDS_SECURITY_REVIEW** | M1E-a só com o que Automation Recipes (Wave 1) precisa: produto, `dedupe_key` e referência de origem |
| **M1F** Constraint validation | **REJECT** como migration própria | Constraints entram com cada boundary. `NOT NULL` tardio vira uma etapa "-V" por domínio |
| Ordem | **CHANGE** | §9 |
| Action Registry | **ACCEPT_WITH_CHANGE** | TS-only para definições. DB guarda `key` + `version` e valida o formato. Renomear é proibido; só depreciar |
| Product Registry | **ISSUE** | Há dois registries TS concorrentes fora de `main` e a lista de `product_id` diverge da de fontes (§11) |
| Wave compatibility | **ISSUE** (resolvível) | C1 bloqueia One/billing; o read state compartilhado (C4) bloqueia Pulse/Hub pessoal |

---

## 2. M1A — Event Fabric

### 2.1 Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Novo event system | **REJECT** (concordo com o Agent 1) | `event_idempotency` + `transactional_outbox` + `background_jobs` bastam |
| `event_idempotency` | **ACCEPT sem alteração** (**REJECT** da "extensão mínima") | É o ledger de **entrada** de providers; já tem `provider`, `event_id`, `company_id`, `event_type`, `status` com `needs_attention`. Não precisa de producer/versão/correlação. Alterar sem consumidor é over-engineering |
| Consumo do outbox | **CHANGE**: relay outbox → `background_jobs`, **nunca** consumo direto do outbox por consumidores | Ver 2.2 |
| Colunas de lock no outbox | **REJECT** | O relay faz claim e settle numa **única transação** (`FOR UPDATE SKIP LOCKED` + `INSERT … SELECT` em `background_jobs` + `UPDATE status`). Não há lock de longa duração, então não há `locked_by`/`locked_at` |
| `dedupe_key` em `background_jobs` | **ACCEPT_WITH_CHANGE → obrigatório no M1A** | Hoje só existem uniques ad hoc por `job_type` (`idx_background_jobs_one_active_integration_sync`, `…google_calendar_full_resync`). O fan-out por consumidor precisa de exactly-once enqueue genérico: `unique (job_type, dedupe_key) where dedupe_key is not null` |
| Escopo | **ACCEPT** (colunas explícitas, sem tabela polimórfica) | `company_id` (existe) + `user_id` novo + `check (num_nonnulls(company_id, user_id) <= 1)`. Ambos nulos = platform |
| `producer` | **ACCEPT_WITH_CHANGE** | `text not null default 'business'`, para que o único writer atual (`orcaly_record_business_event`) continue válido sem alteração |
| `event_version` | **ACCEPT** | `smallint not null default 1 check (event_version >= 1)` |
| `correlation_id` / `causation_id` | **ACCEPT**, **UUID-only** (resposta à Open Question 10) | Trace/request IDs externos são texto não confiável: vão para `request_id text` limitado **apenas no audit**, nunca como chave de correlação |
| `dedupe_key` no outbox | **ACCEPT** | `unique (producer, event_type, dedupe_key) where dedupe_key is not null`. Necessário para eventos temporais de detectores (ex.: `quote.expiring:<id>:<dia>`) |
| `needs_attention` como dead-letter | **ACCEPT** | Mantém um estado terminal só, visível em Operational Health |
| Dispatcher/relay function | **DEFER** (fora de M1A) | Um relay é runtime de dispatch, e a missão proíbe dispatcher. M1A fica **só com colunas e índices** |
| `timeline_events` | **fora de M1** | A falta de `customer_profile_id` no trigger é correção de domínio Business, não Shared Foundation |

### 2.2 Relay para jobs × consumo direto do outbox

| Critério | A. Consumidores fazem claim direto do outbox | **B. Relay outbox → background_jobs (recomendado)** |
|---|---|---|
| Modelos de worker | **dois** (outbox claim + jobs claim) | **um** (`claim_background_jobs` existente) |
| Retry isolado por consumidor | não: uma linha de outbox, N consumidores | sim: 1 job por (evento, consumidor) |
| Poison event | bloqueia todos os consumidores do evento | isola por consumidor (`needs_attention`) |
| Replay seletivo | difícil | re-enfileirar o job de um consumidor com nova `dedupe_key` |
| Colunas novas no outbox | lock + attempts por consumidor | nenhuma de lock |
| Custo | menos linhas | +1 linha de job por consumidor (volume atual: dezenas/dia) |

**RECOMMENDATION:** B. O outbox passa a significar **"fato ocorreu + dispatch pendente/concluído"**, e `background_jobs` passa a significar **"trabalho de um consumidor"**. Isso responde "event occurred vs processed" sem tabela nova.

### 2.3 Mínimo necessário para Flow, Pulse, Intelligence, Customer 360, Notifications, Analytics e Recipes

| Consumidor futuro | Precisa de | Coberto por |
|---|---|---|
| Automation Recipes / Flow | evento com identidade + consumidor idempotente | `outbox.id`, `event_version`, `jobs.dedupe_key = <event_id>:<consumer>` |
| Pulse (detectores temporais) | evento derivado sem duplicar | `outbox.dedupe_key` |
| Customer 360 / Graph | ligação evento→agregado→cliente | `aggregate_type`/`aggregate_id` (existem); o cliente vem do agregado, **não** do evento |
| Notifications | origem rastreável | `correlation_id` repassado ao job e à notificação |
| Intelligence | proveniência | `correlation_id`/`causation_id` |
| Analytics | — | **não** consome o outbox (Reconciliation §6.4) |

Nada além disso entra em M1A.

### 2.4 Riscos de migration

Tabelas com 0 linhas, então `ADD COLUMN … DEFAULT <constante>` é metadata-only (PG ≥ 11) e os índices são instantâneos. O trigger `orcaly_record_business_event` continua funcionando com os defaults. **C5:** sem relay, cada pedido ou proposta nova acumula linhas `queued` para sempre. → **NEEDS_COORDINATOR_DECISION:** aceitar o acúmulo até o dispatcher (volume baixo) **ou** incluir no plano do dispatcher uma retenção explícita (purga de `completed` > N dias). Não resolver com trigger ad hoc.

---

## 3. M1B — Audit

### 3.1 O que o staging mostra

`ecosystem_audit_events(actor_id, event_type, entity_id, recorded_at)` é alimentado por triggers de **DML por linha** em cerca de 20 tabelas (Wealth + entitlement + consent). As 13 linhas atuais são `wealth_recurring_schedules.delete` (5), `ecosystem_product_entitlements.insert` (4) e `…delete` (4).

Isso é um **row-change log**, e além disso mostra que o E2E de staging **apaga** entitlements (ver C1: revogação precisa substituir DELETE).

### 3.2 Decisões

| Tema | Decisão |
|---|---|
| Segunda tabela de audit | **REJECT** (concordo) |
| Estender `ecosystem_audit_events` | **ACCEPT_WITH_CHANGE**: adicionar `record_kind text not null default 'row_change' check (record_kind in ('row_change','action'))`. Sem isso, consultas de "quem fez o quê" misturam cada `UPDATE` de holding com decisões de acesso |
| Dimensões propostas | **ACCEPT**: `actor_kind`, `action_key`, `resource_type`, `resource_id`, `scope_kind`, `company_id`, `product_id`, `producer`, `correlation_id`, `request_id`, `metadata`. Com as mudanças: `action_key` = `<domain>.<entity>.<verb>@<major>` (compatível com o Action Registry); `request_id text check (length <= 128)`; `outcome` (`allowed`/`denied`/`succeeded`/`failed`) só para `record_kind = 'action'` |
| FK de `company_id` | **CHANGE: sem FK** (uuid simples). Audit precisa sobreviver à exclusão da empresa; `ON DELETE CASCADE` apagaria evidência e `SET NULL` apagaria o escopo. `actor_id` com `ON DELETE SET NULL` (existente) é aceitável para erasure |
| Metadata | **CHANGE**: `check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048)` + allow-list de chaves no writer (TS). Proibido no nível de contrato: e-mail, telefone, IP, user agent, payload de provider, segredo, conteúdo de documento |
| Append-only | **ACCEPT**: manter só `select, insert` para `service_role` (estado atual); nenhuma policy para `authenticated`; nenhum `UPDATE`/`DELETE` em código |
| Fail-closed | **CHANGE: resolver por construção.** O audit de entitlement, consent e identidade é escrito por trigger na **mesma transação**: se o audit falha, a mutação falha. O audit de `action` é escrito pela RPC/serviço na mesma transação do efeito. Não sobra caso "audit falhou e a ação passou" para classificar |
| Retenção | **NEEDS_PRODUCT_DECISION**. Proposta: `row_change` 12 meses; `action` de acesso/consent/financeiro 5 anos. Fora da migration |
| Backfill das 13 linhas | **ACCEPT** (mapeamento mecânico, sem inventar company/product) |
| Criação em produção | **CHANGE: condicionar ao primeiro consumidor em produção** (M1C1 em produção ou lançamento do Wealth). Nenhum writer Business precisa dela hoje |

### 3.3 Regra de roteamento (o que é shared e o que fica especializado)

| Evento | Destino canônico |
|---|---|
| Grant/revoke de entitlement, grant/revoke/uso de consent, link/unlink de identidade, merge de cliente, ativação e execução de automação/ação, acesso cross-product | **`ecosystem_audit_events`** (`record_kind = 'action'`) |
| DML de tabelas de produto pessoal (Wealth) | **`ecosystem_audit_events`** (`record_kind = 'row_change'`, triggers existentes) |
| CRUD operacional Business (tarefa, pedido, produto, site) | **`system_audit_logs`** (continua) |
| Ações de admin da plataforma | **`admin_audit_logs`** |
| Detecção/abuso/segurança | **`security_events`** |
| Partners | **`affiliate_audit_logs`** |

**Nunca gravar a mesma ação nos dois destinos.** Sem essa regra, o Business passa a escrever em dois audits e nenhum dos dois fica completo.

---

## 4. M1C — Entitlement e Consent → SPLIT

### 4.1 M1C1 — Entitlement: **ACCEPT_WITH_CHANGE**

| # | Mudança | Motivo |
|---|---|---|
| E1 | **Uma linha por grant (fonte)**: trocar os uniques `(subject, product)` por `unique (coalesce(user_id, company_id), product_id, source, source_reference)` (ou dois parciais equivalentes) | C1. `effective_entitlement = união das grants ativas`: cancelar a assinatura individual não remove o acesso vindo do One. Staging tem **0 linhas**, então a troca é segura |
| E2 | Resolver efetivo como **função/view** (`effective_product_access(subject, product)`), não coluna | a union é computada, nunca armazenada |
| E3 | `status in ('active','revoked')` + `revoked_at`, `revoked_reason`, `updated_at`; **"expired" é derivado** de `expires_at <= now()` | hoje `status='expired'` e `expires_at` competem como fonte da verdade |
| E4 | **Revogação substitui DELETE** no caminho de serviço; DELETE só em erasure | staging mostra `insert`/`delete` de entitlements; o histórico de acesso se perde |
| E5 | **`product_id` continua com CHECK fechado no DB** (**CHALLENGE ao design**, que quer só o shape) | Produtos são poucos, mudam raramente, e adicionar um produto já é um evento deliberado. Um typo em `product_id` numa grant é falha de segurança/comercial. Custo: uma migration por produto novo, que é aceitável |
| E6 | **Remover `one` dos `product_id` concedíveis.** One aparece como `source = 'bundle'` com `source_reference = <id da compra/grant do bundle>` e **materializa** grants filhas | One é bundle, não produto operacional; nunca é checado em runtime |
| E7 | `source` com CHECK fechado alinhado ao vocabulário canônico: `individual_subscription`, `bundle`, `trial`, `partner_grant`, `admin_grant`, `promotion`, `legacy_migration` (**NEEDS_PRODUCT_DECISION** sobre os dois últimos) | hoje é `subscription,trial,manual,bundle`, divergente do contrato do Growth |
| E8 | `permissions` **fica restrito a tiers de acesso** (`<produto>.read/.write/.export`). **REJECT** da expansão para permissões operacionais (`growth.manage`, `growth.sources`) | Entitlement ≠ permission. Permissão operacional pertence a membership/role. O tier `read` suporta "grace de leitura após cancelamento" |
| E9 | Partners = grant **user-scoped**; o status de `affiliate_profiles` é requisito operacional **separado**, avaliado pelo resolver | não mistura status comercial do parceiro com direito de produto |
| E10 | Market: contexto/escopo **NEEDS_PRODUCT_DECISION** | a staging força `user_id`, sem justificativa documentada |
| E11 | Business: **nenhuma grant criada** em M1C1; o caminho legado continua | concordo com o design: emissão precisa de regra aprovada |

Compatibilidade: `ecosystem_private.has_personal_access`, `process_wealth_recurrence` e `family_user_can_read` (staging) leem a tabela. E1–E3 exigem ajustar esses helpers **no mesmo migration** (checar `status = 'active' and (expires_at is null or expires_at > now())`, sem depender da unicidade). **NEEDS_SECURITY_REVIEW.**

### 4.2 M1C2 — Consent: **HOLD** (até as decisões de produto) → depois **ACCEPT_WITH_CHANGE**

| # | Mudança | Motivo |
|---|---|---|
| K1 | **Sujeito explícito**: `subject_kind in ('personal','company')`. Consent sobre dados da empresa pertence à **empresa**, com `granted_by_user_id` | hoje só `user_id`: um membro concede, sai da empresa e o consent sobrevive; admins da empresa não conseguem revogar (a policy é `revoke-own`) |
| K2 | **Revogação via RPC server-side que grava `now()`**, removendo o `grant update(revoked_at)` direto | com o UPDATE direto, o usuário escolhe o valor de `revoked_at` (só precisa ser `>= granted_at`). Qualquer consumidor futuro que teste `revoked_at > now()` aceitaria um "revoke" no futuro. Hoje nenhuma função de DB lê consents (verificado), então é risco latente. **NEEDS_SECURITY_REVIEW** |
| K3 | `policy_version` (versão do texto/finalidade apresentado) | mudar a finalidade invalida consents antigos sem precisar de backfill |
| K4 | `data_scope`/`purpose`: **shape check no DB + semântica no registry TS** (**ACCEPT** da direção do design aqui, ao contrário de E5) | esse vocabulário cresce rápido; o risco de typo é mitigado pelo fato de o consent nunca ser inferido e ser sempre checado por igualdade exata |
| K5 | Teto de 1 ano mantido como **limite externo** do DB; prazos por finalidade no registry | defesa em profundidade |
| K6 | "Uso" de consent é auditado (`record_kind = 'action'`, `consent.used`) | o design audita grant/revoke, mas não o uso |
| K7 | Open Finance: **nada agora**. Futuramente, consent regulado externo é referenciado por `external_consent_reference`, com ciclo de vida do provider | compatível, sem puxar para M1 |

Princípios confirmados: consent nunca é inferido de entitlement, assinatura, membership, role ou uso; One não dá bypass; Wealth pessoal → Business e Academy Journal → empresa só com consent explícito do titular pessoal (`subject_kind = 'personal'`).

---

## 5. M1D — Customer identity links: **DEFER**, backfill **REJECT**

### 5.1 Evidência

| `source_id` em produção | Quantidade | O que é |
|---|---|---|
| `order:<uuid>` | 18 | primeiro pedido que originou o perfil (via `refresh_customer_directory`) |
| `proposal:<uuid>` | 2 | primeira proposta |
| `crm:<uuid>` | 1 | lead de origem |

Essas referências **já existem como FK** (`orders.customer_profile_id` etc.). Um link `order:<uuid>` → perfil não acrescenta identidade: duplica a relação e fica obsoleto quando o perfil é mesclado. O `contact_key` (`phone:`/`email:`/`order:`/`proposal:`/`crm:`, único por empresa) já é a chave de resolução atual.

### 5.2 Decisão

- **DEFER** `customer_identity_links` até o **Import Engine** (Wave 1). É ele o primeiro produtor real de identidades externas não-provider, por exemplo o código do cliente no sistema anterior.
- **REJECT** o backfill a partir de `source`/`source_id`.
- Quando for criado: `(company_id, customer_profile_id, namespace, external_ref, first_seen_at, last_seen_at)`, `unique (company_id, namespace, external_ref)`, FK composta `(company_id, customer_profile_id)` → `customer_profiles(company_id, id)` (exige um `unique (company_id, id)` em `customer_profiles`) para garantir consistência de tenant no DB.

### 5.3 Boundary com `integration_mappings`

| Pergunta | `integration_mappings` | `customer_identity_links` (futuro) |
|---|---|---|
| Quem emite o identificador? | um provider, por uma **conexão** | a empresa ou um sistema sem conexão (import, cadastro legado, código manual) |
| Sobrevive à desconexão? | não (FK para a conexão com cascade) | sim |
| Escopo | `connection_id` + `company_id` | `company_id` |
| Exemplos | id de contato no Google, comprador no Mercado Livre, cliente no Bling conectado | "código 4312 no ERP antigo" importado por CSV |

**Regra:** se o identificador chega por uma conexão, vai para `integration_mappings`; caso contrário, para identity links. Nunca nos dois.

**Achado lateral:** `integration_mappings.orcaly_entity_id` é `text`, sem FK, e não garante consistência de tenant → **NEEDS_SECURITY_REVIEW**.

### 5.4 Merge e Customer Graph (compatibilidade futura)

- **Bug de cadeia de merge (existente):** `merge_customer_profiles` só marca o duplicado. Perfis previamente mesclados **nele** continuam apontando para ele, o que cria cadeias. Qualquer resolução (`merged_into_id`) precisa ser recursiva com limite, ou o merge precisa re-apontar os filhos.
- **Contact key órfão (existente):** o perfil arquivado mantém o `contact_key`. Um novo pedido com o mesmo telefone faz upsert no perfil **arquivado**, e o backfill ignora arquivados, então o pedido fica sem cliente.
- Esses dois bugs são de domínio Business (**NEEDS_COORDINATOR_DECISION** sobre o dono), mas precisam ser resolvidos **antes** do Customer Graph/360.
- Nada no design atual impede o Customer Graph. O grafo continua sendo FKs + timeline + mappings + read models.

---

## 6. M1E — Notifications → SPLIT

### 6.1 Evidência

- `app_notifications.company_id` é NOT NULL. Não há policies RLS (acesso só pelo servidor). As 27 linhas são dos tipos `order` (18), `task` (7) e `crm` (2).
- **`GET /api/notifications` filtra só por `company_id`**: notificações com `user_id` (ex.: tarefa atribuída) aparecem para **todos** os membros. **`PATCH` marca como lido por empresa**: o estado de leitura é compartilhado.
- `notifications` (legado) tem policies amplas (dono, `tester_id`, membros ativos, `admin_users` por e-mail do JWT) e grants para `authenticated`.

### 6.2 Decisões

| Parte | Decisão | Conteúdo |
|---|---|---|
| **M1E-a** | **ACCEPT_WITH_CHANGE** | Aditivo e nullable, **só company-scope**: `source_product text default 'business'`, `dedupe_key text` + `unique (company_id, dedupe_key) where dedupe_key is not null`, `source_ref` (`correlation_id` uuid), `priority smallint`, `expires_at`. Motivo real: `notification.inbox.create@1` (Automation Recipes, Wave 1) precisa de idempotência |
| **M1E-b** escopo pessoal (`company_id` nullable) | **DEFER** + **NEEDS_SECURITY_REVIEW** | Não há consumidor: o Wealth tem alert center próprio e Hub/Pulse não existem. Adicionar agora exige RLS nova sobre uma base que já vaza entre membros |
| Read state | **NEEDS_COORDINATOR_DECISION** (antes de M1E-b) | `read_at` numa linha só serve para notificação **individual**. Broadcast para empresa precisa de estado por destinatário (tabela de receipts, ou fan-out em linhas por usuário). Não resolver em M1, mas **não** codificar escopo pessoal sobre `read_at` compartilhado |
| `notifications` legado | **ACCEPT** "sem novos writes" + **NEEDS_SECURITY_REVIEW** para congelar grants/policies | policies amplas sem uso são superfície de ataque |
| Preferências, quiet hours, digest, canal | **fora de M1** | canal pertence ao log de entrega (futuro), não ao inbox |
| `smart_notification_*` | **ACCEPT** especializado | o papel de dedupe migra depois para Pulse `insights` |

**Separação:** **shared** = linha de inbox (destinatário, produto, chave, prioridade, origem, expiração, estado). **Product-specific** = título/corpo/ícone/rota, renderizados pelo produto a partir de `tipo` + `payload`.

---

## 7. M1F — Constraint validation: **REJECT** como migration própria

| Constraint | Quando entra | Técnica |
|---|---|---|
| CHECKs sobre colunas **novas** (formato de chave, `event_version >= 1`, `num_nonnulls` de escopo, tamanho de metadata, enums de `record_kind`/`source`/`status`) | **na mesma migration que cria a coluna** | válidas imediatamente: só avaliam valores não nulos, e as linhas existentes ficam nulas ou com default |
| Uniques parciais (`dedupe_key`, grants por fonte) | mesma migration | tabelas vazias ou minúsculas; em tabelas grandes, `CREATE UNIQUE INDEX CONCURRENTLY` fora de transação + `ADD CONSTRAINT … USING INDEX` |
| FK composta de tenant (identity links) | na criação da tabela | tabela nova |
| `NOT NULL` tardio (ex.: `outbox.correlation_id`) | etapa **"-V" do próprio domínio**, depois que os writers migrarem | `ADD CONSTRAINT … CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` (PG 12+ aproveita o check validado e não faz scan com lock) → `DROP` do check |
| Substituir os CHECKs hard-coded de staging (entitlement/consent) | **em M1C1/M1C2**, não depois | staging tem 0 linhas nas duas tabelas |

**Motivo:** um M1F transversal acopla rollouts independentes (writers de notificação atrasariam a validação de eventos) e posterga integridade que pode existir desde o primeiro dia. **Se validação encontrar linha incompatível: parar, sem auto-reparo** (concordo com o design).

---

## 8. Existing data — challenge dos backfills

| Objeto | Linhas | Backfill proposto | Veredito | Source of truth | Dual read/write | Lock |
|---|---|---|---|---|---|---|
| outbox/jobs/idempotency | 0/0/0 | nenhum | ✓ (mas ver C5) | — | não | nulo |
| `ecosystem_audit_events` (staging) | 13 | mapeamento mecânico | ✓ | `event_type`/`entity_id` | não | nulo |
| entitlements (staging) | 0 | nenhum | ✓ | — | não | nulo |
| consents (staging) | 0 | nenhum | ✓ | — | não | nulo |
| `customer_profiles` → links | 21 | a partir de `source_id` | **✗ REJECT** (C2) | FKs internas já existem | — | — |
| `app_notifications` | 27 | nenhum; `source_product` default `business` | ✓ o default é verdade factual (só o Business escreve hoje) | writers atuais | não | nulo |
| entitlements de Business | — | a partir de plano/assinatura | **✗ proibido** sem regra aprovada | billing (fatos) | legado + novo em paralelo até o cutover | — |

Nenhuma proposta inventa consent, entitlement, identidade, relacionamento ou intenção, **exceto** o backfill de M1D, que inventaria identidade a partir de proveniência interna. Por isso ele foi rejeitado.

---

## 9. Ordem proposta

```
M1A  event contract (colunas/índices: outbox + background_jobs)        ── staging → prod
 │
 ├─ M1B  audit extension (record_kind, dimensões)        ── staging
 │    └─ M1C1 entitlement fix (grant por fonte, revoke, product CHECK)  ── staging
 │         └─ M1C2 consent (sujeito, revoke RPC, policy_version)  [HOLD: decisões de produto]
 │
 ├─ M1E-a notification additive (company-scope)          ── staging → prod
 │
 └─ P1  Production promotion dos objetos ecosystem_* (B+C1[+C2]) na forma final
        [gate: primeiro consumidor em produção + Agent 4]

DEFER: M1D (com o Import Engine) · M1E-b (com Pulse/Hub + read state) · dispatcher/relay (missão de runtime)
REMOVIDO: M1F (dissolvido nas etapas acima e nas etapas "-V")
```

| Mudança | Reason | Dependency | Runtime impact | Security impact | Data impact |
|---|---|---|---|---|---|
| M1B deixa de depender de M1A | a dependência é de convenção TS (formato de correlation), não de DB | TS contracts | nenhum | nenhum | nenhum |
| M1B antes de M1C1 | triggers de entitlement/consent escrevem audit; o shape do audit precisa estar pronto | M1B | nenhum (staging) | fail-closed por transação | 13 linhas mapeadas |
| SPLIT M1C | consent depende de decisões de produto; entitlement tem defeito bloqueante | M1B | nenhum até o cutover | RLS/grants distintos | 0 linhas |
| M1E-a paralelo após M1A | só precisa de convenção de `correlation_id` | M1A | writers atuais seguem iguais | nenhuma superfície nova (sem escopo pessoal) | 27 linhas intactas |
| P1 separado e condicionado | produção não tem consumidor dos objetos `ecosystem_*` | B, C1, Agent 4 | nenhum até o consumidor | promoção de RLS/grants revisada uma vez | nenhum |
| M1D fora | sem produtor real; backfill semanticamente errado | Import Engine | nenhum | evita links cross-record | evita 21 links espúrios |
| M1F fora | integridade junto com cada boundary | — | — | — | — |

**Assimetria prod/staging (challenge point 10):** P1 cria em produção **direto na forma final** (sem replay da história de staging); em staging, B/C1/C2 são `ALTER`. Se a Coordenação exigir **um único arquivo** convergente para os dois ambientes, ele precisa ser escrito com DDL idempotente (`IF NOT EXISTS`, checagem de existência de constraint/policy) e testado contra um clone do schema de **cada** ambiente. **NEEDS_COORDINATOR_DECISION:** arquivo convergente único × arquivos por ambiente. Nenhum dos dois depende do baseline `20260926030809`.

---

## 10. Action Registry — **ACCEPT_WITH_CHANGE**

| Vive em | O quê |
|---|---|
| **TypeScript only** | definição da ação (key, versão major, schema de input/output, impact/sensitivity/reversibility, permissão, feature, consent exigido, atores permitidos, política de confirmação, owner/produto), labels/UX, aliases de depreciação |
| **Database only** | estado de execução: receipts/idempotência (futuro), status/attempts de jobs, rows de audit |
| **Both** | a **chave estável versionada** `domain.entity.verb@major` gravada em jobs (`payload.contract`), eventos (`event_type` + `event_version`) e audit (`action_key`), com **shape CHECK** no DB (`^[a-z]+(\.[a-z_]+){2}(@[0-9]+)?$`) |

Regras adicionais:
1. **Renomear é proibido**: só depreciar, com `replacedBy` no TS.
2. **Replay e job pinam a versão**: o payload carrega `contract@major`, e um worker que não conhece a versão vai para `needs_attention` (fail-closed).
3. **Não criar tabela de strings de ações** (concordo).
4. Registry canônico: **reusar** os contratos puros já escritos em `lib/actions`, `lib/events` e `lib/detectors` (branch `claude/orcaly-wave1-pure-core`, Wave 1 T1), em vez de abrir um terceiro local. **NEEDS_COORDINATOR_DECISION**.

---

## 11. Product Registry compatibility — **ISSUE**

- O design coloca a identidade de produto no TS, o que é correto e mantém o DB sem conhecimento de UX, billing ou landing. **Mas:** existem **dois** registries TS concorrentes, e nenhum está em `main`: `lib/ecosystem/products.ts` (`codex/orcaly-ecosystem`) e `lib/orcaly-next/product-registry.ts` (branches growth/academy, mantido por teste de paridade).
- As listas de produto e fonte divergem entre o DB de staging (`one` concedível; `subscription/trial/manual/bundle`) e o contrato do Growth (`individual_subscription`, `one_bundle`, …).
- **Não há dependência circular** se a regra for: registry TS → define ids; DB → CHECK fechado de `product_id` (E5) espelhado por **teste de paridade** em CI; resolver de entitlement → lê o DB e interpreta com o registry. O DB nunca lê o registry.
- **NEEDS_COORDINATOR_DECISION:** qual registry é o canônico **antes** de M1C1.

---

## 12. Wave compatibility — **ISSUE** (resolvível com as mudanças acima)

| Wave | Risco no design original | Com as mudanças |
|---|---|---|
| 1 (Packs, Setup, Import, Recipes) | M1D com backfill errado; inbox sem idempotência | M1D nasce com o Import; M1E-a dá `dedupe_key` |
| 2 (Customer Graph/360, Event Fabric, CRM, Growth) | cadeia de merge / contact key órfão | sinalizados; relay → jobs habilita fan-out |
| 3 (Pulse, Academy contextual, Ops Health) | read state compartilhado; escopo pessoal sobre base que vaza | M1E-b adiado até existir o modelo de receipts |
| 4 (Ask Intelligence, cross-analysis) | consent sem sujeito company e sem versão de política | K1/K3 |
| 5 (Action Registry, risk, confirmations) | — | chave versionada em jobs/eventos/audit |
| 6 (Inbox omnichannel, Portal, Recurrence) | integration_mappings × identity links | boundary §5.3 |
| 7 (forecasting…) | — | nada bloqueado |
| One / billing | **uma linha por produto impede a união de fontes** | E1/E6 |

---

## 13. Integration Foundation

**ACCEPT** (reuso integral). Nenhuma segunda foundation.

Pontos para o Agent 4, sem resolver em M1:
- `integration_mappings.orcaly_entity_id` é texto sem FK de tenant.
- Campos legados de segredo do WhatsApp em `companies`.
- Grants de Data API sobre as tabelas `integration_*`.

---

## 14. Agent 4 — pacote de Security Review

| # | Item | Boundary |
|---|---|---|
| S1 | Novas colunas de escopo (`user_id`) em outbox/jobs: garantir que continuam server-only; nenhuma policy para `authenticated` | M1A |
| S2 | Relay/dispatcher futuro: localização em schema privado, `SECURITY DEFINER` com `search_path` fixo, `REVOKE` de `PUBLIC/anon/authenticated` | runtime pós-M1A |
| S3 | `ecosystem_audit_events`: append-only real, allow-list de metadata, ausência de PII, sem FK cascade | M1B |
| S4 | Triggers `SECURITY DEFINER` de audit (`ecosystem_private.record_change` e ~20 variantes Wealth) | M1B |
| S5 | Entitlement: RLS de leitura (dono/membro ativo/próprio usuário), helpers após E1–E3, ausência de writes de `authenticated` | M1C1 |
| S6 | Consent: remover o `UPDATE(revoked_at)` direto em favor da RPC; revogação por admin da empresa (K1); validação do concedente no uso | M1C2 |
| S7 | Escopo pessoal de notificações + **vazamento atual** (notificação com `user_id` visível a toda a empresa; read state compartilhado) | M1E-b + runtime atual |
| S8 | Congelar grants/policies do `notifications` legado | M1E |
| S9 | `integration_mappings.orcaly_entity_id` sem integridade de tenant | M1D futuro |
| S10 | Segredos legados do WhatsApp (fora de M1; apenas rastrear) | — |
| S11 | Data API: grants de toda tabela pública nova/alterada em P1 | P1 |
| S12 | Fronteiras cross-product: One sem bypass; Wealth → Business e Academy → empresa só com consent pessoal | M1C2 |

---

## 15. Fora de escopo, confirmado

Os gaps de M0.2 (proveniência do baseline `20260926030809`, seed de flags, bootstrap de afiliados, buckets, cron de estoque, proveniência parcial de staging) **não** entram em M1. Open Finance não entra em M1. Nenhum dispatcher, resolver, Consent Fabric, Customer Graph, Notification runtime ou Action Registry runtime foi implementado ou autorizado aqui.

---

## 16. Resultado final

```
M1_ARCHITECTURE_CHALLENGE:
COMPLETE

TARGET_SHA:
2ad113837a25a6ed3e04f00453bec3ac45a9e960

M1A_EVENT_FABRIC:
CHANGE

M1B_AUDIT:
CHANGE

M1C_ENTITLEMENT_CONSENT:
CHANGE

M1D_CUSTOMER_IDENTITY:
CHANGE

M1E_NOTIFICATIONS:
CHANGE

M1F_CONSTRAINT_VALIDATION:
CHANGE

MIGRATION_ORDER:
CHANGE

ACTION_REGISTRY_DIRECTION:
CHANGE

PRODUCT_REGISTRY_COMPATIBILITY:
ISSUE

WAVE_COMPATIBILITY:
ISSUE

AGENT4_SECURITY_REVIEW:
REQUIRED

PRODUCT_DECISIONS_REQUIRED:
- One: bundle que materializa grants filhas (source='bundle'), nunca product_id concedível
- Partners: grant user-scoped + status de affiliate_profiles como requisito operacional separado
- Market: escopo/contexto do produto
- Vocabulário final de source de entitlement (promotion? legacy_migration?)
- Regra de emissão/revogação de entitlement Business a partir de billing (antes de qualquer cutover)
- Tier de leitura pós-cancelamento (grace) como entitlement read-only
- Consent: sujeito company vs personal para dados de empresa; escopos/finalidades aprovados além dos 2 atuais
- Retenção de audit (row_change x action) e de notificações

COORDINATOR_DECISIONS_REQUIRED:
- Dispatch path: relay outbox → background_jobs (recomendado) x consumo direto do outbox
- Retenção do outbox antes da existência do dispatcher (C5)
- Gate de P1: promover objetos ecosystem_* para produção só com o primeiro consumidor
- Arquivo de migration convergente único x por ambiente (assimetria prod/staging)
- Registry TS canônico (lib/ecosystem/products.ts x lib/orcaly-next/product-registry.ts) e local dos contratos de ação/evento
- Adiar M1D para o Import Engine e rejeitar o backfill por source_id
- Dissolver M1F nas etapas por boundary
- Dono dos bugs de merge (cadeia merged_into_id; contact_key órfão em perfil arquivado)
- Modelo de read state (receipts por destinatário) antes do escopo pessoal de notificações
- Regra de roteamento de audit (§3.3)

MIGRATION_FILES_CREATED:
NONE

SQL_CREATED:
NONE

DATABASE_MUTATION:
NONE

STAGING_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

READY_FOR_COORDINATOR_RECONCILIATION:
YES
```

---

### Evidência (leituras executadas, somente `SELECT`)

- **Produção** `ozrasuktfthsvbqprtel`: contagens de `transactional_outbox`/`timeline_events`; `max(orders.created_at)`; distribuição de prefixos de `customer_profiles.source_id` e `contact_key`; nulabilidade de `app_notifications`; `pg_policies` de `app_notifications`/`notifications`; constraints e índices de `background_jobs`/`transactional_outbox`; distribuição de `app_notifications.tipo`.
- **Staging** `zwxulgpjucxudadjdqov`: distribuição de `ecosystem_audit_events.event_type`; triggers de audit; índices e policies de entitlement/consent; funções que referenciam entitlements/consents.
- **Código** (`origin/main` @ `2da6a56`): `app/api/notifications/route.ts`.
