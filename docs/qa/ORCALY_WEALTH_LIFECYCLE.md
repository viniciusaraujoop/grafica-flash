# Wealth — ciclo de vida e agregações integrais

Unidade 6.1–6.3 do MASTER CONTINUATION FINAL, 26/09/2026. Produção não alterada.

Preview certificado: https://orcaly-hbabdndwa-vinicius-araujos-projects.vercel.app, deployment `dpl_3TYWmENqUvwiaX5uV97kbY2f9zjN`, SHA `510b38aeb7aacd15ecbc8e50b113eb1269998920`, READY/Preview. **21 checks hospedados PASS**, zero erros/requests de produção; cleanup com zero usuários e auditoria. Evidência: `docs/qa/ORCALY_WEALTH_LIFECYCLE_VERCEL_E2E.json`. Proteção do Preview preservada. Continuação automática: recorrências; ainda não aplicadas no staging.

## Implementação e limites
- Lançamentos: arquivar/restaurar, confirmação visual, filtros e CSV consistentes; não há exclusão física pelo fluxo.
- Metas: edição, status active/paused/completed, prazo, progresso, arquivar/restaurar e paginação estável de 25 itens.
- Concorrência: versão monotônica controlada no banco + compare-and-swap nas Actions. Um ciclo arquivar/restaurar invalida abas antigas mesmo se o conteúdo financeiro voltar ao original.
- Identidade, idempotency key e created_at imutáveis; não se editam valores enquanto arquivado, nem junto com a transição de arquivamento.
- Totais do overview: RPC SECURITY INVOKER com auth.uid(), entitlement e RLS; valores agregados em centavos como texto exato, formatados por BigInt. Listas de 15/25 registros não limitam cálculos.
- Receitas/despesas/fluxo por mês; ativos/passivos declarados acumulados; reserva e capacidade planejadas; cobertura das metas limitada ao alvo de cada meta; evolução de 12 meses e categorias.
- Moeda BRL; patrimônio declarado não representa cotação. Recorrência automática ainda será a próxima unidade. Nenhuma cobrança, job externo ou provedor foi ativado.

## Migration e reconciliação
Nova: `20260926103114_wealth_lifecycle_aggregates.sql`.
SHA-256 normalizado LF: `a1ab880670c493a4fe8b3a3a856d16f13991404b438d1dd377779620584d8f83`.

Aplicada em transação somente a `zwxulgpjucxudadjdqov`, com guard de link, staging vazio, presença da baseline e Wealth, versão ainda não aplicada e registro atômico no ledger. Nenhum db push/replay histórico.

`reconciliation/staging-lifecycle-delta.json` compara o último staging certificado e o catálogo após a migration. Exatamente 20 diferenças: 7 colunas, 2 índices, 2 triggers, 2 funções e 4 constraints adicionados; corpo da função de auditoria do ecossistema atualizado; 2 listas de colunas ampliadas. Nenhuma remoção, mudança de RLS/policies/grants existentes, extensão, schema auth/storage, trigger legado ou função de produção. A auditoria conserva ACL privada, SECURITY DEFINER e search_path vazio; o novo guard é invoker e sem execute para clientes. RPC pública invoker: authenticated execute, anon/PUBLIC negados.

Ledger passa a três versões: baseline real (aplicada primeiro), Wealth original e lifecycle. Histórico antigo e baseline preservados. Types regenerados do staging real.

## Verificação
- 75 testes de domínio/PostgreSQL PASS, incluindo 1.205 lançamentos e 105 metas, totals acima de Number.MAX_SAFE_INTEGER, constraints, imutabilidade, isolamento e entitlement.
- TypeScript PASS. Build PASS após recuperação dos arquivos gerados conflitantes; avisos legados do lint do prebuild permanecem. Lint de escopo Wealth PASS.
- Advisors sem novos WARN: security 45 INFO RLS sem policy e 1 WARN definer legado; performance 1 INFO FK, 63 WARN auth_rls_initplan, 54 WARN multiple_permissive_policies, 299 INFO unused_index. Os WARN pertencem ao legado e não autorizam reparo em produção.
- E2E local + Supabase real: 20 checks PASS; zero erros/requests de produção e limpeza com zero usuários/auditoria. Revisão visual e medição interna dos cards em 320/390/768/1440 PASS; Axe A/AA nas metas e edição PASS. Evidência: `ORCALY_WEALTH_LIFECYCLE_LOCAL_E2E.json`. Preview ainda a certificar.

## Erros encontrados
A primeira execução local encontrou 404 nas rotas dinâmicas; o manifesto dev omitia essas rotas. O build concorrente também encontrou tipos dev gerados truncados. Servidor QA encerrado, dois arquivos gerados preservados em área ignorada para diagnóstico, build isolado passou; após reinício o manifesto reconhece as rotas. Não houve alteração do código das rotas para ocultar o problema. Evitar build/typegen concorrente com dev neste checkout Windows.

## Comandos
```text
npx supabase migration new wealth_lifecycle_aggregates
npm run test:ecosystem
node scripts/prepare-wealth-staging.mjs lifecycle
npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql -o json
npm run typecheck
npx eslint app/apps/wealth components/wealth lib/wealth
npm run build
node scripts/start-staging-qa.mjs
ORCALY_QA_RECORDS=true ORCALY_QA_EDIT=true ORCALY_QA_LIFECYCLE=true node scripts/e2e-ecosystem-staging.mjs
node scripts/compare-schema-snapshots.mjs .local-qa/reconciliation/staging-final-edit-schema.json .local-qa/reconciliation/staging-lifecycle-schema.json staging-lifecycle-delta
```
Os envs acima são notação descritiva; no PowerShell usar $env. Secrets ficam apenas nos helpers/arquivos ignorados. Consulta de changelog oficial e documentação: [release Postgres](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [funções e ACL](https://supabase.com/docs/guides/database/functions), [locks](https://www.postgresql.org/docs/17/explicit-locking.html). Não houve upgrade de produção.
