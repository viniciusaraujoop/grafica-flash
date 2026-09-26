# Continuação exata — Orçaly

## Checkpoint vigente — MASTER CONTINUATION FINAL

Preview certificado: https://orcaly-hbabdndwa-vinicius-araujos-projects.vercel.app, deployment `dpl_3TYWmENqUvwiaX5uV97kbY2f9zjN`, SHA `510b38aeb7aacd15ecbc8e50b113eb1269998920`, READY/Preview. **21 checks hospedados PASS**, zero erros/requests de produção; cleanup com zero usuários e auditoria. Evidência: `docs/qa/ORCALY_WEALTH_LIFECYCLE_VERCEL_E2E.json`. Proteção do Preview preservada. Continuação automática: recorrências; ainda não aplicadas no staging.

E2E hospedado: usar URL/SHA acima, `ORCALY_STAGING_ACCESS_FILE=.local-qa/reconciliation/vercel-lifecycle-access.json` (ignorado), flags RECORDS/EDIT/LIFECYCLE. Não repetir a certificação sem alterações ou suspeita concreta. Staging continua vazio e consistente na migration lifecycle; arquivo de recorrências criado localmente não significa aplicado.

O usuário agora manda executar integralmente `C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_CONTINUATION_FINAL.md`, lido linha a linha nesta retomada. Não encerrar após um módulo; seguir automaticamente enquanto houver contexto útil.

Retomada de `34dcc06bf0c8a0bbf44bf4e2e596e313b112bc93`. Migration nova **já aplicada no staging**: `20260926103114_wealth_lifecycle_aggregates.sql`, SHA LF `a1ab880670c493a4fe8b3a3a856d16f13991404b438d1dd377779620584d8f83`. Ledger agora tem três versões. Não reaplicar nem resetar. Arquivamento/restauração, metas/status/paginação e RPC de agregados completos implementados. Types reais atualizados; 75 testes + typecheck/build/scoped lint PASS; 20 E2E local com Supabase hospedado PASS, limpeza zero. Falta certificar o novo Preview; detalhes em `docs/qa/ORCALY_WEALTH_LIFECYCLE.md`.

Harness: acrescentar `$env:ORCALY_QA_LIFECYCLE='true'` aos flags RECORDS/EDIT. Limpeza foi ampliada para paginação de IDs e lotes de auditoria, cobrindo mais de mil fixtures. Não executar build/typegen em paralelo ao servidor dev: houve manifesto incompleto e arquivos de tipos truncados no Windows; reinício e build isolado corrigiram. Próxima unidade de código: seção 6.4 recorrências, usando jobs existentes onde apropriado e sem cobranças/cron externo.

As seções seguintes documentam o checkpoint anterior, não o estado final da ampliação atual.

**Não recomeçar. O staging já está reconciliado e certificado.** Este documento substitui os handoffs antigos que pediam criar staging, autenticar o CLI ou repetir bootstrap. O master completo permanece parcial.

## Estado e limites

Workspace `C:\Users\arauj\grafica-flash`; PowerShell; Node 24.16; Next 16.3.4. Branch `codex/orcaly-ecosystem`. Leia AGENTS.md e os guias relevantes em node_modules/next/dist/docs antes de escrever Next.js. Master: `C:\Users\arauj\Downloads\CODEX_ORCALY_ECOSYSTEM_MASTER_EXECUTION.md`.

Produção `ozrasuktfthsvbqprtel` (GRAFICA FLASH, sa-east-1) SOMENTE LEITURA. Staging `zwxulgpjucxudadjdqov` (orcaly-staging, sa-east-1) é o destino autorizado e o link atual do CLI. Nunca db push na cadeia histórica da raiz; nunca reparar/apagar/renomear migrations antigas às cegas. Nenhuma promoção, merge em main ou reset de produção.

Usuário já autorizou push desta branch ao GitHub viniciusaraujoop/grafica-flash e Vercel Preview. CLI Vercel foi autenticado pelo proprietário; não pedir login novamente sem falha concreta. Nenhuma autorização adicional é necessária para continuar o staging/Preview dentro desse escopo.

`3709105` preserva a instalação local do Supabase CLI. `df87d09` contém reconciliação/correções. `cbf5445` registra a certificação. `2f85a33` adiciona histórico/CSV; `5b7b6af` consolida os documentos; aplicação atual: **`62008d4078e99c9efb5dbecac88784ef5d144ab5`**, com edição de lançamentos, já enviada ao GitHub. O HEAD pode incluir documentação posterior; conferir status e log antes de editar.

## Certificação existente

Baseline schema-only baseada no catálogo real, não na cadeia quebrada:
`supabase/baselines/20260926030809_production_schema_baseline.sql`,
SHA-256 `87c63653f6d382d7674eb034f3a61d0daea4bd1fc9a34b6c73dddf94c4f53036`.

Aplicada depois: `20260926014103_ecosystem_identity_wealth.sql`,
SHA-256 `58862143c3384632e3cc4aeee3b2b7b87423052ff95464214fa23182c7b611b5`.
A versão numérica é anterior à baseline; a ordem explícita é correta. Ledger novo contém só essas duas versões. Não reaplicar/resetar o staging certificado.

Comparação baseline→produção: zero diferenças semânticas auditadas. Final staging→produção: 154 adições pertencentes somente ao Wealth/ecossistema, nenhum objeto antigo alterado/removido. RLS/grants/definers/advisors/tipos verificados. Zero dados reais copiados, cron jobs ou secrets ativados. Histórico/exportação não alteram schema.

Ler `docs/execution/reconciliation/STAGING_VALIDATION.md`, `BASELINE_STRATEGY.md` e matriz completa. São 71 migrations locais e 51 remotas, 79 linhas reconciliadas. Três UNKNOWN permanecem como riscos históricos explícitos; baseline atual foi comprovada independentemente dessas ambiguidades.

Preview certificado anterior: https://orcaly-mkw4graiy-vinicius-araujos-projects.vercel.app, deployment dpl_2UQGyp24Qp76u4E5PF243rJs1aQY, SHA df87d092d617facf9d937fb8fcfb1e095837b53b, 14 checks hospedados PASS.
Novo Preview certificado: https://orcaly-8lixqya7l-vinicius-araujos-projects.vercel.app, deployment `dpl_H989JrfT1sLVKnbAyFwPMTXgPwiH`, SHA **`2f85a3323ea090195b9c2b0b43eb27ed2d78ae83`**, READY/Preview. **15 checks hospedados PASS**, incluindo histórico, filtros, download CSV, autorização de exportação, auditoria e responsividade. Zero erros ou dados de fixtures restantes. Evidência: `docs/qa/ORCALY_WEALTH_RECORDS_VERCEL_E2E.json`.

## Aplicação já entregue

Home/descoberta, App Hub, fronteira pessoal/empresa, Wealth Core (perfil/orçamento/reserva, receitas/despesas/ativos/passivos, metas e simulação), consentimento revogável e auditoria privada. Não refazer isso.

Nova unidade: `app/apps/wealth/lancamentos/page.tsx`, `exportar/route.ts`, `lib/wealth/records.ts` e `records-server.ts`. Histórico 25/página, filtros de mês/tipo; CSV no máximo 1.000 linhas, centavos exatos, escaping, read + export permission, sessão/RLS e auditoria obrigatória. Overview ainda declara limite de 500 entradas/100 metas. Recorrência é metadado, não execução automática.

Edição entregue em `app/apps/wealth/lancamentos/actions.ts`, `[entryId]/page.tsx`, `components/wealth/WealthEntryEditor.tsx` e `lib/wealth/entry-edit.ts`. Relê a linha própria, valida revisão e faz UPDATE comparando atomicamente os valores mutáveis. Não depende de coluna version/updated_at; não fornece histórico de versões nem arquivamento. Hash detecta estado antigo, não autoriza acesso. Auditoria existente permanece privada. Parser monetário ajustado ao limite inclusivo do banco.

69 testes domínio/PostgreSQL, build/typecheck/scoped lint PASS. 17 checks no app local + Supabase real, incluindo duas abas, owner forjado, read-only e replay anônimo. Axe e mobile PASS. Evidências em `docs/qa/ORCALY_WEALTH_RECORDS*` e `ORCALY_WEALTH_EDIT*`. Lint global preexistente não está resolvido. MFA com fator real e módulos antigos inteiros não estão certificados.

Preview final certificado: https://orcaly-icaddekex-vinicius-araujos-projects.vercel.app, deployment `dpl_BQWTpnh3fs8yNWuXLWt7HG3QiuGH`, SHA **`62008d4078e99c9efb5dbecac88784ef5d144ab5`**, READY/Preview. **18 checks inteiramente hospedados PASS**, incluindo edição, conflito entre abas, histórico, CSV, Auth, Actions e isolamento. Zero erros; fixtures removidos. Evidência: `docs/qa/ORCALY_WEALTH_EDIT_VERCEL_E2E.json`.

## Execução dos testes sem produção

Vercel project `prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O`, team `team_c5p2Uiz9b1SqKxOhmnmxUWZH`. Variáveis SOMENTE Preview/branch: staging URL/anon/service key + ORCALY_WEALTH_ENABLED=true. Não mudar settings de produção. Outros provedores herdados não foram exercitados.

Credenciais e acesso temporário em `.local-qa/reconciliation/`, ignorados. Nunca imprimir/commitar `staging-api-keys.json` ou `vercel-preview-access*.json`. O helper confirma issuer/ref/role do staging. Proteção do Preview deve ficar ativa. Links temporários expiram em 23h; renovar via ferramenta Vercel se necessário, guardando em arquivo ignorado.

Comandos de inspeção/QA conforme mudanças:
```powershell
git status --short --branch
git log -4 --oneline
git rev-parse HEAD
git ls-remote --heads origin main codex/orcaly-ecosystem
Get-Content supabase/.temp/project-ref
npm run test:ecosystem
npm run typecheck
# Build inclui suítes existentes; não repetir sem mudança/falha/risco novo.
npm run build
```

App local de staging: `node scripts/start-staging-qa.mjs` inicia 127.0.0.1:4174 com env de processo. Não altera .env.local. O servidor de QA desta execução (PID 14204 e filhos verificados) foi encerrado depois dos testes. Verificar a porta antes de reiniciar; outros processos preexistentes foram preservados. Não matar todos os Node/Chrome.

E2E hospedado:
```powershell
$env:ORCALY_STAGING_APP_URL='https://orcaly-icaddekex-vinicius-araujos-projects.vercel.app'
$env:ORCALY_STAGING_ACCESS_FILE='.local-qa/reconciliation/vercel-edit-access.json'
$env:ORCALY_EXPECTED_COMMIT='62008d4078e99c9efb5dbecac88784ef5d144ab5'
$env:ORCALY_QA_RECORDS='true'
$env:ORCALY_QA_EDIT='true'
node scripts/e2e-ecosystem-staging.mjs
```

O harness verifica SHA/environment, bundles sem URL de produção/service key, cria somente fixtures sintéticos @example.test em staging, testa Auth/RLS/Actions/UI e remove usuários/auditoria. Relatório/screenshot em `.local-qa/staging-browser/`; copiar evidência sanitizada para docs/qa após PASS. Se interrompido: `node scripts/cleanup-staging-fixtures.mjs` limpa apenas IDs/emails registrados, jamais usuários arbitrários. Não usar response.finished() para Actions da Vercel: stream RSC pode ficar aberto; persistência deve ser aguardada com prazo.

## Próxima unidade do master

1. Completar arquivamento de lançamentos e edição/arquivamento de metas. A edição de lançamentos já funciona e detecta estado antigo: não refazê-la. Começar por `app/apps/wealth/actions.ts`, `lancamentos/actions.ts`, `components/wealth/WealthForm.tsx`, `lib/wealth/core.ts` e migration existente. **Entries/goals ainda não têm updated_at/version/archived_at**. Definir a semântica de arquivamento/concorrência antes de SQL novo; migration deve ser aditiva, testada apenas em staging e adicionada à comparação do delta, nunca editar o histórico já aplicado. O arquivamento precisará filtrar overview/histórico/CSV de forma consistente e prever restauração autorizada.
2. Agregados integrais/paginação de metas. Não apresentar a amostra de 500 como total completo. Recorrências precisam idempotência e jobs/outbox existentes, sem criar cobranças.
3. Emissão comercial de entitlements a partir de billing real; nunca cliente autoemitindo grant. One não deve ampliar acesso de empresa/pessoal implicitamente.
4. Grant de consentimento com acesso independente à origem/destino, finalidade, escopo e expiração. Adicionar testes dos consumidores antes de transferir dados.
5. Academy/afiliados, shared intelligence/Decision Receipts, Growth/Flow/Market/One e PWA: seguir docs/architecture, contratos existentes e direitos de conteúdo/provedores. Descoberta não significa produto operacional.

Produção antes/depois: catálogo e variáveis Vercel iguais, main d940debf9556e1180fa3c709da0f560d3aa96374, deployment dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf. Release de produção segue fora desta autorização. Revisar UNKNOWNs e locais extras, backups/rollback, billing e fluxos legados antes de qualquer proposta futura.

Verificação final depois das ampliações: `reconciliation/staging-schema-after-app-e2e.json` e `production-unchanged-after-app-e2e.json` têm zero diferenças. `staging-final-cleanup.json` confirma apenas duas migrations, zero usuários/linhas das seis tabelas, cron jobs, Vault secrets e objetos/buckets de storage. Último E2E terminou em 2026-09-26T04:22:54Z. Uma revisão documental posterior não muda o commit de aplicação certificado acima; se o alias da branch mudar, usar a URL imutável testada.
