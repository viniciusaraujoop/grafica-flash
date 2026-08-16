# Orçaly — Recovery R3: baseline de staging

Data da execução: 16 de agosto de 2026.

## 1. Resumo

A preparação local do baseline schema-only foi concluída e validada estaticamente, mas a aplicação remota não ocorreu. O conector oficial e, em seguida, o vínculo do Supabase CLI foram recusados pelo limite de uso do Codex antes de qualquer operação ser executada. A stack local também não pôde ser criada porque Docker não está instalado.

O gate permanece bloqueado de forma segura. Staging não foi alterado, produção não foi usada como target e nenhuma fase posterior foi iniciada.

## 2. Branch/commits

Branch: `codex/recovery-r3-staging-baseline`, criada a partir de `a23c4fd` (`Add Supabase CLI and recovery database scripts`).

As alterações estão organizadas no worktree, mas nenhuma foi staged/commitada: a tentativa de `git add` foi recusada pelo mesmo limite de uso antes de executar. Nenhum push foi executado. O trabalho continua preservado na branch e pode ser revisado pelo diff.

## 3. Guardrail

`scripts/run-recovery-supabase.mjs` continua fail-closed e exige simultaneamente:

- `ORCALY_RECOVERY_TARGET=staging`;
- link real em `supabase/.temp/project-ref`;
- Project Ref exatamente `hdlqlvqsugnacijcokrg`;
- rejeição explícita de produção `ozrasuktfthsvbqprtel`;
- comando pertencente à allowlist: `db push`, `db push --dry-run` ou o `config push` exato do staging.

O vínculo não foi criado: `supabase/.temp/project-ref` permanece ausente. Portanto, o wrapper não pode fazer push acidental.

Os dois testes negativos passaram: sem `ORCALY_RECOVERY_TARGET`, exit 1; com target staging e sem link real, exit 1.

## 4. Baseline migrations

As seis migrations foram geradas pelo Supabase CLI oficial 2.114.0 e revisadas antes de qualquer tentativa remota:

1. `20260816191215_baseline_extensions_and_schemas.sql`;
2. `20260816191217_baseline_tables.sql`;
3. `20260816191219_baseline_constraints_and_indexes.sql`;
4. `20260816191222_baseline_functions_triggers_views.sql`;
5. `20260816191224_baseline_rls_and_grants.sql`;
6. `20260816191227_baseline_storage_and_cron.sql`.

O verificador `npm run recovery:verify-baseline` passou. Ele confere contagens, cobertura RLS, views invoker, search path das funções definer, grants privados, ausência de targets/secrets/dados reais no SQL, Auth local, integrações de código e integridade SHA-256 do legado.

As 51 migrations históricas foram movidas, nunca apagadas, para `supabase/migrations_legacy`. O diretório contém README, manifesto SHA-256 e as 33 versões observadas no histórico remoto de produção.

## 5. Objetos criados

Objetos **preparados localmente**, ainda não criados em staging:

- 86 tabelas de aplicação em `public`;
- 2 tabelas em `orcaly_private`;
- 369 constraints;
- 288 índices independentes, somados a 118 índices de constraints, totalizando 406;
- 62 funções;
- 26 triggers;
- 11 views;
- 143 policies em tabelas de aplicação e 4 policies de Storage;
- 6 definições de buckets vazios;
- 1 job cron estrutural.

## 6. Diferenças para produção

O baseline preserva o contrato estrutural observado, com hardenings aprovados na R2.5:

- consolida três triggers antigos de `company_members` em um único contrato concorrente;
- adiciona integridade tenant defensiva a `internal_tasks`;
- remove bypasses por email fixo na gestão de empresa/equipe;
- mantém 19 tabelas backend/admin/legadas sem policy ou grant cliente;
- remove grants `anon` excessivos de nove tabelas do workspace de afiliados;
- mantém todas as views como `security_invoker`;
- mantém `artes` público temporariamente como dívida conhecida, sem liberar escrita cliente;
- não inclui linhas de negócio, usuários, arquivos, objetos de Storage, credenciais ou payloads reais.

## 7. Functions

Foram preparadas 62 funções. As 46 `SECURITY DEFINER` possuem `search_path` explícito. Execução pública/default é revogada e somente funções necessárias recebem ACL explícita.

`orcaly_private.create_default_site_for_company` permanece apenas como compatibilidade estrutural, sem wrapper público. As rotas ativas agora usam `lib/site/create-default-site.server.ts`, que valida empresa, usa configuração central, grava um batch e serializa chamadas concorrentes no mesmo processo.

## 8. Triggers

Foram preparados 26 triggers:

- `trg_company_members_before_write` aplica limite de dois membros ativos com advisory lock determinístico;
- `trg_internal_tasks_tenant_integrity` impede responsável, lead, pedido ou proposta de outro tenant;
- os demais reproduzem os contratos estruturais observados e revisados.

## 9. Views

As 11 views estão declaradas com `security_invoker=true`. Nenhuma view `SECURITY DEFINER` foi introduzida.

## 10. RLS

Todas as 86 tabelas `public` do baseline recebem `ENABLE ROW LEVEL SECURITY`. Foram preparadas 143 policies de aplicação. As 19 tabelas backend/admin/legadas classificadas na R2.5 permanecem intencionalmente sem acesso cliente.

Os testes autenticados A×B não puderam ser executados porque o schema e os usuários sintéticos ainda não existem no staging.

## 11. Grants

Os grants são explícitos e independentes das policies. `anon` e `authenticated` começam com revogação total; somente operações necessárias são reemitidas. `orcaly_private` não está nos schemas expostos pela Data API e nenhuma tabela privada recebe grant cliente.

`anon`/`authenticated` recebem apenas `USAGE` no schema privado para resolver helpers allowlisted usados por policies; a execução geral continua revogada e é concedida função a função.

## 12. Storage

Foram preparadas definições vazias equivalentes para `artes`, `financeiro`, `logos`, `product-images`, `produtos` e `site-assets`, com seus limites/MIME types conhecidos. Quatro policies autenticadas limitam objetos privados a paths tenant-scoped derivados no servidor.

Nenhum objeto real foi copiado. Upload/download e isolamento A×B não foram testados remotamente. `STORAGE HARDENING — ARTES` permanece obrigatório antes de expor arquivos no Portal.

## 13. Cron

A migration prepara `pg_cron` e o job `orcaly-release-expired-stock` a cada cinco minutos. A extensão/job não foi ativada no remoto. Se o plano Free rejeitar a extensão, essa migration deve parar e o cron deve permanecer desativado, conforme a regra da Recovery.

## 14. Fase 1

A Fase 1 não foi reemitida nem aplicada. A ordem mandatória exige primeiro aplicar e validar todas as seis migrations do baseline. O SQL histórico aprovado permanece preservado em `supabase/migrations_legacy/20260816155115_operational_foundation_v1.sql`.

## 15. Fase 2

A Fase 2 não foi reemitida nem aplicada pelo mesmo gate sequencial. O SQL histórico aprovado permanece em `supabase/migrations_legacy/20260816162948_customer_portal_read_only_v1.sql`.

Os testes unitários de token, hash, expiração/revogação, DTO, timeline, cache privado e IDOR continuam passando localmente.

## 16. Auth staging

`supabase/config.toml` foi preparado conforme a R2.5:

- email/senha habilitado para login;
- signup público desabilitado;
- confirmação de email habilitada;
- anonymous sign-in desabilitado;
- JWT de 3600 segundos;
- refresh rotation habilitada e reuse interval de 10 segundos;
- senha mínima de 8 caracteres, sem classe obrigatória;
- Site URL `http://localhost:3000`;
- somente redirects locais `localhost/**` e `127.0.0.1/**`;
- nenhum OAuth ou SMTP real.

O endpoint/UI de equipe foi alinhado a oito caracteres e o fallback agora usa `crypto.randomBytes`. A configuração não foi enviada ao staging.

## 17. Seed artificial

Não criado. A criação depende do baseline, F1/F2 e Auth configurados no staging. Nenhum usuário ou dado real foi copiado.

## 18. RLS A×B

Não executado remotamente. A cobertura estática confirma RLS em 86/86 tabelas `public`, mas isso não substitui testes com JWTs autenticados de Empresa A e Empresa B.

## 19. BOLA/IDOR

Os testes unitários do Portal passaram para escopo `company_id + entity_type + entity_id`, inclusive tentativa de outra entidade. O teste integrado com dois tenants e Storage permanece bloqueado pela ausência do staging aplicado.

`internal_tasks` recebeu validação server-side nas rotas POST/PATCH e trigger defensivo no banco preparado.

## 20. Testes

Resultados locais:

- `npm run recovery:verify-baseline`: passou;
- `npm run security:check`: passou;
- `npm run verify:payments`: passou;
- `npm run verify:payment-credentials`: passou;
- fundação sem o contrato de migration: 9/9 passaram;
- Portal sem o contrato de migration: 11/11 passaram;
- `npm test`: esperado 9 passes + 1 falha por `ENOENT` na migration F1 histórica, pois F1/F2 ainda não podem ser reemitidas antes do baseline remoto.

O teste completo só poderá ser considerado aprovado depois que as migrations F1/F2 oficiais existirem novamente na linhagem ativa.

## 21. TypeScript

`npx tsc --noEmit`: passou. Os dois projetos TypeScript dos testes também compilaram.

## 22. Build

`npm run build`: passou com Next.js 16.2.9/Turbopack, incluindo TypeScript e geração de 213 páginas.

## 23. Lint baseline

O lint focado nos arquivos R3 passou com zero erro/aviso. O lint global encontrou 385 erros e 142 avisos, concentrados na dívida histórica e em diretórios de backup. O baseline R2.5 era 394 erros/143 avisos; portanto, não há aumento atribuível ao R3.

## 24. npm audit

Nenhuma dependência foi atualizada na R3. O último resultado documentado na R2.5 permanece: 7 findings no conjunto completo (6 high, 1 moderate) e 4 high sem dev dependencies, todos preexistentes na árvore Next/PostCSS/Sharp/Nanoid. Nenhum `npm audit fix` foi executado.

## 25. Advisors

Não executados após baseline porque nenhum DDL foi aplicado. Security e Performance Advisors devem rodar imediatamente depois da aplicação de F1/F2 e antes de aprovar o gate.

## 26. Riscos remanescentes

Bloqueadores:

- limite de uso do Codex recusou conector e link CLI antes da execução;
- Docker ausente impede reset local real;
- baseline ainda não foi executado por PostgreSQL;
- F1/F2, Auth, seed, RLS A×B, BOLA/IDOR integrado, site concorrente e Storage ainda não foram validados em staging;
- Advisors pós-DDL não foram executados.

Dívidas conscientes:

- bucket `artes` público temporariamente;
- tokens puros legados preservados apenas por compatibilidade;
- serialização do site default é forte no processo, mas idempotência cross-instance só poderá ser endurecida após validação da futura constraint `(company_id, type)`;
- lint global e audit preexistentes permanecem fora do escopo desta Recovery.

## 27. Rollback

Como não houve mutação remota, o rollback atual é somente reverter os commits/arquivos locais da branch. Quando staging for aplicado, o rollback autorizado será resetar ou recriar exclusivamente o staging descartável e reaplicar a linhagem `baseline -> Fase 1 -> Fase 2`.

Produção nunca deve ser target de rollback da Recovery.

## 28. Estado de produção

Project Ref de produção: `ozrasuktfthsvbqprtel`.

Produção foi explicitamente excluída do wrapper e não recebeu link, push, migration, config, seed, repair, reset ou escrita. A última introspecção read-only registrada antes do bloqueio manteve 86 tabelas públicas, 2 privadas, 11 views, 63 funções, 27 triggers, 143 policies públicas, 11 usuários Auth, 6 buckets e 37 objetos de Storage.

Como nenhuma operação remota foi aceita neste turno, o código desta Recovery não possui caminho causal para alterar produção.

## 29. Próximo gate

Quando o acesso externo estiver disponível:

1. vincular CLI somente a `hdlqlvqsugnacijcokrg`;
2. executar guardrail e dry-run;
3. aplicar as seis migrations uma a uma e validar cada fingerprint;
4. reemitir/aplicar F1 e depois F2 pelo CLI;
5. enviar Auth de staging;
6. criar somente seed/usuários sintéticos;
7. executar RLS A×B, IDOR/BOLA, site default, Storage, Advisors, testes e regressão;
8. confirmar novamente a ausência de mutação em produção;
9. somente então reconsiderar o gate.

Não iniciar Fase 5. Depois de um R3 aprovado, voltar à validação/conclusão da Fase 3 e então à Fase 4 real.

## Gate

**GATE STAGING BASELINE: BLOQUEADO**
