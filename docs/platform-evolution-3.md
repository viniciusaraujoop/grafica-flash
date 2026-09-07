# ORÇALY — PLATFORM EVOLUTION 3.0

## Status

**EM IMPLEMENTAÇÃO — NÃO APROVADO PARA PRODUÇÃO.**

Este documento acompanha evidências por milestone. A aprovação final só ocorre depois de regressão completa, Browser QA, Preview validado, migrations validadas e smoke pós-deploy.

## Baseline congelado — 2026-08-30

### Produção Vercel

- Project: `orcaly`
- Project ID: `prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O`
- Production deployment observado: `dpl_5JhRM22qN5rx4KUducukhZfuwchL`
- Commit promovido: `e835806976650ed1e8da162141d463cdecdd383b`
- Alias: `orcaly.com.br`
- Estado observado: READY
- Runtime errors agrupados nos últimos 7 dias no baseline: nenhum cluster retornado pela ferramenta de observabilidade da Vercel. Isso não é declaração de “zero bugs”.

### Git

Branch de trabalho: `feat/platform-evolution-3`

Base escolhida: `3c07159ac54928a8116c965093d58a0bd10fd0a7` (`feat/main-site-v2`).

Motivo: essa base contém a produção `e835806` e dois commits posteriores de validação interna de tarefas. `feat/orcaly-operations-experience-v2` já é ancestral dessa linha e, portanto, não deve ser reimplementada.

### Branches paralelas que não podem ser perdidas

| Branch | Head auditado | Relação com a base | Estratégia |
| --- | --- | --- | --- |
| `fix/auth-first-login-race` | `14566269...` | divergiu após `e835806` | incorporar seletivamente depois de revisão do fluxo de sessão |
| `fix/assistant-v2-runtime-and-conversation` | `141d02ae...` | divergiu após `e835806` | incorporar seletivamente; schema de analytics já está em produção |
| `feat/whatsapp-cloud-api-v1` | `f6ef1552...` | branch antiga, 204 commits atrás da linha principal | portar somente os 9 arquivos de domínio após revisão de segurança |
| `feat/orcaly-operations-experience-v2` | `955210e7...` | ancestral da base atual | já preservada; não duplicar |

## Stack observada

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript `5.x`
- `@supabase/supabase-js ^2.108.1`
- `@supabase/ssr 0.12.3`
- ESLint 9
- Tailwind 4
- Sem Jest/Vitest/Playwright como dependência permanente na base atual.
- Testes de regressão existentes são scripts invariantes Node + builds/QA dedicados.

## Supabase baseline

Projeto confirmado: `ozrasuktfthsvbqprtel` — `GRAFICA FLASH`, Postgres 17.

Não há branch Supabase de staging ativa. Por segurança, migrations novas desta evolução não são aplicadas diretamente em produção durante a implementação sem uma etapa explícita de validação.

### Drift identificado

Produção do banco contém migrations que ainda não correspondem ao deployment de aplicação em produção:

- `orcaly_assistant_v2_analytics` aplicado;
- `whatsapp_cloud_api_v1` aplicado.

Ao mesmo tempo, `platform_feature_flags` não existe no schema conectado, embora o código possua resolução opcional para a tabela. O Control Center já trata parte desse schema como aditivo/opcional.

Esse drift é classificado como **HIGH — Reliability/Operations**. A correção é alinhar código e schema por milestones, não executar migrations em massa.

## Contratos protegidos

Não modificar sem evidência e regressão específica:

- login/logout/session refresh/current company;
- signup e subscription gate;
- Mercado Pago, checkout, Pix, webhooks e billing;
- referral/partner attribution;
- storefront e public order/quote;
- logo/banner/artes e Storage tenancy.

## Milestone 1 — Foundation / Observability

### Objetivo

Consolidar a observabilidade existente sem criar um sistema paralelo.

### Descobertas

O projeto já possui:

- Control Center;
- `/admin/system-health`;
- security events;
- admin audit logs;
- scanner administrativo;
- feature flag resolver opcional;
- telemetria de pagamentos/WhatsApp/Assistente quando schema existe.

Faltava uma trilha específica para **APPLICATION ERROR** com correlação segura.

### Implementado

- `lib/observability/application-errors.ts`
  - `ORC-XXXXXXXXXX`;
  - request ID;
  - redaction de JWT, Bearer, private key, query secrets e chaves sensíveis de metadata;
  - log estruturado server-side;
  - persistência best-effort separada de audit/analytics;
  - nenhum segredo público.
- `supabase/migrations/20260830143000_platform_evolution_3_observability.sql`
  - aditiva;
  - RLS habilitada;
  - `anon` e `authenticated` sem acesso;
  - somente `service_role` com SELECT/INSERT;
  - sem `SECURITY DEFINER`, sem `USING (true)`, sem DROP/TRUNCATE.
- Health Center V3:
  - evidência real para Database, Mercado Pago, AI, WhatsApp e scanner;
  - `Unknown` quando não existe telemetria suficiente;
  - Application Errors separado;
  - migration pendente é exibida como pendente, não como falha falsa;
  - request ID e empty/error states.
- `app/error.tsx` e `app/global-error.tsx`:
  - UX recuperável;
  - código de correlação;
  - nenhum stack/raw message mostrado ao usuário.
- Gate automatizado `verify-platform-evolution-3-foundation.mjs`.
- Workflow `.github/workflows/platform-evolution-3.yml`.

### Migration

**Versionada, ainda não aplicada ao Supabase de produção neste milestone.**

O Health Center continua funcional e marca a telemetria de application errors como `Unknown / Migration pendente` até o schema existir.

## Próximos milestones obrigatórios

1. Segurança/RBAC/Auth baseline e integração seletiva do first-login fix.
2. Data safety / soft-delete / export/import conforme integridade real.
3. Design system e estados compartilhados sem reescrever componentes estáveis.
4. Navegação/discovery e busca global tenant-safe.
5. Central do Dia: revisar o que já existe e preencher gaps, sem duplicar.
6. Next Action + Customer 360 / CRM 3.0.
7. Automation Engine idempotente.
8. Assistente operacional autenticado, read-only primeiro.
9. Portal/notifications/PWA/uploads/onboarding/privacy/webhooks/API/integrations.
10. Admin/performance/QA completa.

## Production gate

Produção permanece bloqueada enquanto qualquer um destes pontos estiver pendente:

- migrations sem validação;
- auth regression;
- tenant/BOLA/RLS tests;
- billing/payment regression;
- browser/mobile/a11y QA;
- Preview READY e smoke funcional;
- diff e documentação final.

## Rollback

Deployment de produção congelado no baseline: `dpl_5JhRM22qN5rx4KUducukhZfuwchL`.

Uma promoção futura deve preservar esse deployment como candidato de rollback até o smoke pós-produção ser concluído.
