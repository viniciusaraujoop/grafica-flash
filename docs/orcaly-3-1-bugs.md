# ORÇALY 3.1 — Bug Ledger

## ORC31-001 — Public AI Gateway authentication failure
- **Sintoma:** `/api/public/home-chat` responde HTTP 200, mas o smoke da produção atual recebeu `source: guided`; os logs do mesmo request registraram `AI Gateway 401 Authentication failed` para `openai/gpt-5.6-luna` e `openai/gpt-5.4`.
- **Impacto:** assistente cai para resposta guiada em vez de usar o provider; HTTP 200 sozinho mascara a indisponibilidade da IA.
- **Causa raiz:** autenticação do AI Gateway inválida/ausente no ambiente de produção atual. O código usa o padrão documentado `AI_GATEWAY_API_KEY || VERCEL_OIDC_TOKEN`; a superfície conectada da Vercel nesta execução não permite criar/alterar a credencial de ambiente.
- **Arquivo/região:** `app/api/public/home-chat/route.ts`, `requestModel()` / `generateAnswer()` e configuração Vercel AI Gateway.
- **Correção:** provider bloqueado por configuração externa. Em código, endurecer para não tentar outro modelo com a mesma autenticação rejeitada, adicionar circuit breaker/observabilidade e preservar fallback canônico sem fingir saúde do provider. Nunca hardcodar segredo.
- **Teste criado:** `scripts/orcaly-3-1-ai-smoke.mjs` + workflow `Orçaly 3.1 AI Smoke`.
- **Evidência:** run `34129868443`, job `101767140678`: `status=200`, `source=guided`, `AI_PROVIDER_NOT_USED`; runtime do deployment baseline registrou os dois 401.
- **Status:** BLOCKED_EXTERNAL_CREDENTIAL + CODE_HARDENING_IN_PROGRESS.
- **Deploy validado:** produção baseline `dpl_Bj4QUZDXASduCK3PyNN3KqqDPAHk` reproduziu o defeito.

## ORC31-002 — Leaked Password Protection disabled
- **Sintoma:** Supabase Security Advisor reporta `auth_leaked_password_protection`.
- **Impacto:** senhas conhecidas como comprometidas não são bloqueadas pelo recurso do Supabase Auth.
- **Causa raiz:** configuração do Auth desabilitada.
- **Arquivo/região:** control plane Supabase, não é bug de arquivo da aplicação.
- **Correção:** validar disponibilidade/configuração e habilitar somente pelo mecanismo oficial.
- **Teste criado:** advisor baseline/final.
- **Status:** EXTERNAL_CONFIGURATION_REVIEW.
- **Deploy validado:** não aplicável.

## ORC31-003 — SECURITY DEFINER advisor on platform-admin access RPC
- **Sintoma:** advisor alerta que `authenticated` pode executar `public.get_my_platform_admin_access()`.
- **Impacto:** boundary privilegiado exige prova negativa contra escalada de privilégio.
- **Causa raiz:** desenho intencional de RPC SECURITY DEFINER para ler somente o acesso administrativo do próprio `auth.uid()`.
- **Arquivo/região:** função PostgreSQL `public.get_my_platform_admin_access()`.
- **Correção:** nenhuma alteração até teste negativo. Live review confirmou `PUBLIC=false`, `anon=false`, `authenticated=true`, `search_path=pg_catalog, public` e filtro `p.user_id = auth.uid()`.
- **Teste criado:** BOLA/RPC negative test em execução.
- **Status:** REVIEWED_NOT_YET_NEGATIVE_TESTED.
- **Deploy validado:** produção atual.

## ORC31-004 — RLS auth functions re-evaluated per row
- **Sintoma:** Performance Advisor reporta múltiplos `auth_rls_initplan` warnings.
- **Impacto:** custo por linha e degradação em escala.
- **Causa raiz:** policies históricas usam `auth.uid()`, `auth.jwt()` e equivalentes diretamente em expressões por row.
- **Arquivo/região:** policies de `companies`, `company_members`, `products`, `orders`, `order_items`, `proposals`, finance, production, notifications, WhatsApp e outras.
- **Correção:** tabela por tabela, somente após equivalência e A/B tenancy tests.
- **Teste criado:** pendente suite RLS A/B.
- **Status:** OPEN.
- **Deploy validado:** pendente.

## ORC31-005 — Multiple permissive RLS policies
- **Sintoma:** Performance Advisor reporta policies permissivas concorrentes em tabelas críticas.
- **Impacto:** maior custo e autorização difícil de raciocinar; algumas policies têm semântica mais ampla que outras.
- **Causa raiz:** evolução incremental de políticas sem consolidação equivalente.
- **Arquivo/região:** `companies`, `company_members`, `orders`, `order_items`, `products`, `proposals`, `finance_accounts`, `financial_transactions`, `production_orders`, `site_sections` e tabelas admin.
- **Correção:** mapear semântica e consolidar somente com testes de equivalência/cross-tenant.
- **Teste criado:** pendente.
- **Status:** OPEN.
- **Deploy validado:** pendente.

## ORC31-006 — Support foreign keys without covering indexes
- **Sintoma:** duas FKs do Control Center não tinham índice de cobertura.
- **Impacto:** joins/deletes/updates relacionados poderiam degradar com crescimento.
- **Causa raiz:** índices não foram criados junto das FKs.
- **Arquivo/região:** `platform_support_ticket_events.admin_id`, `platform_support_tickets.assignee_admin_id`.
- **Correção:** migration `orcaly_3_1_db_hardening_batch_1` adicionou índices dedicados. As tabelas estavam vazias no momento da mudança.
- **Teste criado:** Performance Advisor before/after.
- **Status:** FIXED_AND_VERIFIED.
- **Deploy validado:** banco de produção; aviso `unindexed_foreign_keys` desapareceu no advisor pós-migration.

## ORC31-007 — Duplicate index on plan_payments
- **Sintoma:** advisor confirmou índices idênticos `idx_plan_payments_admin_company_created` e `plan_payments_company_created_idx`.
- **Impacto:** write amplification e armazenamento redundante.
- **Causa raiz:** migrations históricas criaram índices equivalentes.
- **Arquivo/região:** `public.plan_payments`.
- **Correção:** catálogo provou ambos como btree não-unique `(company_id, created_at DESC)`, sem constraint associada. A migration removeu somente `idx_plan_payments_admin_company_created` e preservou `plan_payments_company_created_idx`.
- **Teste criado:** inspeção de catálogo + Performance Advisor before/after.
- **Status:** FIXED_AND_VERIFIED.
- **Deploy validado:** banco de produção; aviso `duplicate_index` desapareceu no advisor pós-migration.
