# Handoff V8 — continuar pelo Tax Center foundation

STATUS: CHECKPOINT_CONTINUATION_REQUIRED. Branch codex/orcaly-ecosystem; conferir git rev-parse HEAD e git status. Runtime certificado d0c3383098264fc0ae1e4db708eb52c2c3d81d94, Preview https://orcaly-2n45x21q2-vinicius-araujos-projects.vercel.app (dpl_4LajAfKaf6pbERKStFPUGbcYLnxR READY). Commit posterior de checkpoint muda docs/evidências e cleanup QA, sem runtime. Não voltar aos antigos HEADs do prompt.

## Próxima ação

Implementar Tax Center foundation, ainda sem código/migration. Fontes exploradas somente de leitura: wealth_portfolio_transactions.type inclui tax/fee/income/dividend/interest/sell; realized_gain_cents e basis_removed_cents são declarações e podem ser nulos. Ligação correta transaction.holding_id→wealth_holdings.portfolio_id→wealth_portfolios; NÃO existe transaction.portfolio_id. Valores em BRL, imutabilidade do ledger, Lab separado, sem segundo caixa. wealth_entries é a verdade financeira; não duplicar movimentos de Portfolio somando-os automaticamente a lançamentos. Vault já tem categoria tax. Não há apuração fiscal/regra tributária/jurisdição ou provider fiscal implementado; não inventar alíquotas, imposto devido ou envio oficial. Tax foundation deve expor origem/cobertura/limitações. Seguir sequência V5, consultar fontes primárias se precisar de regras atuais.

Depois: Morning/Night→Alerts→Ask Wealth→Portfolio Intelligence→Market/Radar→Open Finance→Regulatory→UX Spec/foundation/registry/skins→auth/Hub2/Launcher/Palette→billing/One/consent/Pulse/IA→demais produtos→hardening/performance/observabilidade/QA final. Master incompleto. Nunca declarar DEVELOPMENT_COMPLETE/READY_FOR_PRODUCTION sem todos os gates. Mesmo V8, não criar V9.

## Preservar o certificado

Fee Analyzer (/apps/wealth/tarifas) usa fee/tax existentes, RLS/owner/read/INVOKER, intervalo366 dias/página25, comparação igual e centavos exatos. Arquivadas incluídas, Lab excluído, ausência não significa custo zero. Runtime inicial086bf5773e6cfb10d9e7a1574bf036ea6df96e8c, docs4a167b5,24 hosted PASS; regressão final d0c3383 também PASS.

Shield (/apps/wealth/shield): usuário confirmou foco em proteção patrimonial e seguros declarados, documentos e vencimentos; sem contratar/recomendar produtos. Cadastro/edição/archive/restore, nullable cents, prazos declarados, quota1000/páginas25, vínculos próprios com bem/Vault/recorrência, RLS/owner/read+write/CAS PT409/replay exato/receipts privados. Vínculos históricos sem FK, revalidados em escrita/leitura; indisponíveis não revelam metadata alheia. Não altera contrato externo, conta, bem ou arquivo. Eventos audit privados existem, mas ainda não são projetados pela allowlist da Timeline. Providers NOT_CONFIGURED. Não refazer Shield/Fee/Home/Hub/Core/Portfolio/Calendar/Planning/Vault/Timeline/Family/Automation.

## Banco e segurança operacional

Staging zwxulgpjucxudadjdqov, CLI vinculado,23 migrations/92 SQLs locais, vazio após cleanup.20260927001122_wealth_fee_analyzer SHA LF5a0630265cdbebdadf7f36e961a32a2990eabfb8c84a7b4fb893fdacd2a8164f;20260927003416_wealth_shield_declared_policies SHA LFc4f249842c87c39dfdb6b81b5e3c6a1f897ca20c7247b16c6de8eebef55bd85f. NÃO editar/reaplicar.23 hashes verificados em staging-shield-ledger.json. Baseline raw CRLF87c63653f6d382d7674eb034f3a61d0daea4bd1fc9a34b6c73dddf94c4f53036 intacta.3 UNKNOWN históricos preservados.

Próxima migration: gerar nome real com CLI; adicionar chave nova ao prepare-wealth-staging.mjs com guard23 versões+predecessorShield+banco vazio; testar PG antes de aplicar. Preparar SQL transacional+ledger e aplicar explicitamente via npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql. Nada de db push histórico/reset/repair. Tipos remotos gerados, não editados semanticamente. Snapshot de partida .local-qa/reconciliation/staging-shield-final-schema.json; produção .local-qa/reconciliation/production-shield-readonly-schema.json.709 adições intencionais cumulativas, zero legado alterado/removido. Post-E2E schema idêntico.

.env.local aponta PRODUÇÃO. Iniciar QA somente node scripts/start-staging-qa.mjs(port4174), nunca Next diretamente. Não dev/typegen/build concorrentes. Nenhum QA em execução ao fechar. Credenciais .local-qa/reconciliation/staging-api-keys.json via helper staging-credentials.mjs; nunca imprimir. Cron pausado0 ativos.

Produção ozrasuktfthsvbqprtel SOMENTE LEITURA. main d940debf9556e1180fa3c709da0f560d3aa96374, Vercel produção dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf/aliases preservados. Não reset/dbpush/repair/merge/promoção. WhatsApp congelado. GitHub/Preview já autorizados: viniciusaraujoop/grafica-flash, branch codex/orcaly-ecosystem, Vercel prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O/team_c5p2Uiz9b1SqKxOhmnmxUWZH. Não pedir autorização novamente para esse escopo.

## Testes e cleanup

176 testes domínio/PG, typecheck/lint/prebuild/build PASS (3 warnings herdados). Shield18 checks locais e29 hosted finais (flags DOCUMENTS/SHIELD/FEES), final2026-09-27T01:04:11.587Z. ORCALY_WEALTH_SHIELD_VERCEL_E2E.json/BUILD.json/DEPLOYMENT.json e12 screenshots finais. Fee local17/hosted24 inicial; todos4 checks Fee também passaram no Preview final. Todas6 larguras/dois temas/Axe/teclado/reduced motion/sem overflow; leitor de tela humano continua gate.

E2E: scripts/e2e-ecosystem-staging.mjs, nova flag ORCALY_QA_SHIELD=true, ORCALY_QA_FEES=true; na URL Preview usar ORCALY_EXPECTED_COMMIT e arquivo de acesso ignorado. Token temporário .local-qa/reconciliation/vercel-shield-access.json expira, não publicar. Fixtures Admin confirmadas @example.test, sem email. IDs de auditoria devem ser coletados por ator E por tabela antes do cascade: registros inseridos por Admin têm actor null. Nova tabela wealth_protection_policies já incluída no coletor. Primeira suíte deixou52 eventos insert/delete de26 IDs sintéticos; guard/prova permitiram remover só estes, e rerun completo exit0 confirmou cleanup. Erro inicial preservado, não mascarado. Console de erro só primeira linha+localização sanitizada, nunca stack/cookies/headers.

Cleanup final SQL+API: zero usuários/sessões/Storage/todaswealthpúblicas+privadas/receipts/audit/jobs/outbox/idempotência/cron ativo. Advisors finais: SECDEF público1 WARN herdado; private RLS-no-policy54 INFO intencional;63 initplan/54 multiplepermissive WARN;1 FK/295 unusedindex INFO. Leaked-password não apareceu; não afirmar correção sem mudança Auth. Gates globais Auth/MFA/advisors/leitor de tela/performance e integrações reais continuam abertos.
