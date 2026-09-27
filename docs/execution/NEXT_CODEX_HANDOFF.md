# Handoff V8 — Tax Center certificado → Morning / Night

STATUS: CONTINUATION_ACTIVE. Tax Center **CERTIFICADO** em staging + Preview protegido. Próxima unidade real: **Morning / Night**. Não refazer Tax, Shield, Fee ou módulos Wealth já certificados.

Branch: `codex/orcaly-ecosystem`. Runtime Tax certificado: `d47ac1869dcfc22b93e122508153caf665d09cdf`. Commits posteriores ao runtime são documentação/evidência de certificação; confirme o HEAD da branch ao iniciar outra sessão. Main preservada: `d940debf9556e1180fa3c709da0f560d3aa96374`.

## Runtime / Preview certificado

- Deployment: `dpl_BscyaUKzc7ZrE3PZxwQSUjnBMQmv`
- Preview exato: `https://orcaly-htbz9mjp2-vinicius-araujos-projects.vercel.app`
- Vercel: READY, Preview, commit exato `d47ac1869dcfc22b93e122508153caf665d09cdf`
- Hosted Tax run `36319880597`: PASS
- Hosted matrix: 7/7 PASS, 0 page errors
- Artifact `10932416353`: 13 arquivos, 12 screenshots, ZIP SHA-256 `fa24f01a1718c0f4f6dcc77707bbd1ea30dbc269c4c94e47862a2058bcda9e1d`
- Rolling V8 run `36319880582`: PASS
- Platform Quality Gate run `36319883451`: PASS

QA protegido: usa share temporário do **deployment exato** armazenado no Vault de staging, relê durante convergência e só avança quando `/api/internal/preview-build` responde `environment=preview` + SHA exato. Deployment Protection não foi desligada; alias de branch não certifica SHA.

## Tax Center certificado

Arquivos: `app/apps/wealth/impostos/*`, `lib/wealth/tax.ts`, `scripts/test-wealth-tax.mjs`, `scripts/e2e-wealth-tax-hosted.mjs`, migration `20260927013000_wealth_tax_center_foundation.sql`.

RPC `public.wealth_tax_center(date,date,integer,uuid)`: STABLE, SECURITY INVOKER, authenticated EXECUTE, anon sem EXECUTE. Índice `wealth_portfolio_tax_dates` presente. Lab separado. Sem segundo caixa. Sem imposto oficial, DARF, alíquota, filing, jurisdição ou provider inventado. Flags: provider/rules/filing NOT_CONFIGURED; jurisdiction UNSPECIFIED.

Domain/PG: 7 PASS. Hosted: auth real staging, valores exatos, owner/RLS/cross-user, entitlements, Lab, invalid window, archived holding, anonymous redirect, bloqueio de requests à produção, 6 larguras, 2 temas, Axe, teclado/foco, reduced motion e sem overflow.

Cleanup final staging: auth.users=0, auth.sessions=0, storage.objects=0; fontes Wealth=0; receipts privados=0; audit=0; jobs=0; outbox=0; idempotency=0; cron ativo=0.

## Banco / reconciliação

Staging: 24 migrations. Produção: READ ONLY, 51 migrations, sem migration/função/índice Tax.

Arquivo Tax é o mesmo blob desde `e7122f0e969794a73d2819cd92fb7c6365874f42`; SHA LF `ee0ab55c216dfcd5e1ca6527b486263987bd853b5528f5b75e89da0c54a40870`. O campo textual `schema_migrations.statements[1]` registrou os delimitadores `$$` como `$`, produzindo SHA `d54637e2e61904423d0cfad229789ca4db6d841904173e89c6bb15098093392e`. Não reparar nem editar migration aplicada; futura alteração real usa migration nova.

Advisors: 1 WARN security herdado em `get_my_platform_admin_access()`; performance 63 initplan + 54 multiple-permissive; FK sem índice INFO.

## Blockers globais separados

Main Site `global-lint-baseline` continua vermelho separadamente (257 erros/148 warnings). Tax scoped lint: 0 erros, 1 warning de arquivo E2E ignorado pela configuração ESLint global. Platform Quality Gate e Rolling V8 estão verdes.

Produção/main não foram alteradas nem promovidas. WhatsApp congelado. Não declarar DEVELOPMENT_COMPLETE/READY_FOR_PRODUCTION.

## Próxima unidade: Morning / Night

Implementar briefings Wealth explicáveis com `Observe → Understand → Act`, somente com dados reais.

Morning: situação do dia, contas próximas, recorrências, metas, dívida, alertas factuais, documentos/vencimentos, Shield, Portfolio e próximos compromissos quando houver dados.

Night: mudanças do dia, registros, pendências, progresso, anomalias factuais, amanhã e ações explicáveis.

Não inventar fatos/provider. Depois certificar domain/PG, RLS/owner/entitlement, UI/hosted E2E, cleanup e evidence antes de Alerts.

Evidência Tax: `docs/qa/ORCALY_WEALTH_TAX.md` e JSONs BUILD/DEPLOYMENT/VERCEL_E2E.
