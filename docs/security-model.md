# ORÇALY — SECURITY MODEL

## Princípios

1. **Tenant boundary é autorização.** `company_id` vindo do cliente nunca é suficiente por si só.
2. **UI não autoriza.** Menus e feature flags controlam descoberta; APIs e Server Actions validam identidade, company e capability.
3. **Service role é server-only.** Nunca é enviada ao browser nem convertida em `NEXT_PUBLIC_*`.
4. **RLS permanece habilitada** nas entidades expostas/multi-tenant. Não corrigir erro com `USING (true)` ou RLS desligada.
5. **Menor privilégio.** Grants, Storage policies, helpers e tools recebem apenas o acesso necessário.
6. **Dados sensíveis não entram em logs.** Tokens, cookies, passwords, card data, private keys e provider secrets são redigidos.
7. **Application Error, Business Audit e Analytics são domínios separados.**
8. **Ações de alto impacto exigem confirmação e auditoria.** Billing, permissões, mensagens externas em massa e mutações administrativas não são ações implícitas de IA.

## Identidade e sessão

O fluxo atual usa Supabase Auth. A evolução não troca provider nem reescreve Auth por checklist. Alterações em login, logout, refresh, callback, `current company` ou proxy exigem regressão fresh-session e restauração de sessão.

Branch paralela `fix/auth-first-login-race` será incorporada somente depois de revisão comparativa porque modifica login, layout do painel, proxy e helpers SSR/client.

## Company / tenancy

Operações de negócio devem resolver a empresa autorizada no servidor. Testes BOLA/IDOR devem cobrir, no mínimo:

- customer;
- order;
- proposal;
- product/file;
- automation;
- webhook.

User/Company A não deve conseguir ler ou alterar entidade de Company B por ID conhecido, query string ou payload manual.

## Platform Admin

O Control Center possui roles/capabilities server-side em `lib/platform-admin.ts`.

Regras:

- `owner` continua autoridade máxima da plataforma;
- capabilities são verificadas nas APIs;
- modo suporte deve permanecer read-only por padrão;
- write escalation precisa de motivo, TTL e audit quando implementada;
- busca global Admin deve continuar permission-aware.

## Feature flags

Existe resolver server-side para `platform_feature_flags`, mas a tabela não está presente no Supabase de produção auditado em 2026-08-30.

Até o schema ser aplicado e validado:

- flag ausente = feature desabilitada;
- ausência de schema não autoriza feature;
- client-side flag nunca substitui autorização.

## Storage

Uploads precisam validar:

- bucket canônico;
- MIME/extensão/tamanho;
- path derivado de company autorizada;
- INSERT/SELECT/UPDATE necessários a upsert;
- cross-tenant denial.

Bucket privado não deve se tornar público como correção de imagem.

## Payments

Mercado Pago, Pix, checkout, split, subscription lifecycle e payment webhooks são contratos protegidos. Platform Evolution 3 não modifica billing por conveniência arquitetural.

Qualquer alteração compartilhada exige `npm run verify:payments` e regressão dedicada.

## Observability

`application_error_events` é uma trilha PII-minimized e server-only:

- RLS habilitada;
- `anon`/`authenticated` sem grants;
- `service_role` com SELECT/INSERT;
- sem payload bruto obrigatório;
- stack apenas sanitizado e server-side;
- código público `ORC-…` para correlação.

## AI

Assistente público e Assistente operacional são domínios distintos.

Assistente operacional futuro:

- tools read-only primeiro;
- queries sempre company/capability-scoped;
- nenhuma tool `execute_sql`, `raw_query`, `arbitrary_fetch` ou service role;
- ação externa/mutação requer preview + confirmação humana + tool específica.

## External integrations

Integração sem credential/config validada deve aparecer como `Not configured` ou `Unknown`, nunca como `Connected`.

Segredos externos ficam em secrets/env server-side. Não registrar segredo em audit, application error, analytics ou browser telemetry.

## Revisões obrigatórias antes de produção

- Supabase security advisors;
- grants/RLS/policies de migrations novas;
- cross-tenant tests;
- auth/session regression;
- payment boundary regression;
- secret scan;
- prompt injection/tool authorization para IA;
- browser console/network QA;
- diff review final.
