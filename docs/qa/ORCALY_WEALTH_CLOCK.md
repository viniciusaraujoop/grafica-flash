# Wealth — relógio automático certificado em staging

Migration 20260926164000_wealth_recurrence_clock.sql, SHA LF 00e77914174a348135e420619bee4177b0fb33eedeee619b544bbef88a5f2e65, aplicado e hash confirmado no ledger. Acrescenta somente ecosystem_private.run_wealth_recurrence_batch(integer), search_path vazio, EXECUTE apenas serviço. Nenhum SQL histórico alterado. Tipos remotos regenerados e idênticos: nenhuma assinatura pública nova.

Lotes de 1–50 jobs pessoais wealth.recurrence; exclusão mútua por advisory lock e SKIP LOCKED; recuperação limitada de leases vencidas; retry/backoff, máximo de tentativas e quarentena; mesma primitiva financeira transacional, entitlement e idempotência já certificados. Jobs legados e de empresa não são processados. Registro do cron é operação explícita separada da migration.

85 testes de domínio/PostgreSQL PASS. Testes novos provam ACL, limite de lote, exclusão de filas alheias/empresa, duplicidade, lease stale, tentativas esgotadas, payload inválido, rollback integral por falha temporária e revogação.

O pg_cron real do staging executou às 15:52 e 15:53 UTC em 26/09/2026, ambos succeeded. Criou exatamente dois lançamentos de R$ 0,29 e dois eventos, pausou o agendamento revogado sem gerar lançamento e deixou o job sintético alheio intocado. O observador não chamou processador/refresh/worker. Evidência: ORCALY_WEALTH_CLOCK_STAGING_E2E.json e ../execution/reconciliation/staging-clock-cleanup.json.

Estado após QA: zero usuários/auditoria/schedules/occurrences/jobs/eventos/outbox; seis migrations. Um cron registrado, **pausado** para os próximos E2Es determinísticos. Não afirmar cron inexistente ou automação ativa no estado final. Produção não recebeu cron nem alterações.

Delta schema vs recorrências: uma função privada nova; cumulativo vs produção auditada: 244 adições intencionais, zero alteração/remoção de objeto antigo. Advisors: zero aviso estrutural novo; WARNs legados permanecem. A última chamada não retornou Auth/password protection, mas isso não comprova que a configuração foi corrigida; a pendência anterior segue aberta.

Operação reprodutível, somente CLI vinculado ao staging:
```powershell
node scripts/configure-wealth-staging-cron.mjs enable # ou pause / inspect
npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/wealth-staging-cron.sql -o json
```
O comando do cron contém apenas SQL interno, timeout de 20s/lock de 2s e lote 25, a cada minuto. Nenhum token, URL, webhook, chamada externa, cobrança ou ordem financeira. Pausar antes de E2Es manuais para evitar corrida com fixtures vencidas; reativação exige decisão operacional explícita do responsável pela execução.

Para repetir a prova específica: staging vazio, preparar fixtures com `node scripts/e2e-wealth-clock-staging.mjs prepare`, habilitar cron, executar `... verify`, pausar cron, executar `... cleanup-sentinel` e `node scripts/cleanup-staging-fixtures.mjs`. Não repetir sem mudança/falha que justifique.

Fontes verificadas: [Supabase Cron](https://supabase.com/docs/guides/cron) (SQL interno e histórico de execuções); [Vercel Cron](https://vercel.com/docs/cron-jobs) (disparo para deployment de produção, razão para não ativar Vercel Cron neste Preview).
