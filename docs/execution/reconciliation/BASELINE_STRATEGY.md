# Reconciliação de staging — 26/09/2026

## Fronteiras e estado inicial

Produção `ozrasuktfthsvbqprtel` (GRAFICA FLASH) é somente leitura nesta execução. Staging autorizado: `zwxulgpjucxudadjdqov` (orcaly-staging), sa-east-1, ACTIVE_HEALTHY. CLI vinculado ao staging. Inicialmente: zero tabelas públicas, ledger inexistente, zero auth.users, storage.objects, storage.buckets e vault.secrets. Ambos usam PostgreSQL 17.6, patches Supabase diferentes; os objetos gerenciados auth/storage examinados são iguais.

Branch `codex/orcaly-ecosystem`, HEAD inicial `05e08a03058a127e36fb5a6712755beb9bf6c0c0`. As alterações preexistentes em package.json/package-lock.json instalam Supabase CLI 2.118.0; foram preservadas. Nenhuma migration histórica foi renomeada, removida ou reparada.

## Auditoria e decisões

Veja [matriz completa](MIGRATION_RECONCILIATION.md) e [evidência por objeto/hash](migration-matrix.json). Foram lidos integralmente os 71 SQLs locais e os statements das 51 entradas remotas. A normalização conserva literais e identificadores; nomes apenas sugerem candidatos. Há 19 EXACT_MATCH, 20 SAME_CHANGE_DIFFERENT_VERSION, 28 LOCAL_ONLY, 8 REMOTE_ONLY, 1 SUPERSEDED e 3 UNKNOWN. Duas equivalências de DDL têm comentários diferentes e hashes distintos, explicitamente registrados. UNKNOWN não significa equivalente.

Versões curtas/duplicadas e DML histórico impedem replay confiável. Presença atual de um objeto não prova execução manual de determinada migration: bootstrap, SQL manual e sobreposição posterior continuam possibilidades. Não é necessário resolver essa proveniência incerta para reproduzir o schema vigente. Em particular, funções antigas substituídas não serão reinstaladas.

Fonte da baseline: catálogos reais pg_class/attribute/constraint/index/proc/policy/trigger/namespace/default_acl, extensions, sequences, publications e event triggers. O script de coleta `scripts/sql/ecosystem-schema-audit.sql` abre transação READ ONLY. Os snapshots brutos e statements remotos ficam em `.local-qa/reconciliation` (ignorado); o repositório recebe a baseline SQL sem dados e a matriz de hashes.

A baseline contém 113 tabelas, 11 views, 3 sequências identity, 85 funções da aplicação, 147 policies (incluindo 4 storage) e 31 triggers da aplicação. Preserva constraints, índices, SECURITY DEFINER/search_path, ACLs de schema/tabela/função/coluna, grants e comentários. Permissões padrão são comparadas com o staging limpo. Objetos auth/storage nativos e papéis da plataforma são pré-requisitos comparados, não sobrescritos. Não existem triggers customizados em auth no snapshot.

Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1 e uuid-ossp 1.1 já coincidem; instalar somente pg_cron 1.6.4 ausente. O cron de produção `orcaly-release-expired-stock` NÃO será copiado nem agendado. Publications estão vazias em ambos. Não há subscriptions. Funções exportadas foram verificadas quanto a chamadas HTTP/dblink/credenciais literais; helpers Vault são preservados sem secrets.

Dados excluídos: todas as linhas da aplicação, auth.users e demais dados Auth, objetos Storage, secrets Vault, credenciais de conectores, ledger histórico e cron jobs. Os seis buckets de produção são apenas inventariados; configuração de buckets vazios, se necessária, será uma etapa separada. Dados de teste serão sintéticos e restritos ao staging.

## Execução reproduzível e validação

Não usar `supabase db push` na pasta histórica. A versão nova da baseline foi criada com `supabase migration new` em workdir isolado: `20260926030809`. Como a migration Wealth já existente tem versão anterior (`20260926014103`), a ordem é explícita: BASELINE, comparação integral, WEALTH, comparação do delta. Nenhum arquivo histórico é renumerado.

1. `node scripts/build-staging-baseline.mjs`: gera SQL e manifest com hash SHA-256, a partir dos snapshots auditados.
2. `node scripts/prepare-staging-migration.mjs baseline`: verifica link/ref/hash e prepara transação com guardas e ledger novo. A baseline exige postgres, schema público vazio e ausência de usuários/objetos/secrets.
3. Executar somente o arquivo preparado via `supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file ... -o json`. Registrar baseline e seu SQL no ledger novo na MESMA transação; erro reverte tudo. Isto inicializa histórico do staging, sem fingir replay de migrations antigas e sem migration repair.
4. Recoletar catálogo e comparar com produção. Diferenças de implementação física (OID, buracos de attnum de colunas removidas), ordem de ACL e dados/contadores não são diferenças semânticas. Toda outra divergência exige explicação/correção.
5. Somente com baseline equivalente, preparar/aplicar Wealth da mesma maneira, preservando sua versão original. Apenas essas duas migrations entram no ledger inicial do staging.
6. Advisors antes/depois; RLS, grants, Auth, isolamento entre usuários, entitlement, consent e Server Actions contra staging hospedado. Gerar types. Documentar delta final e limpeza de fixtures.

O runner é propositalmente restrito a este staging vazio. Não é um procedimento de deploy para produção. Antes de produção serão necessários revisão do delta, plano de rollback, verificação dos dados existentes e autorização específica de promoção.

## Fontes técnicas

Permissões por coluna e revogações seguem a [documentação PostgreSQL 17](https://www.postgresql.org/docs/17/sql-revoke.html). Privilégios padrão seguem [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html). A fonte da verdade para objetos existentes é o catálogo de produção coletado em leitura.

## Estado da execução

Baseline aplicada, comparada e certificada no staging, seguida apenas por Wealth. Veja `STAGING_VALIDATION.md` para resultados, erros corrigidos e limites da certificação, inclusive 14 checks Vercel + Supabase hospedados.
