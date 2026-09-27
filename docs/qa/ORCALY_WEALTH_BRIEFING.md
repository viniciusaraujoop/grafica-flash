# Orçaly Wealth Morning / Night — certificação V8

STATUS: **CERTIFICADO** em staging + Preview protegido. Produção não recebeu migration, função ou deploy.

## Escopo certificado

Rota `/apps/wealth/briefing?mode=morning|night`. O briefing é um read model determinístico sobre dados declarados no Wealth.

Morning reúne fatos do dia e próximos compromissos quando existem: lançamentos, recorrências, dívidas, metas, Shield, Portfolio e lacunas Tax. Night resume registros do dia e fatos já declarados para amanhã.

Princípio de UX: **Observe → Entenda → Aja**. A ausência de item não prova ausência de obrigação externa. Banco e mercado permanecem `NOT_CONFIGURED`; nenhuma cobrança, pagamento, liquidação, cotação ou imposto é inventado.

## Banco

Staging `zwxulgpjucxudadjdqov`: **25 migrations**. Última: `20260927132000_wealth_morning_night_briefing`.

`public.wealth_daily_briefing(text,date)` é `STABLE`, `SECURITY INVOKER`, com `EXECUTE` para `authenticated` e sem `EXECUTE` para `anon`. A função revalida `wealth.read` e trabalha somente com fontes owner-scoped já protegidas.

Produção `ozrasuktfthsvbqprtel`, consultada somente leitura: migration Morning/Night ausente e função ausente.

A aplicação no staging preservou o histórico: nenhuma migration aplicada foi editada, renumerada ou reparada. O endpoint padrão de migration encontrou incompatibilidade do ledger legado; o objeto órfão criado nessa tentativa foi removido antes da aplicação controlada da versão `20260927132000`. Futuras alterações de schema exigem migration nova.

## Testes e CI

- Morning/Night domain/PostgreSQL: **5 PASS / 0 FAIL**.
- Scoped ESLint: **0 erros / 1 warning**; o warning é o arquivo hosted E2E ignorado pela configuração global.
- Orçaly Rolling V8 QA run `36325027679`: **PASS**.
- Orçaly Platform Quality Gate run `36325030319`: **PASS**, incluindo regressões, payments, security/dependency gates, TypeScript, production build e diff check.
- Main Site v2 QA permanece um gate global separado com baseline herdado de **257 erros / 148 warnings**; não foi usado para certificar Morning/Night.

## Hosted E2E final

Runtime certificado: `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`.

Deployment imutável: `dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek` — READY / Preview.

URL exata: `https://orcaly-j3apodya6-vinicius-araujos-projects.vercel.app`.

Deployment Protection permaneceu ativa. O CI usa share temporário protegido armazenado no Vault de staging, re-resolve o acesso durante a convergência e só avança quando `/api/internal/preview-build` retorna `environment=preview` e o SHA exato. Alias móvel de branch não é aceito para certificação.

Hosted run `36325027162`: **7 checks PASS / 0 falhas / 0 page errors**:

1. autenticação real de staging por senha + issuer JWT;
2. fatos Morning/Night determinísticos, owner-scoped, centavos exatos e provider boundaries;
3. entitlement revalidado em toda leitura;
4. Preview protegido no commit exato + render Morning autenticado;
5. Night com mudanças do dia, amanhã e ações explicáveis;
6. 320/390/768/1024/1440/1920, light/dark, Axe, teclado, foco, reduced motion e sem overflow;
7. cross-user UI + redirect anônimo.

O E2E aborta qualquer request ao Supabase de produção; o relatório final terminou com `errors=[]`, portanto **0 requests de produção observados**.

Artifact: `wealth-briefing-hosted-9a2c66dbb2e6bf00c484b1791103b2bccd15becd`, ID `10934075693`, **4.064.524 bytes**, digest `sha256:b99fc44c83dba12a0e7a587ae5375638ac4d2d4df0578081ac866d9f4c51407c`. Contém `report.json` + **12 screenshots** (6 larguras × 2 temas). Final do E2E: `2026-09-27T14:15:33.402Z`.

## Cleanup final

Depois do hosted QA:

- QA auth users = 0;
- QA auth sessions = 0;
- Storage objects = 0;
- wealth_entries = 0;
- wealth_goals = 0;
- wealth_portfolios = 0;
- wealth_portfolio_transactions = 0;
- wealth_protection_policies = 0.

## Advisors

Nenhum achado novo foi atribuído à unidade Morning/Night. Permanecem achados herdados do staging, incluindo o WARN de SECURITY DEFINER autenticado em `public.get_my_platform_admin_access()` e avisos globais de performance/RLS já registrados.

## Conclusão

**Morning / Night CERTIFICADO.** Próxima unidade obrigatória: **Alerts**.
