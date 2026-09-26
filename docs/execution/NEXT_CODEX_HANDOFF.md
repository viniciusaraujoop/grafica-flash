# Continuação exata — Orçaly

## Unidade vigente: Debt Center

Seção 6.5 implementada; banco aplicado somente em staging, oito migrations. Saldo reaproveita wealth_entries, termos 1:1, RLS/Actions/versionamento/auditoria, declaração de quitação e simulação snowball/avalanche/custom. 95 testes e 16 E2E focados locais com Supabase real PASS, cleanup zero. Preview novo em certificação. Detalhes: docs/qa/ORCALY_WEALTH_DEBT.md.

Migrations 20260926165000 e 20260926171000 já aplicadas; não reaplicar ou editar. A segunda resolve repetição HTTP causada por SQLSTATE 40001: conflito de versão usa PT409. Schema final: 271 adições vs produção capturada, nenhum objeto antigo de produção alterado; vs clock há 27 adições e check intencional de saldo zero em passivos. Cron interno continua pausado. Próximo depois da certificação: 6.6 Net Worth.

## Checkpoint anterior: recorrências/clock

Recorrências e relógio certificados em staging. Preview https://orcaly-cfgjqomls-vinicius-araujos-projects.vercel.app, deployment dpl_4ztQEJZVT14wEbYzYqCq5pg1DWey, SHA de7346756d9dd053544a5767827f5f506008c2f7: 24 checks hospedados PASS. O relógio foi acrescentado depois como função privada, sem alteração da UI/API pública, e passou em dois disparos pg_cron reais. 85 testes PASS. Cleanup integral zero. Seis migrations, delta cumulativo de 244 adições; um cron registrado e PAUSADO durante QA. Evidências: docs/qa/ORCALY_WEALTH_RECURRENCE_VERCEL_E2E.json e ORCALY_WEALTH_CLOCK.md.

Produção ozrasuktfthsvbqprtel somente leitura; staging zwxulgpjucxudadjdqov é o link do CLI. Branch codex/orcaly-ecosystem. GitHub/Preview autorizados; nenhuma promoção/main. Não repetir bootstrap ou db push histórico, não editar SQL aplicado, não fazer migration repair. WhatsApp congelado.

## Próxima unidade
Seção 6.5 do arquivo C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_CONTINUATION_FINAL.md: Debt Center (saldo, principal, juros, parcelas, vencimento, mínimo, quitação, snowball/avalanche/custom e simulação não garantida). Não refazer 6.1–6.4. Conferir git status/log e ler lib/wealth/core.ts, components/wealth e guias locais Next antes de código. Implementar/testar em staging; avançar automaticamente ao restante enquanto houver contexto útil.

## Banco
Já aplicadas, nesta ordem explícita: baseline 20260926030809, Wealth 20260926014103, lifecycle 20260926103114, recurring 20260926110128, boundary 20260926153138, clock 20260926164000. Não reaplicar/resetar/editar. Hashes em reconciliation/CONTINUATION_MIGRATIONS.md. Clock pausado, preservar durante E2E; enable/pause/inspect via scripts/configure-wealth-staging-cron.mjs gera SQL guardado para CLI staging. Procedimento completo em ../qa/ORCALY_WEALTH_CLOCK.md.

## QA/Preview
Vercel prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O / team_c5p2Uiz9b1SqKxOhmnmxUWZH. CLI autenticado, env Preview desta branch aponta staging. Proteção ativa. Credenciais/share link ficam ignorados em .local-qa/reconciliation; nunca imprimir.

Último E2E completo: URL/SHA acima, ORCALY_STAGING_ACCESS_FILE=.local-qa/reconciliation/vercel-recurrence-access.json; flags ORCALY_QA_RECORDS/EDIT/LIFECYCLE/RECURRENCE=true. 24 PASS e todas as contagens zero. Não repetir sem mudança/risco. Types remotos atualizados, 85 testes locais PASS; build de UI/worker de73467 PASS. Mudança posterior do relógio é SQL privado + QA, sem alteração Next.

Não rodar dev/typegen/build ao mesmo tempo: gerou manifesto incompleto no Windows, corrigido. Nenhum QA server iniciado nesta retomada. Se fixtures interrompidas, node scripts/cleanup-staging-fixtures.mjs usa somente IDs/emails registrados; pause cron antes. Não matar todos os Node/Chrome.

Master completo PARCIAL; registrar limites e estado real. Histórico em NEXT_CODEX_HANDOFF_HISTORY_THROUGH_LIFECYCLE.md tem instruções antigas superadas.
