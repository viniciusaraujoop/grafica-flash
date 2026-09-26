# Wealth — recorrências (seção 6.4)

## Estado
Implementadas e aplicadas somente em staging zwxulgpjucxudadjdqov. Preview em certificação; não declarar o master completo. Produção permanece fora do escopo de escrita.

## Comportamento
Agendamentos pessoais de receitas/despesas (salário, aluguel, assinaturas, parcelas e aportes planejados), frequência diária/semanal/mensal/anual, intervalo, início/fim, quantidade opcional e timezone. Execução ao meio-dia local; âncora mensal preserva Jan31 → Fev28 → Mar31 e anos bissextos. Valores inteiros em centavos. Aportes são despesas declaradas da categoria investimento; não há transação bancária, cobrança ou ordem de investimento.

Criação idempotente, pause/resume/cancel com versão e confirmação. Resume inclui vencidos; para mudar condições financeiras, cancelar e criar outro agendamento. Término por data/quantidade. Histórico mantém ledger por ocorrência mesmo se o lançamento for removido.

O processador reutiliza background_jobs, event_idempotency e transactional_outbox. Lock, lease/worker, chave única por ocorrência, escrita financeira/ledger/outbox/avanço atômicos, retry/backoff e recuperação de lease vencida. Revalida entitlement do proprietário; revogação pausa a agenda. Payloads de eventos contêm identificadores, não dados financeiros.

## Segurança
RLS e leitura por proprietário nas duas tabelas; authenticated sem DML direto. Actions usam sessão e permissões read/write, sem service key. Implementações privilegiadas em ecosystem_private têm auth/ownership internos e search_path vazio; wrappers públicos são SECURITY INVOKER. Processador público: somente service_role. A migration de boundary eliminou três WARN novos dos advisors sem enfraquecer isolamento.

## Evidências
- 82 testes de domínio/PostgreSQL PASS; build/typecheck/lint de escopo PASS.
- 16 checks focados no app local + Supabase hospedado PASS: ORCALY_WEALTH_RECURRENCE_LOCAL_E2E.json.
- Inclui Server Actions, owner forjado, duas abas, revogação, concorrência, handler real de jobs, fencing, rollback por falha de outbox, retry, stale recovery, timezone/leap, Axe A/AA e larguras 320/390/768/1440.
- Cleanup SQL e helper: zero usuários, auditoria, schedules, occurrences, jobs, ledger de idempotência e outbox do Wealth.
- Tipos regenerados do staging real.
- Delta vs lifecycle: 72 adições; vs catálogo de produção auditado: 243 adições, nenhuma alteração/remoção de objeto preexistente. Ver staging-recurrence-final-delta.json e staging-recurrence-vs-production.json.
- Hashes e equivalência do ledger: CONTINUATION_MIGRATIONS.md.

## Limites e riscos
A UI permite atualizar vencidos e o handler está registrado no worker existente. Nenhum novo relógio/cron foi ativado; o acionamento automático em Preview ainda não está certificado. Não executar indiscriminadamente a fila legada (billing/email/integrações). Esta lacuna operacional deve ser concluída antes de declarar recorrências inteiramente automáticas.

Advisors remanescentes: definer legado get_my_platform_admin_access (1 WARN), proteção contra senha vazada desabilitada (1 WARN de configuração Auth), 63 auth_rls_initplan e 54 multiple_permissive_policies legados. Há INFOs de tabelas sem policy (deny-by-default/servidor), índices sem uso e FK legada. Zero WARN estrutural novo atribuído às recorrências. Não declarar todos os advisors zerados.
Proteção de senha vazada exige verificar plano/configuração; não foi presumido plano nem contratada cobrança. Documentação: https://supabase.com/docs/guides/auth/password-security.

## Comandos desta unidade
- node --test scripts/test-wealth-recurrence-database.mjs
- npm run test:ecosystem; npm run typecheck; npm run build (em execuções separadas do dev server)
- node scripts/prepare-wealth-staging.mjs (seleção explícita das migrations allowlisted; confira argumentos no script)
- npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql -o json
- generate_typescript_types/get_advisors e SQL read-only do catálogo
- node scripts/compare-schema-snapshots.mjs (snapshots de lifecycle/final/produção)
- ORCALY_QA_RECURRENCE=true node scripts/e2e-ecosystem-staging.mjs
- node scripts/cleanup-staging-fixtures.mjs

Nenhum db push histórico, migration repair, reset de produção, promoção, cobrança ou webhook externo.
