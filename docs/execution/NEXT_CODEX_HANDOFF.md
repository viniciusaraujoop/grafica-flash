# Continuação exata — Orçaly

Preview certificado: https://orcaly-bb34uyljo-vinicius-araujos-projects.vercel.app; deployment dpl_Fg2Cw8q2o9YyUmSrSaGewcHqFkqr; SHA de aplicação 0df50275488e326aa0b2da8cab2a96b085a66841. READY/Preview. 27 checks inteiramente hospedados PASS, zero erros/requests para produção e todas as contagens de cleanup zero. Evidência: docs/qa/ORCALY_WEALTH_DEBT_VERCEL_E2E.json.

Produção ozrasuktfthsvbqprtel somente leitura. Staging zwxulgpjucxudadjdqov é o link atual do CLI. Branch codex/orcaly-ecosystem; GitHub/Preview autorizados, sem promoção/main. Não db push histórico, migration repair ou alteração de SQL aplicado. WhatsApp congelado.

## Próxima ação concreta
Próxima unidade: seção 6.6 Net Worth do MASTER CONTINUATION FINAL (C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_CONTINUATION_FINAL.md, 40 seções já lidas). Suportar classes de ativos/passivos, liquidez, concentração, alocação e evolução; depois 6.7 Financial Health e demais seções. O master completo permanece PARCIAL. Não refazer 6.1–6.5.

Confira git status/log; HEAD pode incluir documentação/teste de certificação depois do SHA de aplicação acima. Leia AGENTS.md e guias Next locais antes de código. Comece por lib/wealth/core.ts, lib/wealth/summary.ts, app/apps/wealth/page.tsx e as migrations Wealth atuais. O patrimônio já é soma integral de ativos menos passivos; Debt Center usa a mesma entrada, não outro saldo. Preserve isso. Evolução futura precisa de origem/datas explícitas: auditoria atual guarda identificadores, não reconstruir valores históricos inexistentes. Defina novas classificações/snapshots como migration futura, teste antes em staging e não refaça a baseline.

## Banco e operação
Staging: oito migrations já aplicadas na ordem explícita baseline 20260926030809, Wealth 20260926014103, lifecycle 20260926103114, recorrências 20260926110128, boundary 20260926153138, clock 20260926164000, debt 20260926165000, conflito 20260926171000. Não reaplicar/resetar. Hashes locais iguais ao ledger; ver reconciliation/CONTINUATION_MIGRATIONS.md. Inventário local atual: 77 SQLs. Matriz histórica original 71 locais/51 produção/79 linhas/3 UNKNOWN permanece histórica, sem equivalência presumida.

Um cron interno de staging foi testado em dois ciclos reais e permanece PAUSADO para QA determinístico. Zero chamadas externas, pagamentos ou secrets copiados. Ver docs/qa/ORCALY_WEALTH_CLOCK.md. Servidor local de QA foi encerrado; nenhuma porta 4174 em escuta.

Conflito de formulário NÃO usa SQLSTATE 40001: o PostgREST hospedado repetia a chamada. A migration 20260926171000 usa PT409, comprovado por resposta HTTP 409 em até sete segundos e mensagem da Server Action. Não editar o SQL original para esconder a correção.

## QA e Preview
95 testes e build final PASS; 16 checks locais focados + 27 completos no Preview PASS. Evidências em docs/qa/ORCALY_WEALTH_DEBT*. Tipos remotos gerados; RLS/grants/advisors e delta em reconciliation/staging-debt-*. O limite do simulador é explícito (50 dívidas, 600 meses, taxas mensais fixas declaradas), sem taxas variáveis/tarifas/garantia ou execução financeira.

Vercel project prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O / team_c5p2Uiz9b1SqKxOhmnmxUWZH. CLI autenticado. Env somente Preview da branch aponta staging. Proteção do Preview preservada. Share link em .local-qa/reconciliation/vercel-debt-access.json, ignorado e temporário; renovar somente se expirar. Nunca imprimir chaves/links de acesso.

Para repetir quando mudança justificar: node scripts/e2e-ecosystem-staging.mjs com ORCALY_STAGING_APP_URL da URL certificada, ORCALY_STAGING_ACCESS_FILE acima, ORCALY_EXPECTED_COMMIT exato e ORCALY_QA_RECORDS/EDIT/LIFECYCLE/RECURRENCE/DEBT=true. Manter cron pausado durante fixtures; scripts/configure-wealth-staging-cron.mjs gera SQL guardado para enable/pause/inspect no staging. Se interrompido, scripts/cleanup-staging-fixtures.mjs limpa somente IDs/emails de QA registrados; terms são cascade da entrada.

Não executar dev/typegen/build simultaneamente (corrompeu tipos/manifests gerados no Windows, já corrigido). Não matar todos os Node/Chrome. Próxima etapa deve continuar automaticamente até unidade certificada/contexto; deixar handoff preciso se contexto acabar. Histórico antigo nos arquivos HISTORY_THROUGH_LIFECYCLE é registro, não instrução vigente.
