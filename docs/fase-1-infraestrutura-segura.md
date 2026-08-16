# Orçaly — Fase 1: infraestrutura segura

Este documento descreve somente a fundação técnica da Fase 1. Nenhum Portal do Cliente completo, automação comercial, integração externa, IA ou redesign foi implementado.

## 1. Resumo

A Fase 1 adiciona:

- feature flags globais e por empresa, todas inicialmente desligadas;
- contratos TypeScript centrais para flags, eventos, atores, entidades, visibilidade e permissões;
- eventos operacionais append-only, separados de auditoria técnica;
- timeline polimórfica consultada no servidor;
- idempotência protegida por constraint no Postgres;
- fila persistente para automações futuras, sem worker e sem disparos;
- validação de metadata contra secrets e PII comum;
- uma prova controlada em `order.status_changed`, protegida pela flag `operational_events`;
- testes de resolução de flags, permissões, isolamento, visibilidade, duplicidade e concorrência.

A migration é versionada, mas não foi aplicada ao banco remoto nesta execução.

## 2. Arquitetura

O estado atual continua sendo gravado nas tabelas de domínio existentes. Quando `operational_events` estiver habilitada para uma empresa piloto, a mudança de status do pedido também chama o dispatcher server-only:

```text
PATCH de pedido
  -> valida usuário e empresa com getRequester/getCompanyAccess
  -> atualiza orders
  -> mantém order_status_history, app_notifications e system_audit_logs
  -> avalia operational_events no servidor
  -> emite order.status_changed com idempotência
  -> continua o fluxo mesmo se esse evento secundário falhar
```

O dispatcher grava um fato de negócio em `operational_events`. A timeline filtra sempre por `company_id`, `entity_type`, `entity_id` e visibilidade. A fila `automation_jobs` só poderá receber ações futuras chamadas explicitamente pelo servidor; a emissão de um evento não agenda nada automaticamente nesta fase.

Falhas têm dois modos:

- `critical`: propaga a falha e deve ser usado quando estado e evento precisarem de atomicidade/transação;
- `best_effort`: registra contexto seguro no log e preserva o fluxo atual. É o modo da prova de conceito.

## 3. Arquivos alterados

- `supabase/migrations/20260816155115_operational_foundation_v1.sql`
- `lib/foundation/contracts.ts`
- `lib/foundation/feature-flags.ts`
- `lib/foundation/feature-flags.server.ts`
- `lib/foundation/permissions.ts`
- `lib/foundation/operational-events.ts`
- `lib/foundation/operational-events.server.ts`
- `app/api/orders/[id]/route.ts`
- `tests/foundation/foundation.test.ts`
- `tests/foundation/migration-contract.test.ts`
- `tests/foundation/tsconfig.json`
- `docs/fase-1-infraestrutura-segura.md`
- `package.json`

Não foram modificados arquivos de Auth, cadastro, assinatura, Mercado Pago, Asaas ou Programa Fundadores.

## 4. Banco alterado

A migration local cria, quando aplicada pelo processo normal do projeto:

- `feature_flags`: definição global e chave de bloqueio de overrides por empresa;
- `company_feature_flags`: override booleano por `company_id + feature_key`;
- `operational_events`: fatos de negócio polimórficos, versionados e append-only;
- `automation_jobs`: fila futura com agendamento, estado, tentativas, erro e processamento.

Índices e constraints principais:

- unique `operational_events(company_id, idempotency_key)`;
- timeline `company_id, entity_type, entity_id, occurred_at desc, id desc`;
- consulta por evento `company_id, event_type, occurred_at desc`;
- timeline pública parcial para `visibility = 'customer_visible'`;
- unique `automation_jobs(company_id, idempotency_key)`;
- fila vencida por `status, scheduled_at, id`;
- FK composta garantindo que job e evento pertençam à mesma empresa.

Funções e triggers:

- `orcaly_private.touch_updated_at()`;
- `orcaly_private.prevent_operational_event_mutation()`;
- triggers de `updated_at` nas flags/filas;
- trigger append-only que bloqueia update/delete de eventos e exige evento corretivo.

Não há backfill, alteração de registros existentes ou DDL aplicado diretamente em produção.

## 5. Feature flags

Chaves registradas e inicialmente desligadas:

- `customer_portal`
- `graphic_workflow_v2`
- `operational_events`
- `stage_automations`
- `adaptive_panel`
- `smart_onboarding`
- `operational_intelligence`

Resolução:

```text
company_overrides_enabled = false -> usa somente globally_enabled
company_overrides_enabled = true e existe override -> usa override da empresa
sem override -> usa globally_enabled
flag ausente ou erro de leitura -> false (fail-closed)
```

Uso server-side:

```ts
const enabled = await isFeatureEnabled('customer_portal', {
  companyId,
  supabase,
})

await assertFeatureEnabled('customer_portal', {
  companyId,
  supabase,
})
```

`setCompanyFeatureFlag()` exige permissão de gestão, grava somente override da empresa e reutiliza `system_audit_logs` com `feature_enabled`/`feature_disabled`. Não existe endpoint público genérico de flags.

## 6. Eventos

Catálogo TypeScript inicial:

- `order.created`
- `order.status_changed`
- `quote.created`
- `quote.sent`
- `quote.approved`
- `quote.rejected`
- `artwork.created`
- `artwork.revision_requested`
- `artwork.approved`
- `payment.pending`
- `payment.paid`
- `production.started`
- `production.completed`
- `delivery.started`
- `delivery.completed`
- `customer.message_created`

Somente `order.status_changed` foi conectado a um fluxo real. Os demais são contratos preparados, não automações implementadas.

Convenções:

- evento: `domain.action` em minúsculas;
- ator: `user`, `customer`, `system` ou `integration`;
- visibilidade: `internal`, `customer_visible` ou `system`;
- `schema_version` começa em `1`;
- `occurred_at` representa quando ocorreu; `created_at`, quando foi persistido;
- metadata é um objeto JSON de até 16 KiB e não aceita chaves comuns de senha, token, cartão, documento, e-mail ou telefone.

## 7. Timeline

Consulta server-side:

```ts
const timeline = await getOperationalTimeline(supabase, {
  companyId,
  entityType: 'order',
  entityId: orderId,
  visibility: 'internal',
  ascending: false,
  limit: 100,
})
```

Consulta SQL equivalente:

```sql
select *
from public.operational_events
where company_id = :company_id
  and entity_type = :entity_type
  and entity_id = :entity_id
  and visibility = :visibility
order by occurred_at desc, id desc
limit 100;
```

A timeline atual de pedidos (`order_status_history`) foi preservada para não alterar a UI. A nova timeline é uma fundação compartilhada, não um segundo componente visual.

## 8. Segurança

- `company_id` é obrigatório em flags por empresa, eventos e jobs.
- O navegador não escolhe o tenant usado pelo dispatcher; a rota usa a empresa resolvida por `getCompanyAccess`.
- `feature_flags`, `company_feature_flags` e `automation_jobs` não têm grants para `anon`/`authenticated`.
- `operational_events` dá somente `SELECT` a `authenticated`, com policy por owner/tester/membro ativo.
- Nenhum papel cliente recebe `INSERT`, `UPDATE` ou `DELETE` em eventos.
- Jobs são acessíveis somente por `service_role` server-side.
- O service role não aparece em nenhum módulo client-side.
- Eventos são append-only; correções exigem um novo evento.
- A policy e o helper sempre incluem `company_id`, mitigando BOLA/IDOR.
- Metadata não deve duplicar dados de cliente existentes na entidade.

O teste real de RLS da nova tabela precisa ser executado em um banco local/preview depois da migration. Docker/Supabase local não está disponível nesta máquina e a migration não foi aplicada ao remoto.

## 9. Testes

Executados:

- `npm test`: 13/13 passando;
- flag global desligada/ligada e override piloto;
- bloqueio global de overrides;
- normalização de event type e visibilidade;
- validação de metadata;
- compatibilidade de permissões atuais;
- idempotência simples;
- duas emissões concorrentes com uma única criação;
- mesma chave permitida para empresas diferentes;
- timeline isolada por empresa e visibilidade;
- modo `best_effort` e modo crítico;
- contrato estático da migration para tabelas, índices, unique, RLS, grants, append-only e flags desligadas;
- `npx tsc --noEmit`: passando;
- lint dos arquivos tocados: passando;
- `npm run security:check`: passando;
- `npm run verify:payments`: passando;
- `git diff --check`: passando, apenas avisos de normalização LF/CRLF.

Não executado: integração Postgres/RLS real das novas tabelas, pela ausência de Docker/Supabase local e pela regra de não aplicar migration no remoto durante esta fase.

## 10. Build

`npm run build` passou com Next.js 16.2.9/Turbopack:

- compilação concluída;
- TypeScript do build concluído;
- 212 páginas geradas;
- rotas novas não foram expostas.

O lint completo preexistente falha com 394 erros e 143 avisos, principalmente porque diretórios de backup não estão ignorados e por arquivos legados fora do escopo. Nenhum erro pertence aos arquivos desta Fase 1.

## 11. Regressão

Smoke tests no build local:

- home: desktop e mobile renderizados, conteúdo presente, sem overlay e sem erro de navegador;
- login: formulário, recuperação e link de cadastro renderizados;
- cadastro: fluxo de cinco etapas e campos iniciais renderizados, sem submissão;
- painel: sem sessão redireciona para `/login?next=/painel`;
- produtos: sem sessão redireciona para login;
- pedidos: sem sessão redireciona para login;
- clientes: sem sessão redireciona para login;
- admin: sem sessão redireciona ao portal interno;
- site público `grafica-flash`: carregou empresa, catálogo, cupom e produtos reais, sem overlay/erro;
- fronteiras de pagamentos: script existente passou e nenhum arquivo financeiro foi alterado.

Não foi realizado login real por falta de credenciais de teste fornecidas. Nenhuma escrita de dados foi feita durante a regressão.

## 12. Riscos remanescentes

- A migration ainda precisa passar por banco local/preview, advisors do Supabase e teste real de RLS antes de produção.
- A prova de conceito é `best_effort`; estado e evento não estão na mesma transação. Fluxos críticos futuros devem usar RPC/transação.
- A policy depende do modelo atual de `companies`/`company_members`; mudanças futuras de membership exigem revisar a policy.
- `automation_jobs` não tem worker, lease/retry engine ou cron nesta fase.
- A UI de pedido continua consumindo `order_status_history`; a migração visual para timeline unificada é futura.
- O lint global continua com dívida preexistente e deve ser tratado separadamente.
- A configuração remota expõe o schema `public` apenas quando `Accept-Profile: public` é usado; o processo de aplicação deve confirmar Data API/grants após a migration.

## 13. Rollback

Rollback funcional imediato, sem DDL:

```sql
update public.feature_flags
set globally_enabled = false,
    company_overrides_enabled = false;
```

Isso faz todos os helpers falharem fechado e mantém o fluxo atual. Para reabrir pilotos depois, reative `company_overrides_enabled` somente na flag necessária.

Rollback de código: remover a chamada protegida em `app/api/orders/[id]/route.ts`. A timeline legada e os demais fluxos continuam intactos.

Rollback estrutural, somente depois de exportar qualquer evento e confirmar que nenhuma Fase 2 depende das tabelas:

```sql
begin;
drop table if exists public.automation_jobs;
drop table if exists public.operational_events;
drop table if exists public.company_feature_flags;
drop table if exists public.feature_flags;
drop function if exists orcaly_private.prevent_operational_event_mutation();
drop function if exists orcaly_private.touch_updated_at();
commit;
```

Esse rollback estrutural é destrutivo e não foi executado.

## 14. Preparação para Fase 2

O futuro Portal do Cliente já poderá:

- ser liberado somente para pilotos com `customer_portal`;
- consultar eventos `customer_visible` pelo helper server-side;
- manter eventos internos invisíveis ao cliente;
- ordenar a timeline por `occurred_at`/`created_at`;
- usar eventos idempotentes e versionados;
- ligar aprovações e mensagens a entidades sem criar uma timeline por módulo;
- gerar jobs futuros sem enviar WhatsApp nesta fase;
- evoluir métricas e inteligência sobre eventos estruturados;
- reutilizar os módulos por segmento já existentes em `business-types.ts`, `panel-modules.ts` e `segment-modules.ts`.

Antes da Fase 2: aplicar a migration em preview, executar advisors, testar RLS com dois usuários/duas empresas, habilitar `operational_events` apenas para uma empresa piloto e validar a prova de conceito end-to-end.
