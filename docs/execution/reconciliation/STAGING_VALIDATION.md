# Validação do staging — 26/09/2026

Status: **STAGING CERTIFICADO para o escopo Auth/Hub/Wealth/entitlement/consent testado**, incluindo Vercel + Supabase hospedados. Isto não certifica os módulos antigos ou o master completo.

Preview: https://orcaly-mkw4graiy-vinicius-araujos-projects.vercel.app — READY, `dpl_2UQGyp24Qp76u4E5PF243rJs1aQY`, commit `df87d092d617facf9d937fb8fcfb1e095837b53b`. **14 checks hospedados PASS**, zero erros e cleanup confirmado. [Relatório](vercel-staging-e2e.json). A proteção do Preview permaneceu ativa; URL temporária de acesso ficou somente em arquivo ignorado.

## Resultado verificável

- Produção: `ozrasuktfthsvbqprtel`, somente leitura. Staging: `zwxulgpjucxudadjdqov`.
- Baseline `20260926030809_production_schema_baseline.sql`, SHA-256 `87c63653f6d382d7674eb034f3a61d0daea4bd1fc9a34b6c73dddf94c4f53036`.
- Baseline aplicada em transação e comparada ao catálogo real: **zero diferenças semânticas** nas categorias auditadas. [Comparação](baseline-comparison.json).
- Depois, aplicada somente `20260926014103_ecosystem_identity_wealth.sql`, SHA-256 `58862143c3384632e3cc4aeee3b2b7b87423052ff95464214fa23182c7b611b5`.
- Delta: 6 tabelas, 56 colunas, 16 índices (incluindo índices de constraints), 53 constraints, 15 policies, 5 triggers, 2 funções, 1 schema privado. **154 adições, zero alterações/remoções de objetos existentes.** [Delta completo](wealth-schema-delta.json).
- 13 checks E2E passaram usando Auth, JWT, refresh, PostgREST e persistência do Supabase real. Aplicação Next.js inicialmente local em porta 4174; essa execução sozinha não certifica a hospedagem Vercel.
- Cleanup: zero usuários e zero eventos de auditoria dos fixtures restantes. Nenhum cliente real foi copiado. Cron jobs e Vault secrets continuam vazios.
- Types reais gerados em `supabase/types/staging.generated.ts`.
- Build, typecheck, 60 testes de domínio/PostgreSQL e lint dos dois arquivos de aplicação corrigidos: PASS. O lint global preexistente não foi declarado resolvido.

## Fluxos E2E

Login por senha e issuer do JWT; refresh e getUser; bloqueio anônimo; proibição de autoemissão/elevação de entitlement; isolamento SELECT/INSERT/UPDATE/DELETE e troca de proprietário; entitlement ausente/revogado/vencido/futuro/somente leitura; consentimento privado e revogação irreversível; auditoria restrita com IDs apenas; login via Server Action, Hub e Wealth; perfil/lançamento/meta/simulação/reload e valores em centavos; campo user_id forjado ignorado; reenvio de Action sem sessão bloqueado pelo proxy; formulário antigo bloqueado após revogação; consentimento revogado pela Action apesar de diferença de relógio/microssegundos; Home autenticada redireciona ao Hub. Zero erros de página, zero requisições do navegador para produção. Axe WCAG A/AA sem violações no Wealth testado.

## Erros encontrados e correções

1. O gerador de arquivo de aplicação usava substituição JavaScript com string: `$` no SQL gravado no ledger era interpretado pelo replace. Corrigido com callback; tentativa com erro de sintaxe não alterou o staging.
2. Algumas funções retornam tipos compostos de tabela. CREATE FUNCTION antes das tabelas falhou; transação revertida. Ordenação corrigida para tabelas → funções → defaults/constraints/views/policies/triggers.
3. `pg_catalog` no fim do search_path escolhia `extensions.gen_random_uuid()` para defaults. A primeira comparação detectou 103 defaults diferentes. Staging ainda vazio foi resetado com guardas, mantendo objetos Supabase; baseline refeita com pg_catalog primeiro. Comparação final zero. ACL nula de função equivale aos grants PostgreSQL padrão e é normalizada explicitamente, sem ampliar acesso.
4. O formulário de login perdia o destino `/apps` após rerender de campos controlados. Destino agora é validado pelo helper comum e atualizado no submit capture antes da criação de FormData; login real novo passou.
5. Revogação imediata podia preceder o granted_at do banco por diferença de relógio/precisão. A Action lê o consentimento próprio e preserva o timestamp integral do banco quando necessário. Teste usa grant futuro e microssegundos, e confirma revogação persistida.
6. Ajustados dois waits do harness: reenvio anônimo recebe redirect do proxy; botão de revogação muda de texto enquanto pending. Assertions agora verificam a fronteira real e aguardam a resposta da Action antes de consultar persistência.

## Advisors e riscos herdados

RLS sem policy: 44 avisos de tabelas públicas em produção; 45 no staging, incluindo `ecosystem_audit_events`, deliberadamente inacessível a clientes. Não foram criadas policies permissivas para silenciar avisos. O aviso SECURITY DEFINER de `get_my_platform_admin_access()` já existe em produção: função restringe por auth.uid e papel ativo; preservada.

Performance herdada: 63 auth_rls_initplan, 54 multiple_permissive_policies, 1 FK sem índice (`integration_push_channels.connection_id`). Índices não usados são mais numerosos no staging porque ele está vazio. Nenhum novo WARN estrutural desses grupos foi introduzido. Consulte [evidência de grants/advisors](staging-security-evidence.json) e os links oficiais de remediação nela.

Diferenças operacionais intencionais: sem dados, usuários, buckets/objetos, segredos, cron jobs e ledger histórico; ledger novo contém baseline e Wealth em ordem de execução explícita. Nenhuma assinatura/pagamento/conector externo foi ativado. MFA hospedado com fator real, fluxos antigos Business/Storage/workers e integrações externas não estão certificados por estes testes.

## Comandos executados

Auditoria: Git branch/HEAD/status/diff, help do CLI, SELECTs em transações READ ONLY via MCP, leitura de ledger e catálogos, advisors. Uma consulta inicial de ledger pelo CLI exibiu `Initialising login role`; consultas posteriores de produção usaram somente MCP. Nenhum SQL de escrita de aplicação foi enviado à produção.

Preparação/aplicação: `supabase migration new production_schema_baseline --workdir .local-qa/staging-workdir`; `node scripts/audit-migration-reconciliation.mjs`; `node scripts/build-staging-baseline.mjs`; `node scripts/prepare-staging-migration.mjs baseline`; `supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-baseline-staging.sql -o json`. Rehearsal de reset vazio por `prepare-staging-baseline-reset.mjs`, com o mesmo ref explícito. Depois `prepare-staging-migration.mjs wealth` e query do arquivo `apply-wealth-staging.sql`. Nenhum db push ou migration repair executado.

Validação: `compare-schema-snapshots.mjs`, `verify-staging-evidence.mjs`, types/advisors via MCP, `start-staging-qa.mjs`, agent-browser, `e2e-ecosystem-staging.mjs`, `npm run test:ecosystem`, `npm run typecheck`, lint específico, `npm run build`, `git diff --check`.

Vercel: login renovado pelo proprietário; quatro variáveis adicionadas SOMENTE a Preview/branch `codex/orcaly-ecosystem` no projeto orcaly: URL/anon key de staging, service role de staging (sensitive), ORCALY_WEALTH_ENABLED=true. Configurações de produção preservadas. Deploy e certificação da URL serão registrados abaixo.

Deploy realizado por push autorizado da branch ao GitHub. O build hospedado confirmou environment=preview e SHA exato. Inspeção dos bundles encontrou URL de staging e não encontrou URL Supabase de produção nem a service role. Login/Auth e persistência confirmaram o backend real. O harness hospedado passou a aguardar persistência com prazo máximo após receber a resposta da Action, porque `response.finished()` ficou aguardando o stream RSC da Vercel mesmo com revogação já persistida. A execução interrompida foi limpa pelo script restrito aos IDs/emails dos fixtures; a repetição completa passou.

Verificação final de produção: catálogo antes/depois com zero diferenças (`production-unchanged.json`), 51 migrations, última `20260910150730`; metadados das variáveis Vercel de produção iguais; main em `d940debf9556e1180fa3c709da0f560d3aa96374`; deployment de produção segue `dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf`. Ledger de staging contém apenas baseline e Wealth. Auth users, Storage objetos/buckets, Vault secrets, cron jobs e as seis tabelas novas: zero linhas depois do cleanup.

## Antes de produção

Revisar delta e as três divergências históricas UNKNOWN; manter baseline como caminho de bootstrap de ambientes vazios, nunca aplicá-la em produção existente. Revisar issuance comercial, migrações locais extras ausentes em produção, plano de rollback, backups e integrações. Nenhuma autorização de promoção existe nesta execução.
