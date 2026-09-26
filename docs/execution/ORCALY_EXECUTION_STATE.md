# Orçaly — estado de execução

## Continuação vigente: lifecycle e totais integrais

Preview certificado: https://orcaly-hbabdndwa-vinicius-araujos-projects.vercel.app, deployment `dpl_3TYWmENqUvwiaX5uV97kbY2f9zjN`, SHA `510b38aeb7aacd15ecbc8e50b113eb1269998920`, READY/Preview. **21 checks hospedados PASS**, zero erros/requests de produção; cleanup com zero usuários e auditoria. Evidência: `docs/qa/ORCALY_WEALTH_LIFECYCLE_VERCEL_E2E.json`. Proteção do Preview preservada. Continuação automática: recorrências; ainda não aplicadas no staging.

Master ativo: `C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_CONTINUATION_FINAL.md`, lido integralmente. Retomada de `34dcc06bf0c8a0bbf44bf4e2e596e313b112bc93`, branch autorizada, árvore inicialmente limpa. As seções históricas abaixo preservam certificados anteriores; este bloco registra a ampliação atual.

Aplicada **somente ao staging** a migration `20260926103114_wealth_lifecycle_aggregates.sql`. Ledger agora tem três versões. Arquivamento/restauração de lançamentos, ciclo completo de metas com paginação, versão monotônica e agregações integrais implementados. 75 testes de domínio/PostgreSQL, TypeScript, lint de escopo e build PASS. E2E local com Supabase real: 20 checks PASS, zero fixtures restantes; revisão visual ampliada em andamento. Preview desta ampliação ainda a certificar. Evidência e delta de 20 alterações intencionais: `docs/qa/ORCALY_WEALTH_LIFECYCLE.md` e `reconciliation/staging-lifecycle-delta.json`. Nenhum objeto legado, migration histórica ou produção alterado.

Próxima unidade após certificação Preview: recorrências reais, idempotentes, com retry/lock/stale recovery, pause/resume/cancel e fuso; depois seguir as demais seções do master. Não repetir Home/Hub, baseline nem auditoria histórica saudável.

Checkpoint de 26/09/2026. **Staging certificado para Auth/Hub/Wealth/entitlement/consent; master completo ainda PARCIAL.** Não reiniciar Home, Hub ou Wealth Core.

## Checkout e autorizações

- Workspace: C:\Users\arauj\grafica-flash; branch `codex/orcaly-ecosystem`.
- Início desta retomada: `05e08a03058a127e36fb5a6712755beb9bf6c0c0`.
- `3709105` preserva a instalação local preexistente do Supabase CLI ^2.118.0 em package.json/lock (234 linhas acrescentadas no lock). Nada foi descartado.
- `df87d092d617facf9d937fb8fcfb1e095837b53b`: reconciliação, baseline, correções de login/consentimento e E2E real.
- `cbf5445`: evidência da primeira certificação hospedada e cleanup restrito de fixtures.
- `2f85a3323ea090195b9c2b0b43eb27ed2d78ae83`: histórico paginado e exportação Wealth, enviado ao GitHub autorizado.
- `62008d4078e99c9efb5dbecac88784ef5d144ab5`: edição de lançamentos com proteção contra sobrescrita de estado antigo, enviado à mesma branch.
- HEAD final pode incluir documentação posterior. Consultar `git rev-parse HEAD`; distinguir HEAD documental do SHA de aplicação testado.
- GitHub autorizado: `viniciusaraujoop/grafica-flash`, somente esta branch. Vercel autorizada: Preview. Produção não pode ser promovida/alterada.

## Banco reconciliado

| Ambiente | Ref | Estado |
| --- | --- | --- |
| Produção GRAFICA FLASH | ozrasuktfthsvbqprtel | Somente leitura; 51 migrations; última 20260910150730 |
| Staging orcaly-staging | zwxulgpjucxudadjdqov | Baseline real + Wealth; CLI vinculado aqui |

Ambos sa-east-1. A auditoria comparou 71 SQLs locais, 51 registros remotos, catálogo real e staging inicialmente vazio. Matriz de 79 linhas: 19 EXACT_MATCH, 20 SAME_CHANGE_DIFFERENT_VERSION, 28 LOCAL_ONLY, 8 REMOTE_ONLY, 1 SUPERSEDED e 3 UNKNOWN. Os três UNKNOWN permanecem explicitamente sem equivalência presumida. SQL, hashes, objetos, sobreposições e versões curtas/duplicadas estão em [MIGRATION_RECONCILIATION.md](reconciliation/MIGRATION_RECONCILIATION.md) e [migration-matrix.json](reconciliation/migration-matrix.json).

Baseline schema-only derivada do catálogo real: `supabase/baselines/20260926030809_production_schema_baseline.sql`, SHA-256 `87c63653f6d382d7674eb034f3a61d0daea4bd1fc9a34b6c73dddf94c4f53036`. Preserva tabelas, funções, RLS/policies, ACLs, índices, triggers, comentários e extensões necessários; auth/storage gerenciados foram tratados separadamente. Nenhum dado real, auth.users, bucket/objeto, secret ou cron job foi copiado.

Depois foi aplicada explicitamente `20260926014103_ecosystem_identity_wealth.sql`, SHA-256 `58862143c3384632e3cc4aeee3b2b7b87423052ff95464214fa23182c7b611b5`. O timestamp dela é anterior ao da baseline: a ordem de execução foi intencional, sem replay histórico. Ledger de staging contém somente essas duas versões.

Comparação da baseline: **zero diferenças semânticas** nas categorias auditadas, com normalizações documentadas. Delta final: **154 adições intencionais, zero objetos existentes alterados/removidos** (6 tabelas, 56 colunas, 16 índices, 53 constraints, 15 policies, 5 triggers, 2 funções, 1 schema). Tipos reais gerados em `supabase/types/staging.generated.ts`. Evidência e comandos: [STAGING_VALIDATION.md](reconciliation/STAGING_VALIDATION.md).

Não houve db push, migration repair, renomeação/remoção histórica ou reset de produção. O reset foi apenas do staging novo e vazio durante o ensaio, após a comparação detectar binding incorreto de defaults; a repetição passou.

## Vercel e verificação

CLI Vercel autenticado pelo proprietário. Quatro variáveis exclusivas de Preview/branch apontam para staging: URL, anon key, service role sensitive e ORCALY_WEALTH_ENABLED=true. Produção ficou intacta. Proteção do Preview continua ativa; tokens e links temporários estão somente em arquivos ignorados.

Primeira certificação: [Preview df87d09](https://orcaly-mkw4graiy-vinicius-araujos-projects.vercel.app), deployment `dpl_2UQGyp24Qp76u4E5PF243rJs1aQY`: **14 checks hospedados PASS**. Testa login, issuer/refresh, RLS A/B, entitlement, consentimento, Actions, Hub/Wealth, centavos, acesso anônimo e acessibilidade. Corrigiu perda do destino após rerender no login e revogação com diferença de relógio/microssegundos.

Histórico/exportação: **67 testes de domínio/PostgreSQL PASS**, build/typecheck/lint de escopo PASS, **14 checks locais com Supabase real PASS**, CSV com autorização própria e auditoria, filtros/paginação, isolamento, download, Axe e responsividade 320/390/768.
Novo Preview certificado: https://orcaly-8lixqya7l-vinicius-araujos-projects.vercel.app, deployment `dpl_H989JrfT1sLVKnbAyFwPMTXgPwiH`, SHA **`2f85a3323ea090195b9c2b0b43eb27ed2d78ae83`**, READY/Preview. **15 checks hospedados PASS**, incluindo histórico, filtros, download CSV, autorização de exportação, auditoria e responsividade. Zero erros ou dados de fixtures restantes. Evidência: `docs/qa/ORCALY_WEALTH_RECORDS_VERCEL_E2E.json`.

Produção permanece em `d940debf9556e1180fa3c709da0f560d3aa96374` / `dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf`; catálogo antes/depois e metadados das variáveis Vercel iguais. Cleanup de staging confirmou zero usuários/linhas de fixtures, cron jobs, Vault secrets e objetos/buckets de storage.

Após as ampliações, nova coleta confirmou zero diferenças no staging certificado e zero alterações de catálogo em produção: `reconciliation/staging-schema-after-app-e2e.json`, `production-unchanged-after-app-e2e.json` e `staging-final-cleanup.json`. Servidor local de QA encerrado; Preview hospedado permanece disponível. Migrations históricas continuam sem diff contra o início desta retomada.

## Continuação e limites

- Entregue nesta continuação do master: histórico pessoal com 25 linhas/página, mês/tipo e CSV até 1.000 linhas, sem truncamento silencioso, exigindo wealth.read + wealth.export; edição de lançamentos exige read + write, proprietário/RLS e revisão atual. Nenhuma migration adicional.
- Edição: 69 testes domínio/PostgreSQL, build/typecheck/lint PASS; 17 checks locais com Supabase real PASS. Preview final certificado: https://orcaly-icaddekex-vinicius-araujos-projects.vercel.app, deployment `dpl_BQWTpnh3fs8yNWuXLWt7HG3QiuGH`, SHA **`62008d4078e99c9efb5dbecac88784ef5d144ab5`**, READY/Preview. **18 checks inteiramente hospedados PASS**, incluindo edição, conflito entre abas, histórico, CSV, Auth, Actions e isolamento. Zero erros; fixtures removidos. Evidência: `docs/qa/ORCALY_WEALTH_EDIT_VERCEL_E2E.json`.
- Pendente Wealth: arquivamento de lançamentos, edição/arquivamento de metas, agregados integrais do overview (ainda identifica limite de 500 registros), paginação de metas (100 no overview), recorrência automatizada, ativos/dívidas avançados e contexto familiar.
- Pendente plataforma: emissão comercial de entitlements, bundles/billing, grant de consentimento e consumidores, shared intelligence/Decision Receipts, notificações.
- Growth, Flow, Academy, Market e One continuam sem os novos workflows completos. Business/Partners preservados; não houve reimplementação de Home/Hub.
- PWA por produto e novos provedores dependem também de assets aprovados/credenciais/eligibilidade; isso não bloqueia todo o trabalho de código restante.
- MFA com fator real, Business order-to-finance, storage/workers e integrações externas não foram certificados. Lint global tem falhas preexistentes; escopo novo está limpo.
- Advisors herdados: 44/45 RLS-no-policy INFO, SECURITY DEFINER restrito get_my_platform_admin_access, 63 auth_rls_initplan, 54 multiple_permissive_policies, FK integration_push_channels.connection_id sem índice. Nenhum novo WARN estrutural. Não abrir policies para silenciá-los.

Próxima execução: [NEXT_CODEX_HANDOFF.md](NEXT_CODEX_HANDOFF.md). Antes de produção ainda são necessários revisão do delta/drift, lifecycle comercial, plano de rollback/backups e autorização específica. Esta execução não promove produção.
