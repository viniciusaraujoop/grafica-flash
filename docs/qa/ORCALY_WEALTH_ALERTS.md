# Orçaly Wealth Alerts — certificação

STATUS: **CERTIFICADO** em staging + Preview protegido.

Runtime certificado: `7401e20576ca4b686c03871ff0211474001ce620`.
Deployment imutável: `dpl_DXssFBge1nK46tnpPaA8LGgMUNHA`, READY.
Preview exato: `https://orcaly-g2h28o1hr-vinicius-araujos-projects.vercel.app`.

## Escopo certificado

Alerts usa somente fontes factuais Wealth owner-scoped:
- recurrence overdue;
- debt overdue;
- goal pacing;
- Vault expiry declarada;
- Shield;
- Portfolio coverage;
- Tax evidence gaps;
- automation needs_attention.

Cada alerta carrega prioridade, source, reason, deep link e estado de lifecycle. Preferências suportam prioridade mínima, fontes silenciadas e cooldown. Lifecycle suporta dismiss, snooze e restore. O estado é privado; as descrições derivadas não são persistidas como nova fonte de verdade.

Não há provider externo, cotação, cobrança, pagamento, apólice ou imposto inferido. Nenhuma transação financeira é executada.

## Banco e segurança

Staging: **27 migrations**.
Migrations desta unidade:
- `20260927162000_wealth_document_expiry`;
- `20260927170000_wealth_alert_center`.

RPCs públicos:
- `public.wealth_alerts_overview(integer,text)`: STABLE, SECURITY INVOKER;
- `public.manage_wealth_alerts(text,jsonb)`: SECURITY INVOKER.

`authenticated` possui EXECUTE; `anon` não possui EXECUTE. RLS/owner/cross-user e entitlement read/write foram exercitados em testes domain e hosted.

Produção `ozrasuktfthsvbqprtel` foi consultada somente leitura e não possui as migrations nem as RPCs Alerts.

## Testes

Domain/PostgreSQL: **6 PASS / 0 FAIL**.
Scoped lint: **0 errors**.
Rolling V8 run `36332287973`: PASS.
Platform Quality Gate run `36332291135`: PASS.

Hosted run `36332287975`, job `108656413987`: SUCCESS.

Hosted matrix PASS:
- staging auth real password/JWT issuer;
- fontes factuais + owner isolation + no inferred facts;
- dismiss/snooze/restore/preferences/noise control;
- entitlement read/write rechecked;
- exact protected Preview SHA;
- authenticated UI, deep links e zero production calls;
- preferences server action;
- snooze/restore server actions;
- 320/390/768/1024/1440/1920;
- light/dark;
- Axe;
- keyboard/focus;
- reduced motion;
- no overflow;
- cross-user UI;
- anonymous redirect.

Resultado observado: `pageErrors=[]` e `productionRequests=[]`.

## Artifact e cleanup

Artifact: `10935669993`.
Nome: `wealth-alerts-hosted-7401e20576ca4b686c03871ff0211474001ce620`.
Tamanho: **4,030,782 bytes**.
Digest: `sha256:3b59dda31b730f2ffdb819f932f93a11e60c54f9a0ec39280b306b267546778d`.

Cleanup final verificado no staging:
- QA users = 0;
- QA sessions = 0;
- storage.objects = 0;
- wealth_entries = 0;
- wealth_alert_commands = 0;
- wealth_alert_preferences = 0;
- wealth_alert_state = 0;
- active cron = 0.

## Finding global separado

Main Site v2 QA run `36332291200` falha em dois gates globais herdados:
1. `Protected checkout and auth diff check` detecta `app/login/actions.ts` e `app/login/page.tsx` contra o baseline `079c8d781f074d6e86663f9968596694183ac81a`;
2. `global-lint-baseline` permanece em 257 errors / 148 warnings.

Os commits de Alerts entre `e3cd68eb054e3f532fa6275eecb40d31ecdf2751` e o runtime certificado não alteram login/checkout. No mesmo run, domain/regression, payment boundary, focused lint e TypeScript + production build passaram. Portanto o failure do Main Site é branch-wide herdado e não regressão de Alerts.

Próxima unidade Wealth: **Ask Wealth**.
