# Orçaly Wealth Tax Center — certificação V8

STATUS: CERTIFICADO em staging + Preview protegido. Produção não recebeu migration, função, índice ou deploy.

## Escopo certificado

Rota `/apps/wealth/impostos`. O Tax Center é um read model de fatos **declarados** do ledger Portfolio: impostos registrados, rendimentos, vendas, base removida declarada, resultado realizado declarado e documentos fiscais do Vault. Não calcula imposto devido, DARF, alíquota, isenção, compensação, filing, jurisdição ou aconselhamento fiscal. Estados explícitos: `tax_provider_status=NOT_CONFIGURED`, `tax_rules_status=NOT_CONFIGURED`, `jurisdiction_status=UNSPECIFIED`, `filing_status=NOT_CONFIGURED`.

A fonte financeira permanece `wealth_entries`; o Tax Center não cria segundo caixa. Portfolio Lab permanece fora dos fatos reais. Vendas com base/resultado ausentes permanecem incompletas, nunca são inferidas como zero.

## Banco

Staging `zwxulgpjucxudadjdqov`: 24 migrations. Última: `20260927013000_wealth_tax_center_foundation`. `public.wealth_tax_center(date,date,integer,uuid)` é STABLE, SECURITY INVOKER, EXECUTE para authenticated e negado para anon. Índice `wealth_portfolio_tax_dates` presente. Produção `ozrasuktfthsvbqprtel`, auditada somente leitura: 51 migrations, Tax migration ausente, função ausente e índice ausente.

Arquivo SQL local atual é o mesmo blob GitHub desde o commit pré-aplicação `e7122f0e969794a73d2819cd92fb7c6365874f42` (`74b318ad4ab72edebcc774bd313b68203bf34745`). SHA-256 LF do arquivo: `ee0ab55c216dfcd5e1ca6527b486263987bd853b5528f5b75e89da0c54a40870`.

Observação de reconciliação: o campo textual `supabase_migrations.schema_migrations.statements[1]` armazenou os dois delimitadores PL/pgSQL `$$` como `$`, resultando em 7018 caracteres e SHA LF `d54637e2e61904423d0cfad229789ca4db6d841904173e89c6bb15098093392e`, enquanto o arquivo correto possui 7020 caracteres. Isso é uma imperfeição do registro textual criado durante a aplicação manual, não edição posterior do arquivo nem diferença do objeto compilado. O ledger não foi reparado e a migration aplicada não foi editada. Qualquer correção futura de schema deverá usar migration nova.

Advisors pós-QA: 1 WARN de SECURITY DEFINER autenticado em `public.get_my_platform_admin_access()`; performance com 63 WARN `auth_rls_initplan`, 54 WARN `multiple_permissive_policies` e 1 INFO de FK sem índice. Nenhum deles é objeto Tax.

## Testes e CI

Domain/PostgreSQL Tax: **7 PASS / 0 FAIL**. Cobrem ledger imutável/sem segundo caixa, null de base/ganho, Lab/empty coverage, 366 dias/leap/timezone, owner/RLS/cross-user, entitlement em toda leitura, paginação e BigInt acima de Number seguro.

Runtime certificado: `d47ac1869dcfc22b93e122508153caf665d09cdf`.

- Orçaly Wealth Tax Hosted QA run `36319880597`: PASS.
- Orçaly Rolling V8 QA run `36319880582`: PASS; full build e `git diff --check` PASS.
- Orçaly Platform Quality Gate run `36319883451`: PASS; regressões, payments, security static/dependency, TypeScript e production build PASS.
- Tax scoped ESLint: 0 erros; 1 warning porque `scripts/e2e-wealth-tax-hosted.mjs` é ignorado pela configuração ESLint global.
- Main Site v2 QA continua com falha separada no `global-lint-baseline` (257 erros/148 warnings no repositório); não foi tratado como evidência Tax.

Build Next: compilação e TypeScript PASS. O build global mantém 3 warnings já visíveis no gate (2 `no-img-element` e 1 variável não usada), sem erro.

## Hosted E2E final

Deployment: `dpl_BscyaUKzc7ZrE3PZxwQSUjnBMQmv` READY/Preview.
URL exata: `https://orcaly-htbz9mjp2-vinicius-araujos-projects.vercel.app`.
O CI usa share temporário protegido mantido no Vault de staging; não abre Deployment Protection e não usa alias móvel para certificar SHA.

O endpoint `/api/internal/preview-build` retornou `environment=preview` e commit exato `d47ac1869dcfc22b93e122508153caf665d09cdf`.

Hosted matrix: **7 checks PASS / 0 falhas / 0 page errors**:
1. staging auth real por senha + JWT issuer;
2. fatos Tax exatos e ausência de segundo caixa;
3. RLS/owner/entitlement boundaries;
4. Preview protegido no commit exato e UI autenticada;
5. Lab + invalid window;
6. 320/390/768/1024/1440/1920, light/dark, Axe, teclado, reduced motion, filtro e sem overflow;
7. cross-user UI + redirect anônimo.

Artifact GitHub Actions: `wealth-tax-hosted-d47ac1869dcfc22b93e122508153caf665d09cdf`, ID `10932416353`, 13 arquivos, 4,520,447 bytes, ZIP SHA-256 `fa24f01a1718c0f4f6dcc77707bbd1ea30dbc269c4c94e47862a2058bcda9e1d`. Contém `report.json` + 12 screenshots (6 larguras × 2 temas). Final E2E: `2026-09-27T12:46:36.262Z`.

## Cleanup final

Depois do hosted QA: `auth.users=0`, `auth.sessions=0`, `storage.objects=0`; tabelas públicas Wealth verificadas=0; receipts privados Wealth=0; `ecosystem_audit_events=0`; `background_jobs=0`; `transactional_outbox=0`; `event_idempotency=0`; cron ativo=0.

## Conclusão

Tax Center CERTIFICADO. Próxima unidade obrigatória do roadmap: **Morning / Night**.
