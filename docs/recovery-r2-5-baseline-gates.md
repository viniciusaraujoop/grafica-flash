# RECOVERY R2.5 — RESOLUÇÃO DOS GATES

Data da auditoria: 16/08/2026  
Commit auditado: `cbaf755524d7b257d93d2955e19073f1d8b9b9fc`  
Branch observada: `fix/unify-payment-flows-phase-1`

## 1. Resumo executivo

Os seis gates técnicos da RECOVERY R2.5 foram resolvidos sem aplicar SQL, migrations, seed, usuários, buckets ou policies em qualquer ambiente remoto.

Decisões finais:

1. `create_default_site_for_company`: Estratégia A, com uma única abstração server-only; nenhum wrapper `SECURITY DEFINER` público será criado.
2. `artes`: permanecerá público temporariamente no baseline para compatibilidade, com hardening obrigatório e separado antes de arquivos do Portal.
3. migrations: nova linhagem linear `baseline -> Fase 1 -> Fase 2 -> futuras`; o baseline jamais será aplicado em produção.
4. CLI: Supabase CLI oficial `2.114.0` instalada localmente e fixada.
5. Auth: contrato mínimo de staging definido, sem usuários reais, SMTP real ou wildcard de redirect.
6. membros/RLS: um trigger canônico concorrente foi especificado e as 19 tabelas sem policy foram classificadas, sem casos indeterminados.

Foi ainda criado um wrapper local fail-closed para qualquer futuro `db push` da Recovery. A R3 não foi iniciada.

## 2. Estado dos ambientes

### Produção

Project Ref: `ozrasuktfthsvbqprtel`.

Produção foi acessada somente com `SELECT`, introspecção de catálogo, leitura do migration history e Security Advisor. Nenhuma RPC mutável foi chamada. Nenhuma instrução `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, `GRANT`, `REVOKE`, `repair`, `push`, `seed` ou equivalente foi executada.

O estado conhecido permaneceu em 86 tabelas de aplicação em `public`, 11 views, 45 funções `SECURITY DEFINER`, 33 migrations remotas, 11 usuários Auth, 10 empresas, 25 pedidos, 17 pagamentos e 37 objetos de Storage.

### Staging

Project Ref: `hdlqlvqsugnacijcokrg`.

Nova verificação somente leitura confirmou:

- 0 tabelas de aplicação em `public`;
- 0 views de aplicação;
- 0 funções de aplicação;
- 0 usuários Auth;
- 0 buckets;
- 0 objetos de Storage;
- nenhuma relation de migration history da aplicação e nenhuma migration listada.

O repositório também continua sem `supabase/.temp/project-ref`: nenhum projeto foi vinculado pela CLI. `.env.local` e Vercel não foram alterados.

## 3. Gate `create_default_site_for_company`

### Evidência

A implementação existente é `orcaly_private.create_default_site_for_company(uuid)`. Ela é `SECURITY DEFINER`, usa `search_path = ''` e concede execução apenas a `postgres` e `service_role`.

As duas chamadas encontradas usam, entretanto, `rpc('create_default_site_for_company')`, que resolve no schema exposto `public`:

- `app/api/admin/site/[id]/route.ts`;
- `app/api/leads/complete-account/route.ts`.

Ambas são Route Handlers server-side e usam cliente Supabase com service role. Não há chamada no browser. A função foi movida de `public` para `orcaly_private` pela migration `20260728182610_orcaly_security_definer_functions.sql`; por isso as chamadas atuais não alcançam a implementação privada pela Data API.

### Decisão Gate 1

**Estratégia A aprovada.** A correção futura será uma abstração server-only única, por exemplo `lib/site/create-default-site.server.ts`, importando `server-only` e recebendo apenas um cliente administrativo e `companyId` já derivado de um fluxo autorizado.

Contrato obrigatório da abstração:

- validar UUID e existência da empresa;
- nunca aceitar `company_id` como autoridade oriunda do browser;
- verificar se já existem seções;
- construir as seções a partir de configuração central, sem duplicar a lógica nas duas rotas;
- gravar as seções em um único batch;
- retornar `created | already_exists | company_not_found` em vez de esconder falhas;
- não registrar payloads sensíveis;
- possuir teste de repetição e de duas chamadas concorrentes.

Os arquivos futuros afetados serão a nova abstração e as duas Route Handlers acima. Nenhum acesso será concedido a `anon` ou `authenticated`.

Não haverá SQL para expor um wrapper público. A função privada poderá permanecer no baseline apenas como compatibilidade estrutural até a abstração ser validada; depois deverá ser marcada como legada ou removida por migration específica. A idempotência forte por `(company_id, type)` exigirá pré-validação de compatibilidade antes de uma futura constraint: a leitura de produção não encontrou grupos duplicados hoje, mas a constraint não será introduzida silenciosamente nesta Recovery.

Risco residual antes da correção de código: as duas chamadas atuais continuam apontando para uma RPC pública ausente. Isso é uma pendência explícita da R3 antes do teste funcional de criação de site, não uma razão para expor a função privada.

## 4. Gate Storage/`artes`

### Evidência

O bucket `artes` está público, com limite de 10 MiB, MIME types `image/jpeg`, `image/png`, `image/webp` e `application/pdf`, e contém dois objetos. Não existe policy de `storage.objects` específica para `artes`; downloads públicos, portanto, não passam por RLS.

`app/api/public/uploads/art/route.ts` é a única implementação de upload encontrada. Ela:

- exige mesma origem;
- aplica rate limit;
- valida tamanho, MIME type e magic bytes;
- deriva a empresa por slug ativo;
- cria path com primeiro segmento igual ao `company_id`;
- envia com service role;
- retorna `getPublicUrl()`.

Nenhum consumidor ativo da rota foi encontrado no código atual. `orders.arquivo_url` e `art_approval_requests.artwork_url/preview_url` são lidos por telas existentes, mas a consulta agregada de produção encontrou zero linhas apontando para URL pública do bucket `artes`. Isso não autoriza excluir os dois objetos.

### Decisão Gate 2

O baseline de staging reproduzirá `artes` como público **temporariamente**, sem policy de escrita para `anon` ou `authenticated`. Upload continuará backend-only. Essa escolha preserva compatibilidade e não pretende declarar o desenho seguro para o Portal.

Fica criada a pendência obrigatória **STORAGE HARDENING — ARTES**:

1. inventariar e classificar os objetos existentes sem expor conteúdo;
2. criar vínculo persistente `company_id + entity_type + entity_id + object_path`;
3. migrar para bucket privado ou novo bucket privado de forma reversível;
4. gerar signed URLs curtas somente no servidor;
5. autorizar pelo vínculo, nunca por path vindo do browser;
6. validar acesso cruzado entre empresas e entidades;
7. só então habilitar arquivos no Portal.

As recomendações seguem o modelo oficial de [controle de acesso do Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control).

## 5. Gate migration lineage

### Decisão Gate 3

A nova linha aprovada é:

```text
baseline novo e revisado
    -> Fase 1 reemitida com timestamp novo
    -> Fase 2 reemitida com timestamp novo
    -> migrations futuras lineares
```

Regras:

- o baseline destina-se exclusivamente a um banco vazio, inicialmente staging;
- as 33 migrations registradas em produção não serão copiadas para o history do staging;
- os arquivos históricos atuais não serão executados antes do baseline;
- na R3, eles serão preservados em `supabase/migrations_legacy/`, com índice, motivo, checksums e mapeamento remoto/local;
- os novos arquivos serão criados exclusivamente com `npx --no-install supabase migration new <nome>`;
- as migrations originais de Fase 1 e Fase 2 serão preservadas no acervo e reemitidas com timestamps novos após revisão;
- nenhum `migration repair` será usado para fazer o staging parecer migrado;
- o baseline nunca será aplicado em `ozrasuktfthsvbqprtel`;
- uma futura reconciliação de produção terá migration e aprovação próprias; não reutilizará o baseline.

A documentação oficial confirma o fluxo versionado e a criação de arquivos por CLI em [Local development](https://supabase.com/docs/guides/local-development) e [CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows).

## 6. Gate Supabase CLI

### Decisão Gate 4

Método: pacote npm oficial como `devDependency`, fixado sem range.

```text
supabase: 2.114.0
acesso: npx --no-install supabase ...
```

A versão foi escolhida após consultar o dist-tag `latest` do registro npm em 16/08/2026; `beta` não foi usada. O lockfile adicionou somente os nós da CLI e suas dependências/plataformas opcionais; nenhuma versão já existente no lockfile mudou.

Checks executados com sucesso:

```text
npx --no-install supabase --version
npx --no-install supabase --help
npx --no-install supabase db --help
npx --no-install supabase migration --help
```

Resultado de versão: `2.114.0`. Nenhum `link`, `db push`, `migration repair`, `migration up`, `seed`, `reset`, `pull` ou `dump` foi executado.

Nota operacional: a CLI grava telemetria local em `%USERPROFILE%/.supabase`; foi necessário permitir essa escrita para os comandos de ajuda. Isso não vinculou nem alterou projetos.

## 7. Gate Auth

### Fluxos atuais

- login por email/senha;
- criação de conta principal, founder, afiliado e equipe via `auth.admin.createUser()` server-side;
- atualização de senha em fluxos autenticados/admin;
- nenhuma chamada ativa a `signUp`, OAuth, `resetPasswordForEmail`, OTP ou login anônimo;
- founder/equipe usam tokens próprios do domínio, não redirects OAuth do Supabase.

### Decisão Gate 5

Configuração proposta para staging:

| Item | Contrato |
|---|---|
| Email/password | habilitado para login |
| Signup público | desabilitado; criação permanece server-side/admin |
| Email confirmation | habilitada como default seguro, embora usuários de teste sejam criados e confirmados pelo admin |
| Anonymous sign-in | desabilitado |
| OAuth providers | nenhum enquanto não houver fluxo real |
| JWT access token | 3600 segundos |
| Refresh rotation | habilitada, reuse interval de 10 segundos |
| Senha mínima | 8 caracteres |
| Classes obrigatórias | não exigir ainda; os validadores atuais não são uniformes |
| Site URL local | `http://localhost:3000` |
| Redirects locais | somente `http://localhost:3000/**` e `http://127.0.0.1:3000/**` durante desenvolvimento |
| Preview/staging | adicionar apenas a URL HTTPS exata depois de provisionada; não usar `*.vercel.app` amplo |
| SMTP | não configurar SMTP real nesta etapa |
| Templates | defaults sem dados reais; customização somente quando SMTP/teste de email forem aprovados |
| Usuários | somente identidades sintéticas na R3 |

Existe uma incompatibilidade de código conhecida: `app/api/company/team/route.ts` ainda aceita senha inicial com seis caracteres. Antes do teste Auth da R3, esse contrato deve ser alinhado para oito caracteres no endpoint e na UI. Até lá, nenhuma configuração deve baixar o mínimo do staging para acomodar o legado.

Leaked Password Protection não pode ser habilitado no staging Free: a documentação atual informa disponibilidade a partir do plano Pro. Os testes usarão senhas únicas geradas, nunca senhas conhecidas. Referências oficiais: [Password security](https://supabase.com/docs/guides/auth/password-security) e [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Como não existe recuperação de senha ativa e SMTP real não será copiado, os testes iniciais não incluirão entrega de email. Essa diferença em relação a um ambiente produtivo é intencional e documentada.

## 8. Gate member limit

### Evidência

Produção possui dois triggers de limite sobre `company_members`:

- `trg_company_member_limit` -> `orcaly_private.check_company_member_limit()`;
- `trg_limit_company_members` -> `public.limit_company_members()`.

Ambos contam membros ativos e limitam em dois, mas executam a mesma regra duas vezes, retornam mensagens diferentes e não serializam inserções concorrentes. Há ainda `trg_company_member_touch`, responsável apenas por `updated_at`.

O código da equipe, a UI e o histórico comercial consultado usam o mesmo contrato: dois registros ativos em `company_members`, sem diferença por plano. `owner_id` e `tester_id` estão em `companies`, portanto não entram nessa contagem.

### Decisão Gate 6A

Nenhuma das duas funções antigas será canônica. O baseline terá uma função consolidada privada e um único trigger, conceitualmente:

```text
trg_company_members_before_write
  -> orcaly_private.enforce_company_member_contract()
```

Regra exata:

- máximo de 2 `company_members.status = 'ativo'` por empresa, em todos os planos atuais;
- owner/tester não contam;
- INSERT ativo, reativação e troca de `company_id` são validados;
- o próprio registro é excluído por `id IS DISTINCT FROM NEW.id`;
- email é normalizado para lowercase e `updated_at` é atualizado no mesmo contrato;
- inserções concorrentes da mesma empresa são serializadas com `pg_advisory_xact_lock` derivado de `company_id`;
- em troca de empresa, os dois locks são obtidos em ordem determinística para evitar deadlock;
- função `SECURITY DEFINER`, `search_path = ''`, objetos totalmente qualificados e sem `EXECUTE` para `PUBLIC`, `anon` ou `authenticated`;
- mensagem única: `Limite de 2 funcionários ativos atingido para esta empresa.`

Os dois triggers de limite antigos e o trigger de touch separado não entram no baseline. Uma futura diferenciação por plano exigirá uma fonte de limites versionada; não será inventada agora.

## 9. Gate backend-only tables

Todas as 19 tabelas têm RLS habilitado e zero policies. A busca em todo `app/` e `lib/` encontrou consumidores apenas em Route Handlers ou módulos `server-only` que usam service role. Não existe consumidor direto autenticado no browser. Assim, nenhuma tabela é classe B e nenhuma ficou classe E.

Contrato comum para classes A, C e D no baseline:

```text
RLS enabled
zero client policies
REVOKE ALL FROM anon, authenticated
grants mínimos e explícitos para service_role
autorização feita no backend antes da query
```

| Table | Class | Consumidores | Acesso esperado/RLS | Ação no baseline |
|---|---|---|---|---|
| `app_notifications` | A | `/api/notifications`, `orcaly-audit` | backend tenant-scoped | service `SELECT/INSERT/UPDATE`; sem client policy |
| `crm_leads` | A | `/api/crm/leads*`, smart notifications | backend tenant-scoped | service `SELECT/INSERT/UPDATE`; adicionar FKs seguras quando aplicável |
| `customer_portal_events` | A | `/api/cliente/[token]` legado | escrita analítica backend | service `INSERT`; sem leitura client |
| `internal_tasks` | A | `/api/tasks*`, `/api/orders/[id]/create-task` | backend tenant-scoped | service `SELECT/INSERT/UPDATE` + validação cruzada obrigatória |
| `marketplace_commission_rules` | C | platform-admin, cálculo de comissão | administração controlada | service `SELECT/INSERT/UPDATE`; `requirePlatformAdmin` para gestão |
| `marketplace_commissions` | C | webhook/checkout e platform-admin | escrita financeira backend, leitura admin | service `SELECT/INSERT/UPDATE`; sem client policy |
| `marketplace_coupons` | A | `/api/coupons*`, validação pública sanitizada, checkout | backend tenant-scoped | service `SELECT/INSERT/UPDATE`; rota pública nunca recebe linha crua |
| `marketplace_oauth_states` | A | connect/callback Mercado Pago | segredo efêmero backend | service `SELECT/INSERT/UPDATE`; expiração/consumo obrigatórios |
| `marketplace_payment_settings` | A | rotas e libs de pagamentos | segredo financeiro backend | service `SELECT/INSERT/UPDATE`; DTOs sanitizados |
| `marketplace_payments` | A | checkout, webhooks, vendas, admin | domínio financeiro backend | service `SELECT/INSERT/UPDATE`; payload/provider nunca ao cliente |
| `marketplace_stock_reservations` | A | checkout/RPCs de estoque | backend transacional | apenas privilégios exigidos pelas rotinas de estoque |
| `order_internal_comments` | A | `/api/orders/[id]/comments` | backend tenant-scoped e interno | service `SELECT/INSERT`; sem acesso do portal |
| `order_status_history` | A | order/timeline e portal legado | backend; DTO público filtrado separadamente | service `SELECT/INSERT`; sem update/delete |
| `platform_admins` | C | auth/admin/founder/prospecção | administração da plataforma | service `SELECT/INSERT/UPDATE`; acesso próprio só pela RPC revisada |
| `product_stock_movements` | A | RPCs de estoque | ledger backend append-only | service/rotina `SELECT/INSERT`; sem update/delete |
| `site_template_presets` | D | nenhum consumidor ativo | legado preservado, fechado | manter tabela; sem grants client; nenhum grant até haver consumidor |
| `smart_notification_events` | A | smart notifications | deduplicação backend | service `SELECT/INSERT/UPDATE` |
| `smart_notification_settings` | A | `/api/notifications/smart-settings`, lib | backend tenant-scoped | service `SELECT/INSERT/UPDATE` |
| `system_audit_logs` | A | `/api/audit/logs`, `orcaly-audit` | insert backend; leitura autorizada | service `SELECT/INSERT`; sem update/delete |

### `internal_tasks`

O risco indicado na R2 foi confirmado. `responsavel_id`, `crm_lead_id`, `order_id` e `proposal_id` vêm do payload; a Route Handler deriva `company_id`, mas não prova que esses vínculos pertencem à mesma empresa. Como service role ignora RLS e a tabela não possui essas FKs, uma policy não resolveria o problema.

A R3 deve implementar defesa em duas camadas:

1. a API valida responsável como owner, tester ou membro ativo da própria empresa e valida cada entidade vinculada pelo mesmo `company_id`;
2. o baseline adiciona trigger privado de integridade tenant-safe para rejeitar qualquer vínculo cruzado, inclusive quando outra rotina backend gravar diretamente.

O [Security Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) continuará podendo emitir INFO para tabelas backend-only. Isso é aceito e documentado; policies permissivas não serão criadas para silenciar o aviso.

## 10. `SECURITY DEFINER` review

Foram reconfirmadas 45 funções `SECURITY DEFINER`: 34 em `public` e 11 em `orcaly_private`. Todas possuem `search_path` explícito; isso não substitui a revisão de autorização.

- Membership: helpers privados usam `auth.uid()`, vínculo de empresa e ACL explícita. Permanecem privados; o trigger canônico remove o grant `authenticated` desnecessário da função de limite.
- Criação de site: permanece privada; nenhum wrapper público será criado.
- Administração: `public.get_my_platform_admin_access()` foi revisada. Ela filtra estritamente `p.user_id = auth.uid()`, exige `is_active`, restringe roles, retorna no máximo o próprio registro e não permite enumerar outros admins. O grant `authenticated` é intencional; o WARN do advisor é aceito com teste de não enumeração. Como não há consumidor ativo localizado, a R3 deve confirmar a necessidade antes de incluí-la.
- Pagamentos: funções de mutação e claims observadas concedem execução apenas a `service_role`. A função legada `claim_company_subscription_trial` usa `search_path = public`; no baseline deverá usar caminho vazio/objetos qualificados sem alterar a regra funcional.
- Afiliados: funções administrativas de payout/review são service-role-only, com paths explícitos. Devem manter autorização no backend antes da RPC.
- Storage: helpers de autorização permanecem privados e validam que o primeiro segmento do path corresponde à empresa acessível.
- Views públicas: funções privadas de dados públicos podem ser executadas pelos papéis necessários, mas o schema privado não será exposto diretamente; o contrato público continua nas views sanitizadas.

Na R3, cada função só entra no baseline depois de registrar necessidade de `DEFINER`, caller, ACL e validação de tenant. O default será `SECURITY INVOKER`.

## 11. Grants

Foram reconfirmados grants `anon` excessivos (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`) em nove tabelas:

- `affiliate_achievements`;
- `affiliate_activity_events`;
- `affiliate_announcements`;
- `affiliate_certifications`;
- `affiliate_course_progress`;
- `affiliate_goals`;
- `affiliate_leads`;
- `affiliate_tasks`;
- `affiliate_training_sessions`.

Todos os consumidores localizados estão em `lib/affiliates/workspace.ts`, que declara `server-only` e opera com cliente administrativo. Nenhuma rota pública legítima depende de acesso direto `anon`.

Decisão: o baseline executará `REVOKE ALL ... FROM anon` nessas nove tabelas e concederá apenas privilégios mínimos ao `service_role`. Views públicas sanitizadas (`public_*`) conservam somente `SELECT` para `anon` quando necessário.

O mesmo princípio será aplicado às 19 tabelas da seção anterior: grant e RLS são controles independentes. O baseline terá grants explícitos porque o comportamento atual da Data API para novos projetos exige exposição intencional; referência: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## 12. Tokens legados

A introspecção confirmou campos legados de token puro em `orders.customer_portal_token`, `customer_magic_links.token`, `proposals.token` e `art_approval_requests.token`. Há ainda credenciais de integração em `companies.whatsapp_*` e `marketplace_payment_settings.access_token/refresh_token`; estas últimas são tratadas por proteção de aplicação, mas continuam backend-only.

Decisão: criar a pendência **LEGACY TOKEN HARDENING**. O baseline preservará colunas necessárias à compatibilidade, mas nenhum código novo poderá gravar token público em texto puro. Fases 1–2 continuam usando `token_hash`, expiração e revogação.

A correção de legado exigirá inventário, geração de hashes/rotação e transição de leitura em produção; não será simulada dentro do baseline vazio. Nenhum valor foi lido ou copiado. A busca de logs não encontrou `console.log/error/warn` que imprima explicitamente token, secret ou service-role key, mas a revisão deve continuar em cada novo fluxo de provider.

## 13. Guardrail

O guardrail foi implementado em `scripts/run-recovery-supabase.mjs` e exposto por:

```text
npm run recovery:assert-staging
npm run recovery:db:push -- --dry-run
npm run recovery:db:push
```

Contrato:

1. exige `ORCALY_RECOVERY_TARGET=staging`;
2. lê o Project Ref realmente vinculado em `supabase/.temp/project-ref`;
3. aceita somente `hdlqlvqsugnacijcokrg`;
4. rejeita explicitamente `ozrasuktfthsvbqprtel`;
5. rejeita ref ausente, malformado ou diferente;
6. mostra somente o Project Ref de destino, nunca secrets;
7. executa a CLI fixada em `node_modules`;
8. permite somente `db push` ou `db push --dry-run`;
9. não aceita `--db-url`, `--project-ref` ou qualquer outro argumento que possa trocar o destino.

Os testes fail-closed passaram: sem a variável, o processo aborta; com a variável e sem projeto vinculado, também aborta. O caminho positivo será testado somente após a autorização da R3 e o vínculo explícito ao staging.

## 14. Alterações locais realizadas

- `package.json`: CLI fixada e scripts do guardrail;
- `package-lock.json`: lock da CLI `2.114.0` e dependências oficiais;
- `scripts/run-recovery-supabase.mjs`: wrapper fail-closed;
- `docs/recovery-r2-5-baseline-gates.md`: este relatório.

Não houve alteração de funcionalidade de negócio, migrations SQL, `.env.local`, configuração Vercel ou arquivos das Fases 1–2.

## 15. Testes/comandos executados

### Supabase remoto — somente leitura

- introspecção de tabelas, colunas, constraints, indexes, triggers, functions, ACLs, RLS, policies, buckets e contagens agregadas;
- migration list de produção e staging;
- Security Advisor de produção e staging;
- nenhuma chamada mutável.

### CLI/local

- `npx --no-install supabase --version`: passou, `2.114.0`;
- `npx --no-install supabase --help`: passou;
- `npx --no-install supabase db --help`: passou;
- `npx --no-install supabase migration --help`: passou;
- `node --check scripts/run-recovery-supabase.mjs`: passou;
- guardrail sem variável: abortou como esperado;
- guardrail com target e sem link: abortou como esperado;
- comparação do lockfile: nenhuma dependência preexistente mudou de versão.

`npm audit` foi executado sem correção automática. O resultado atual é 7 findings no conjunto completo (6 high, 1 moderate) e 4 high quando dev dependencies são omitidas. Eles estão na árvore já existente de Next/PostCSS/Sharp/Nanoid; a CLI adicionada não aparece como origem. Nenhum `npm audit fix` foi executado.

- `npm test`: passou, 29/29 testes (13 de foundation e 16 de customer portal);
- `npm run build`: passou, incluindo compilação, TypeScript e geração de 213 páginas;
- `npm run lint`: falhou no passivo preexistente, com 537 ocorrências (394 erros e 143 avisos). O lint global inclui múltiplos diretórios de backup e também aponta erros no código ativo. Nenhuma ocorrência reportada foi no novo guardrail;
- `npx --no-install eslint --no-ignore scripts/run-recovery-supabase.mjs`: passou sem erros ou avisos, distinguindo a mudança desta Recovery do passivo global.

## 16. Riscos remanescentes

1. As duas chamadas de `create_default_site_for_company` permanecem quebradas até a abstração server-only ser implementada.
2. `artes` continua público em produção e ficará temporariamente público no baseline.
3. Triggers duplicados de membros continuam em produção; esta Recovery somente definiu o canônico do baseline.
4. As 19 tabelas continuam com grants atuais em produção; revogações foram decididas apenas para o baseline.
5. `internal_tasks` aceita referências cruzadas no backend atual; a validação de API e o trigger de integridade são obrigatórios na R3.
6. Tokens legados em texto puro exigem uma migração de dados separada em produção.
7. O staging Free não oferece Leaked Password Protection e não terá SMTP real.
8. O endpoint de equipe ainda aceita seis caracteres, incompatível com o mínimo de oito definido para staging.
9. `.env.local` ainda aponta para produção. Até o staging estar funcional, testes locais com escrita continuam proibidos.
10. O guardrail ainda não teve caminho positivo porque nenhum projeto está vinculado; falhar nesse estado é intencional.
11. `npm audit` aponta vulnerabilidades high na versão atual `next@16.2.9` e dependências; o relatório indica correção disponível em `16.3.1`. O upgrade precisa de tarefa própria, leitura dos guias locais de Next.js e regressão completa antes de qualquer próximo deploy.
12. Recomendações de performance `auth_rls_initplan` e `multiple_permissive_policies` ficam para hardening posterior; não serão misturadas ao baseline sem teste funcional.

Esses riscos não tornam ambígua a construção do baseline no staging, mas bloqueiam promoção/deploy das partes afetadas até suas verificações específicas.

## 17. Plano exato da R3

Somente após autorização separada:

1. criar branch `codex/recovery-r3-baseline-staging` e confirmar worktree;
2. confirmar novamente os dois Project Refs e que produção permanece read-only;
3. vincular a CLI explicitamente a `hdlqlvqsugnacijcokrg`, nunca a produção;
4. definir `ORCALY_RECOVERY_TARGET=staging` e obter sucesso em `recovery:assert-staging`;
5. mover o histórico local para `supabase/migrations_legacy/` com índice, checksums e mapa das 33 migrations remotas, sem apagar nada;
6. gerar com `supabase migration new` os arquivos de baseline para extensions/types, schema, functions/triggers/views, RLS/grants e Storage;
7. construir paridade estrutural segura: 86 tabelas públicas antes das Fases 1–2, sem dados reais e sem secrets;
8. implementar no baseline as decisões desta R2.5: grants mínimos, trigger canônico de membros, integridade de `internal_tasks`, bucket `artes` temporário e revisão de `SECURITY DEFINER`;
9. implementar a abstração server-only de site e alinhar senha de equipe para oito caracteres antes dos testes correspondentes;
10. revisar o SQL gerado linha a linha; não commitar dump bruto;
11. validar localmente com reset de stack local, lint SQL, testes de schema e advisors;
12. executar `recovery:db:push -- --dry-run` e revisar o destino exibido;
13. somente então executar `recovery:db:push` contra staging;
14. confirmar baseline com 86 tabelas públicas, views, functions, triggers, constraints, indexes, RLS e grants previstos;
15. configurar Auth de staging conforme a seção 7, sem usuários reais ou SMTP real;
16. reemitir Fase 1 com timestamp oficial, aplicar só em staging e validar as quatro tabelas novas;
17. reemitir Fase 2 com timestamp oficial, aplicar só em staging e validar `customer_portal_access`, tokens hash e isolamento;
18. confirmar o total esperado de 91 tabelas públicas após Fases 1–2;
19. criar seed totalmente sintético com Empresa A, Empresa B e Gráfica Piloto;
20. testar owner, membro ativo/inativo, RLS, IDOR, criação de site, `internal_tasks`, Storage, pedidos, propostas, Portal e pagamentos sem provider real;
21. executar Security/Performance Advisors e registrar exceções backend-only intencionais;
22. rodar testes, lint, TypeScript, build e regressão de rotas;
23. confirmar mais uma vez que produção, Vercel Production e dados reais não sofreram alterações;
24. entregar relatório R3 e parar antes de qualquer promoção.

GATE R3: APROVADO
