# Continuação exata — Orçaly

Produção `ozrasuktfthsvbqprtel` somente leitura. Staging `zwxulgpjucxudadjdqov`, CLI vinculado, cinco migrations já aplicadas. Não repetir bootstrap, db push histórico ou migration repair; não alterar SQL aplicado. Branch `codex/orcaly-ecosystem`, GitHub/Preview autorizados, nenhuma promoção/main. WhatsApp congelado.

## Checkpoint
Não recomeçar. HEAD anterior documental 11fde65610fa43a16a516f6b935b7d691e1bb738. Unidade recorrências implementada, aplicada ao staging e testada localmente; conferir git status/log para commit novo. Último Preview certificado anterior: lifecycle SHA 510b38a, 21 PASS. Detalhes atuais em ORCALY_EXECUTION_STATE.md e ../qa/ORCALY_WEALTH_RECURRENCE.md.

Staging ledger: baseline 20260926030809 aplicada primeiro, Wealth 20260926014103 depois, lifecycle 20260926103114, recurring 20260926110128, boundary 20260926153138. Todas já aplicadas. Hashes em reconciliation/CONTINUATION_MIGRATIONS.md. Tipos atualizados. Zero fixtures/cron jobs. Não editar SQLs aplicados.

## Próxima ação
1. Commit/push da unidade recorrências para branch autorizada; aguardar Preview READY com SHA exato.
2. Obter share link temporário por ferramenta Vercel e guardar somente em .local-qa/reconciliation/vercel-recurrence-access.json.
3. Rodar node scripts/e2e-ecosystem-staging.mjs com ORCALY_STAGING_APP_URL do Preview, ORCALY_STAGING_ACCESS_FILE acima, ORCALY_EXPECTED_COMMIT exato e ORCALY_QA_RECORDS/EDIT/LIFECYCLE/RECURRENCE=true. Esperados 24 checks; conferir todos e cleanup.
4. Copiar report sanitizado para docs/qa/ORCALY_WEALTH_RECURRENCE_VERCEL_E2E.json, inspecionar screenshot recurrence-hosted.png (incluindo alinhamento checkbox), atualizar certificação e commitar documentação.
5. Completar disparo automático de recorrências: UI e handler real estão testados, relógio automático não. Não acionar fila legada com billing/email. Nenhum cron foi ativado. Em seguida Debt Center, Net Worth etc. Não encerrar só após plano/módulo se houver contexto útil.

## Ferramentas e limites
Vercel project prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O / team_c5p2Uiz9b1SqKxOhmnmxUWZH. Preview da branch aponta a staging; produção preservada. CLI autenticado: não pedir login sem falha concreta. Nunca imprimir chaves/share links; .local-qa é ignorado.

82 testes, build/typecheck/scoped lint PASS. No servidor QA ativo necessário; verificar porta antes de iniciar. Não rodar dev/typegen/build simultaneamente (gerou manifesto incompleto no Windows). Se E2E interromper: node scripts/cleanup-staging-fixtures.mjs limpa somente IDs/emails sintéticos conhecidos, incluindo artefatos da fila Wealth. Não matar todos os Node/Chrome.

Ler AGENTS.md/guias Next locais antes de código. Respeitar migrations futuras aditivas e guardas de staging em scripts/prepare-wealth-staging.mjs. Modelo de filas em scripts/fixtures/wealth-queue-baseline.sql é fixture de teste schema-only, não migration. Private boundary preserva auth/ownership internos; não relaxar ACLs/RLS para zerar advisors.

Histórico anterior em NEXT_CODEX_HANDOFF_HISTORY_THROUGH_LIFECYCLE.md é somente registro, contém instruções antigas já superadas. Master completo ainda PARCIAL.
