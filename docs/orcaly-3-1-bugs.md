# ORÇALY 3.1 — Bug Ledger

## ORC31-001 — Public AI Gateway authentication failure
- **Sintoma:** `/api/public/home-chat` registrou `AI Gateway 401 Authentication failed` para `openai/gpt-5.6-luna` e `openai/gpt-5.4` em execução recente.
- **Impacto:** assistente retorna resposta guiada em vez de resposta do provider; saúde da IA fica mascarada por HTTP 200.
- **Causa raiz:** em investigação. O código usa o padrão documentado `AI_GATEWAY_API_KEY || VERCEL_OIDC_TOKEN`, portanto é necessário reproduzir no deployment atual e separar configuração de credencial de comportamento de código.
- **Arquivo/região:** `app/api/public/home-chat/route.ts`, `requestModel()` / `generateAnswer()`.
- **Correção:** pendente de reprodução no deployment atual. Não hardcodar segredo.
- **Teste criado:** smoke HTTP da IA 3.1.
- **Status:** INVESTIGATING.
- **Deploy validado:** pendente.

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
- **Teste criado:** pendente BOLA/RPC negative test.
- **Status:** REVIEWED_NOT_YET_A_B_TESTED.
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
- **Sintoma:** duas FKs do Control Center não têm índice de cobertura.
- **Impacto:** joins/deletes/updates relacionados podem degradar com crescimento.
- **Causa raiz:** índices não foram criados junto das FKs.
- **Arquivo/região:** `platform_support_ticket_events.admin_id`, `platform_support_tickets.assignee_admin_id`.
- **Correção:** confirmar workload e criar índices aditivos se justificados.
- **Teste criado:** advisor before/after.
- **Status:** OPEN.
- **Deploy validado:** pendente.

## ORC31-007 — Duplicate index on plan_payments
- **Sintoma:** advisor confirma índices idênticos `idx_plan_payments_admin_company_created` e `plan_payments_company_created_idx`.
- **Impacto:** write amplification e armazenamento redundante.
- **Causa raiz:** migrations históricas criaram índices equivalentes.
- **Arquivo/região:** `public.plan_payments`.
- **Correção:** comparar definições/constraints e remover somente a duplicata comprovadamente redundante em migration versionada.
- **Teste criado:** advisor before/after e inspeção de catálogo.
- **Status:** OPEN.
- **Deploy validado:** pendente.
