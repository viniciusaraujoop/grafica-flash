# Orçaly — relatório do checkpoint

## Ampliação do MASTER CONTINUATION FINAL

Preview certificado: https://orcaly-hbabdndwa-vinicius-araujos-projects.vercel.app, deployment `dpl_3TYWmENqUvwiaX5uV97kbY2f9zjN`, SHA `510b38aeb7aacd15ecbc8e50b113eb1269998920`, READY/Preview. **21 checks hospedados PASS**, zero erros/requests de produção; cleanup com zero usuários e auditoria. Evidência: `docs/qa/ORCALY_WEALTH_LIFECYCLE_VERCEL_E2E.json`. Proteção do Preview preservada. Continuação automática: recorrências; ainda não aplicadas no staging.

Retomada de `34dcc06` na mesma branch. Seções 6.1–6.3 implementadas: archive/restore, metas editáveis com status e paginação, agregações integrais com centavos exatos. Uma migration aditiva aplicada apenas ao staging; ledger agora três versões, delta intencional auditado de 20 diferenças, tipos regenerados. 75 testes e build/typecheck/scoped lint PASS; 20 checks E2E locais usando Supabase real PASS. Preview desta ampliação em certificação. Evidências: `docs/qa/ORCALY_WEALTH_LIFECYCLE.md`. Produção preservada. O restante do master permanece PARCIAL e deve prosseguir automaticamente, começando por recorrências.

26/09/2026. **A auditoria, a reconciliação e a certificação do staging foram concluídas. O master completo continua PARCIAL.** Depois da certificação, o trabalho avançou para histórico paginado, exportação CSV e edição de lançamentos do Wealth. Home, Hub e Wealth Core não foram refeitos.

## Resultado da missão imediata

Produção `ozrasuktfthsvbqprtel` permaneceu em leitura. O CLI foi confirmado em staging `zwxulgpjucxudadjdqov`, que inicialmente tinha zero migrations. Branch `codex/orcaly-ecosystem`, HEAD inicial `05e08a03058a127e36fb5a6712755beb9bf6c0c0`. A instalação local preexistente do Supabase CLI alterava package/lock; foi preservada separadamente no commit `3709105`.

A comparação sistemática abrangeu 71 SQLs locais, 51 registros de produção, schema real e staging vazio. A matriz contém 79 linhas, incluindo oito migrations exclusivamente remotas. Equivalência foi avaliada por SQL/hashes e objetos reais, não só pelo nome:

| Classificação | Quantidade |
| --- | ---: |
| EXACT_MATCH | 19 |
| SAME_CHANGE_DIFFERENT_VERSION | 20 |
| LOCAL_ONLY | 28 |
| REMOTE_ONLY | 8 |
| SUPERSEDED | 1 |
| UNKNOWN | 3 |

Os casos conhecidos de timestamps diferentes, versões curtas/duplicadas, consolidações e arquivos remotos ausentes estão discriminados em [MIGRATION_RECONCILIATION.md](reconciliation/MIGRATION_RECONCILIATION.md) e [migration-matrix.json](reconciliation/migration-matrix.json). SQL dinâmico é indicado como limite da extração estática. Execução manual histórica não pode ser comprovada só pelo catálogo; não foi inventada uma origem para esses casos. As três diferenças UNKNOWN continuam registradas: hardening com DML de auditoria, corpos de funções de convites e casts/guardas de FK em qualidade de clientes.

## Estratégia implementada

Foi construída uma **baseline reproduzível schema-only do catálogo real de produção**, sem replay da cadeia histórica divergente. Não havia Docker/pg_dump disponível; o gerador usa definições PostgreSQL dos catálogos e compara os objetos resultantes.

Baseline `20260926030809_production_schema_baseline.sql`, SHA-256 `87c63653f6d382d7674eb034f3a61d0daea4bd1fc9a34b6c73dddf94c4f53036`: 113 tabelas de aplicação, 11 views, 3 sequências identity, 85 funções, 147 policies e 31 triggers de aplicação. Auth/storage gerenciados foram preservados, incluindo sete triggers nativos do storage; policies customizadas foram tratadas separadamente. Extensões e ACLs, inclusive grants por coluna/default privileges, foram verificadas.

Comparação baseline com produção: **zero diferenças semânticas nas categorias auditadas**. Normalizações de ordenação/ACL padrão/posições físicas de colunas e metadados gerenciados estão documentadas. Isso certifica o catálogo auditado; não afirma que dados/configurações operacionais de produção foram clonados.

Depois foi aplicada somente `20260926014103_ecosystem_identity_wealth.sql`, SHA-256 `58862143c3384632e3cc4aeee3b2b7b87423052ff95464214fa23182c7b611b5`. Apesar do timestamp numérico anterior, ela foi executada explicitamente depois da baseline. Ledger novo: duas versões. Nenhum db push ou migration repair foi usado.

Comparação final staging contra produção: **154 adições intencionais, zero alterações/remoções de objetos existentes**. São seis tabelas, 56 colunas, 16 índices, 53 constraints, 15 policies, cinco triggers, duas funções e um schema privado. RLS, grants, SECURITY DEFINER/search_path e acesso à auditoria foram verificados. Tipos reais gerados em `supabase/types/staging.generated.ts`.

Nenhum cliente real, auth.users, dado pessoal, bucket/objeto ou secret foi copiado; nenhum cron job/webhook externo foi ativado. Fixtures sintéticos foram removidos após cada execução. Staging permanece consistente e sem dados de teste restantes.

Detalhes, erros, comandos e comparação: [BASELINE_STRATEGY.md](reconciliation/BASELINE_STRATEGY.md), [STAGING_VALIDATION.md](reconciliation/STAGING_VALIDATION.md), [baseline-comparison.json](reconciliation/baseline-comparison.json), [wealth-schema-delta.json](reconciliation/wealth-schema-delta.json).

## Erros encontrados e resolvidos

- Substituição JavaScript interpretava símbolos do SQL no arquivo de aplicação; corrigida com callback.
- Funções com retorno de tipo composto exigiam criação das tabelas antes delas; ordem corrigida após rollback.
- Primeiro ensaio completo escolhia a função gen_random_uuid de extensions em 103 defaults. A comparação detectou a diferença; somente o staging novo/vazio foi resetado com guardas, e a baseline com pg_catalog primeiro passou.
- Login perdia o destino após rerender; corrigida a atualização do campo antes de FormData. Auth real passou.
- Revogação de consentimento podia anteceder granted_at por relógio/microssegundos; a Action preserva a precisão do timestamp do banco. Teste hospedado com grant futuro passou.
- O harness da Vercel aguardava o fim de um stream RSC mesmo depois da persistência. Foi substituído por espera limitada do estado real; fixtures da execução interrompida foram removidos por IDs/emails conhecidos.
- O novo teste de select usava label com correspondência exata, incluindo opções; locator corrigido. Testes de filtros e telas menores passaram.

Nenhuma migration histórica foi apagada, renomeada ou ajustada às cegas.

## Certificação e continuação do master

Primeiro Preview certificado: https://orcaly-mkw4graiy-vinicius-araujos-projects.vercel.app, `dpl_2UQGyp24Qp76u4E5PF243rJs1aQY`, SHA `df87d092d617facf9d937fb8fcfb1e095837b53b`: **14 checks inteiramente hospedados PASS**.

Cobertura: login/sessão/issuer/refresh reais, App Hub/Wealth, leitura e escrita A/B, owner forjado, entitlement ausente/futuro/vencido/revogado/read-only, consentimento e grants por coluna, auditoria privada, Actions sem sessão/formulário antigo, perfil/entradas/metas/simulação/reload e centavos exatos. Axe WCAG A/AA passou nos estados testados; zero erros de página ou requisições do navegador para produção.

A continuação implementou:
- Histórico pessoal em `/apps/wealth/lancamentos`, 25 registros/página, ordenação estável, filtros por mês e tipo.
- CSV em `/apps/wealth/exportar`, exigindo read + export permission, sessão/entitlement, RLS e auditoria. Máximo 1.000 resultados; falha explícita para excesso/incompletude, centavos exatos, fórmulas neutralizadas na importação inicial.
- Testes de download, filtros hostis, isolamento, autorização, fórmula/aspas, paginação sem duplicação e responsividade. Nenhuma alteração de schema nesta unidade.
Novo Preview certificado: https://orcaly-8lixqya7l-vinicius-araujos-projects.vercel.app, deployment `dpl_H989JrfT1sLVKnbAyFwPMTXgPwiH`, SHA **`2f85a3323ea090195b9c2b0b43eb27ed2d78ae83`**, READY/Preview. **15 checks hospedados PASS**, incluindo histórico, filtros, download CSV, autorização de exportação, auditoria e responsividade. Zero erros ou dados de fixtures restantes. Evidência: `docs/qa/ORCALY_WEALTH_RECORDS_VERCEL_E2E.json`.

| Verificação atual | Resultado |
| --- | --- |
| npm run build | PASS, incluindo suítes preexistentes do prebuild |
| npm run test:ecosystem | PASS, 69: 51 domínio/contratos e 18 PostgreSQL/RLS |
| npm run typecheck | PASS |
| Lint dos arquivos novos/alterados | PASS |
| npm audit | 0 vulnerabilidades |
| E2E local com Supabase real, incluindo histórico/CSV/edição | 17 checks PASS; fixtures removidos |
| Axe e layout do novo histórico | PASS; 320/390/768 sem transbordamento, screenshots inspecionados |
| git diff --check | PASS |
| Lint global | Falhas preexistentes; não declarado resolvido |

Evidências antigas continuam identificadas como históricas em `docs/qa/ORCALY_EVIDENCE.json`. Certificação real em `reconciliation/vercel-staging-e2e.json`; unidade nova em `docs/qa/ORCALY_WEALTH_RECORDS*`. MFA com fator real, fluxo integral de Business, storage/workers legados e provedores externos não estão certificados.

## Git, Preview e produção

Aplicação mais recente enviada: `62008d4078e99c9efb5dbecac88784ef5d144ab5`. HEAD final pode conter apenas documentação posterior. Trabalhos anteriores do usuário foram preservados em `00aa4f7`; não houve descarte, force push ou merge em main.

Edição de lançamentos relê a linha com owner/RLS, detecta revisão antiga e compara atomicamente os valores no UPDATE. Preserva identidade/proprietário/chave de idempotência/criação, registra auditoria e bloqueia abas antigas, IDs forjados, perda de write e replay anônimo. Sem mudança de schema. Parser monetário corrigido para aceitar o limite inclusivo do banco e rejeitar o centavo seguinte. Preview final certificado: https://orcaly-icaddekex-vinicius-araujos-projects.vercel.app, deployment `dpl_BQWTpnh3fs8yNWuXLWt7HG3QiuGH`, SHA **`62008d4078e99c9efb5dbecac88784ef5d144ab5`**, READY/Preview. **18 checks inteiramente hospedados PASS**, incluindo edição, conflito entre abas, histórico, CSV, Auth, Actions e isolamento. Zero erros; fixtures removidos. Evidência: `docs/qa/ORCALY_WEALTH_EDIT_VERCEL_E2E.json`.

Vercel CLI foi autenticado pelo proprietário. Variáveis configuradas somente no Preview da branch: URL/anon key de staging, service role sensitive de staging e flag Wealth. Proteção mantida ativa; acesso temporário/credenciais ficam em arquivos ignorados, nunca no Git.

Produção: main `d940debf9556e1180fa3c709da0f560d3aa96374`, deployment `dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf`. Catálogo antes/depois sem diferenças; ledger continua 51; metadados de variáveis Vercel preservados. Nenhuma promoção nesta execução.

## Pendências reais

| Escopo | Estado / próxima entrega |
| --- | --- |
| Wealth | Core, histórico, exportação e edição de lançamentos implementados; arquivamento, edição/paginação de metas, agregados integrais, recorrência automática e análises avançadas pendentes |
| Business / Partners | Fluxos existentes preservados; E2E completo de operação/pagamento ainda não executado |
| ID / Hub | Auth real e fronteiras pessoais testados; MFA com fator real, briefing/notifications/billing unificado pendentes |
| Entitlements / consentimento | Enforced no servidor/DB; emissão comercial, bundles, grant de consentimento e consumidores pendentes |
| Growth / Flow / Academy / Market / One | Descoberta não equivale a workflows implementados; funcionalidades novas permanecem pendentes |
| Intelligence / afiliados | Arquitetura e integração com bases existentes; engine compartilhado, receipts, provedores/licenças e conversões reais pendentes |
| PWA / branding | Manifesto mestre e assets disponíveis; ícones aprovados por produto, offline/push/subdomínios pendentes |

Advisors herdados não foram silenciados: RLS-no-policy 44/45 INFO, definer restrito get_my_platform_admin_access, 63 auth_rls_initplan, 54 multiple_permissive_policies e FK integration_push_channels.connection_id sem índice. Não houve novo WARN estrutural. Índices não utilizados são esperados num staging vazio.

Antes de produção: revisar delta/UNKNOWNs e locais extras, preparar rollback/backups, implementar/revisar ciclo comercial, validar fluxos legados relevantes e obter autorização específica de release. A baseline é bootstrap para ambiente vazio; nunca aplicar em produção existente. [NEXT_CODEX_HANDOFF.md](NEXT_CODEX_HANDOFF.md) contém comandos, arquivos e ponto exato de continuação.
