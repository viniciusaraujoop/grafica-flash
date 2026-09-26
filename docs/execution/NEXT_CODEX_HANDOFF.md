# Continuação exata — Orçaly

Preview certificado: https://orcaly-rh4b0iz24-vinicius-araujos-projects.vercel.app; deployment dpl_8RkJ1jNeu2qjoR3F6W3GqERv2t23; SHA de aplicação 84581c93e258367ee8ec4b919b1b5b4322cdbce7. READY/Preview. 30 checks hospedados PASS, zero erros de navegador/requests para produção e cleanup inteiro zero. Evidência docs/qa/ORCALY_WEALTH_NET_WORTH_VERCEL_E2E.json.

Produção ozrasuktfthsvbqprtel somente leitura; staging zwxulgpjucxudadjdqov vinculado ao CLI. Branch codex/orcaly-ecosystem; GitHub/Preview já autorizados. Não reset, db push histórico, repair, edição de SQL aplicado, promoção ou merge main. WhatsApp congelado. Home/Hub e Wealth 6.1–6.6 preservados.

Master ativo: C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_FINALIZATION_V3.md, 49 seções lidas. Canônico V2.2 ausente no caminho indicado; decisões reproduzidas no V3 são a referência. Master completo permanece PARCIAL; isto é um checkpoint, não certificação de desenvolvimento completo.

Net Worth 6.6 certificado: mesmas wealth_entries/Debt, 16 classes de ativos, oito de passivos, cinco liquidez, composição integral, maiores posições/concentração, snapshots explícitos imutáveis/idempotentes com fuso e origem. Sem cotações, reconstrução histórica ou segundo saldo. 100 testes domínio/PostgreSQL, typecheck, lint de escopo, build e Preview PASS. Tabelas com rolagem ganharam foco de teclado após Axe identificar problema com a massa grande; nova suíte hospedada completa passou. Ver docs/qa/ORCALY_WEALTH_NET_WORTH.md.

Staging contém nove migrations: baseline 20260926030809 aplicada primeiro; Wealth 20260926014103; lifecycle 20260926103114; recurrence 20260926110128; boundary 20260926153138; clock 20260926164000; debt 20260926165000; conflito PT409 20260926171000; net worth 20260926180000. Não reaplicar. Inventário local: 78 migrations. SQL/ledger conferidos em staging-net-worth-ledger.json. A baseline preserva bytes originais, inclusive CRLF internos; seu hash original não é o hash após normalização LF. Nenhum SQL foi modificado para alterar hashes.

Delta vs Debt: 27 adições e expansão intencional de column_order de wealth_entries. Cumulativo vs produção: 298 adições, nenhum objeto anterior alterado/removido. Produção atual mantém 51 versões e schema idêntico ao capturado; evidência production-net-worth-readonly-check.json. Matriz histórica original e três UNKNOWNs continuam preservados. Advisors sem WARN estrutural novo; avisos legados e configuração Auth ainda pendentes. Cron interno de staging continua PAUSADO; servidor local QA encerrado; fixtures zero.

Próxima unidade: Wealth 6.7 Financial Health do V3. Dez indicadores com valor, fonte, período, regra, interpretação e limitação; sem score arbitrário. Reutilizar wealth_summary, wealth_net_worth, snapshots, termos de dívida e recorrências; não refazer 6.1–6.6. Depois seguir Wealth restante e demais seções do V3. Pendências de produção incluem o master inteiro, MFA real, billing comercial, fluxos legados integrais, provedores/consentimentos, UNKNOWNs/avisos legados, backup/rollback e release gate.

Main permanece d940debf9556e1180fa3c709da0f560d3aa96374; deployment de produção conhecido dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf. Nenhuma alteração ou promoção de produção.

Operação: não executar dev/typegen/build simultaneamente no Windows. Não matar todos os Node/Chrome. Script de aplicação: prepare-wealth-staging.mjs com allowlist/pré-requisitos; depois db query com ref explícito. Conflito de versão usa PT409, nunca 40001 (retry PostgREST). Aplicações novas somente após testes locais.

E2E: scripts/e2e-ecosystem-staging.mjs, ORCALY_STAGING_APP_URL da URL certificada; ORCALY_EXPECTED_COMMIT do SHA exato; ORCALY_STAGING_ACCESS_FILE=.local-qa/reconciliation/vercel-net-worth-final-access.json (temporário, ignorado; renovar se expirar, nunca imprimir). Flags ORCALY_QA_RECORDS/EDIT/LIFECYCLE/RECURRENCE/DEBT/NET_WORTH=true. Manter cron pausado. Cleanup inclui snapshots antes do cascade para limpar auditoria; helper scripts/cleanup-staging-fixtures.mjs somente para fixtures registradas. Tipos via Supabase generate_typescript_types, sem imprimir conteúdo completo.
