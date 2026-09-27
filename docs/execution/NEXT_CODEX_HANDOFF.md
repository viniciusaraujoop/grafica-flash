# Handoff V8 — Morning / Night certificado → Alerts

STATUS: CONTINUATION_ACTIVE. Tax Center e Morning / Night **CERTIFICADOS** em staging + Preview protegido. Próxima unidade real: **Alerts**. Não refazer módulos Wealth já certificados.

Branch: `codex/orcaly-ecosystem`. Runtime Morning/Night certificado: `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`. Commits posteriores ao runtime podem ser apenas documentação/evidência; sempre confirme o HEAD real. Main preservada: `d940debf9556e1180fa3c709da0f560d3aa96374`.

## Morning / Night certificado

- Migration: `20260927132000_wealth_morning_night_briefing`.
- Staging: 25 migrations.
- RPC: `public.wealth_daily_briefing(text,date)`, STABLE + SECURITY INVOKER, authenticated only.
- Preview imutável: `dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek`.
- URL exata: `https://orcaly-j3apodya6-vinicius-araujos-projects.vercel.app`.
- Hosted run `36325027162`: 7/7 PASS, 0 page errors.
- Artifact `10934075693`: 12 screenshots, 4.064.524 bytes, digest `b99fc44c83dba12a0e7a587ae5375638ac4d2d4df0578081ac866d9f4c51407c`.
- Domain/PostgreSQL: 5/5 PASS.
- Rolling V8 `36325027679`: PASS.
- Platform Quality Gate `36325030319`: PASS.
- 320/390/768/1024/1440/1920, light/dark, Axe, teclado/foco, reduced motion e no-overflow: PASS.
- auth real, RLS/owner/cross-user, entitlement e anonymous redirect: PASS.
- 0 requests observados à produção.
- Cleanup staging final: QA users/sessions, Storage e fontes Wealth verificadas = 0.

O QA protegido usa share temporário do deployment **imutável** guardado no Vault de staging. O workflow re-resolve o acesso enquanto espera e só aceita `/api/internal/preview-build` com SHA exato. Deployment Protection permanece ativa.

Produção Supabase `ozrasuktfthsvbqprtel` segue READ ONLY e não contém migration/função Morning/Night. Nenhuma promoção Vercel ocorreu.

## Tax Center

Permanece certificado no runtime `d47ac1869dcfc22b93e122508153caf665d09cdf`, hosted run `36319880597`, artifact `10932416353`. Não reabrir.

## Blockers globais separados

Main Site `global-lint-baseline` permanece vermelho separadamente com 257 erros/148 warnings herdados. Advisors globais herdados, Auth/MFA global, acessibilidade humana, performance/observability e integrações externas continuam gates futuros. Platform Quality Gate e Rolling V8 estão verdes no runtime Morning/Night.

## Próxima unidade: Alerts

Implementar alertas owner-scoped com:
- prioridade;
- source;
- reason;
- deep link;
- cooldown;
- dismiss;
- snooze;
- preferences;
- audit;
- noise control.

Fontes factuais: overdue, recurrence, debt, goal pacing, Vault expiry, Shield, portfolio coverage, tax gaps e automation needs_attention.

Reusar infraestrutura existente quando compatível; não inventar provider/evento e não criar segundo saldo. Certificar domain/PG, RLS/owner/cross-user/entitlement, UI + hosted E2E, responsive/a11y, cleanup, advisors e production read-only antes de Ask Wealth.

Evidências Morning/Night: `docs/qa/ORCALY_WEALTH_BRIEFING.md` e JSONs BUILD/DEPLOYMENT/VERCEL_E2E.
