# Handoff V8 — Alerts certificado → Ask Wealth

STATUS: CONTINUATION_ACTIVE. Tax Center, Morning / Night e Alerts **CERTIFICADOS** em staging + Preview protegido. Próxima unidade real: **Ask Wealth**. Não refazer módulos Wealth já certificados.

Branch: `codex/orcaly-ecosystem`. Runtime Alerts certificado: `7401e20576ca4b686c03871ff0211474001ce620`. Commits posteriores podem ser apenas documentação/evidência; sempre confirme o HEAD real. Main preservada: `d940debf9556e1180fa3c709da0f560d3aa96374`.

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

## Alerts certificado

- Migrations: `20260927162000_wealth_document_expiry` e `20260927170000_wealth_alert_center`.
- Staging: 27 migrations.
- Runtime: `7401e20576ca4b686c03871ff0211474001ce620`.
- Deployment imutável: `dpl_DXssFBge1nK46tnpPaA8LGgMUNHA` READY.
- Preview exato: `https://orcaly-g2h28o1hr-vinicius-araujos-projects.vercel.app`.
- Hosted run `36332287975`, job `108656413987`: SUCCESS.
- Domain/PostgreSQL: 6/6 PASS.
- Rolling V8 `36332287973`: PASS.
- Platform Quality Gate `36332291135`: PASS.
- Artifact `10935669993`, 4,030,782 bytes, digest `sha256:3b59dda31b730f2ffdb819f932f93a11e60c54f9a0ec39280b306b267546778d`.
- 320/390/768/1024/1440/1920, light/dark, Axe, teclado/foco, reduced motion e no-overflow: PASS.
- owner/cross-user/entitlement, dismiss/snooze/restore/preferences/noise control e zero production calls: PASS.
- Cleanup final: QA users/sessions, Storage, entries e estados privados Alerts = 0.
- Produção segue read-only e sem migrations/RPCs Alerts.

Main Site run `36332291200` continua vermelho por findings branch-wide herdados: protected login/auth diff contra baseline antigo e global lint 257 errors/148 warnings. O delta Alerts não toca login/checkout; domain/payment/focused lint/build do mesmo run passaram.

## Próxima unidade: Ask Wealth

Construir IA contextual Wealth reutilizando os read models existentes, owner-scoped e entitlement-aware. Requisitos mínimos:
- nenhuma query SQL livre produzida pelo modelo;
- contexto montado por contratos/read models explicitamente allowlisted;
- fontes internas rastreáveis e período declarado;
- incerteza/ausência de dado explícita;
- sem cross-user/cross-product leakage;
- sem provider/cotação inventada;
- sem aconselhamento regulado fingindo autorização;
- sem execução financeira ou side effect;
- modos permitidos inicialmente: education, analysis, simulation e planning;
- `regulated_advice` e `execution` desativados.

Certificar domain/PG, owner/RLS/cross-user/entitlement, consent boundaries, UI + hosted E2E, responsive/a11y, zero produção, cleanup e evidências antes de Portfolio Intelligence.

Evidências Alerts: `docs/qa/ORCALY_WEALTH_ALERTS.md` e JSONs BUILD/DEPLOYMENT/VERCEL_E2E.
