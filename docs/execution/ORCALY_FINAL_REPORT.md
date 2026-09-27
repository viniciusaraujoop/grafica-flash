# Relatório V8 — Tax Center certificado

STATUS: Tax Center CERTIFICADO em staging e Preview. Próxima unidade: Morning / Night. O Master completo permanece em andamento.

Runtime certificado: `d47ac1869dcfc22b93e122508153caf665d09cdf`.
Deployment Preview: `dpl_BscyaUKzc7ZrE3PZxwQSUjnBMQmv`.
URL: `https://orcaly-htbz9mjp2-vinicius-araujos-projects.vercel.app`.

Tax organiza fatos fiscais declarados do Portfolio/Vault. Não calcula imposto devido, DARF, alíquota, filing ou jurisdição e não cria segundo caixa.

Certificação:
- 7 testes Tax domain/PostgreSQL PASS;
- 7 checks hosted PASS;
- exact Preview SHA confirmado;
- staging auth real;
- RLS, owner, cross-user e entitlements exercitados;
- Lab e invalid window exercitados;
- 320/390/768/1024/1440/1920;
- light/dark, Axe, teclado/foco, reduced motion e sem overflow;
- 12 screenshots;
- artifact GitHub Actions `10932416353`, digest `fa24f01a1718c0f4f6dcc77707bbd1ea30dbc269c4c94e47862a2058bcda9e1d`;
- Rolling V8 PASS;
- Platform Quality Gate PASS;
- build e TypeScript PASS.

Cleanup final: auth users/sessions, Storage, fontes Wealth, receipts, audit, jobs, outbox, idempotency e cron ativo ficaram em zero.

Staging: 24 migrations, incluindo `20260927013000_wealth_tax_center_foundation`. Produção foi consultada somente leitura e não contém migration, função ou índice Tax.

Reconciliação: o arquivo Tax permanece o mesmo blob desde a correção pré-aplicação `e7122f0`. O texto armazenado em `schema_migrations.statements[1]` difere em dois caracteres nos delimitadores PL/pgSQL; o ledger não foi reparado e a migration aplicada não foi editada.

O Main Site global-lint-baseline permanece um gate global separado. Advisors herdados, Auth/MFA, acessibilidade humana, performance/observability, integrações e demais produtos continuam abertos.

Evidências: `docs/qa/ORCALY_WEALTH_TAX.md`, `ORCALY_WEALTH_TAX_VERCEL_E2E.json`, `ORCALY_WEALTH_TAX_BUILD.json`, `ORCALY_WEALTH_TAX_DEPLOYMENT.json`.
